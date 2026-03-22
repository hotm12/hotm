import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolve } from "node:path";
import { readJsonFile, writeJsonFile } from "../../common/json-file-store";
import { isDatabaseStorageEnabled, isDevSeedEnabled } from "../../common/runtime-flags";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogItemDto, CreateAuditLogDto } from "./audit-log.types";

type AuditLogRecord = AuditLogItemDto;

type AuditLogState = {
  nextAuditLogId: number;
  items: AuditLogRecord[];
};

function createDefaultAuditLogs(): AuditLogRecord[] {
  return [
    {
      id: 1,
      entityType: "OUTREACH_MESSAGE",
      entityId: 3,
      actionType: "OUTREACH_APPROVED",
      actor: "system",
      summary: "아웃리치 이메일 승인",
      detail: "KGlow Finds 제안 메일이 승인되었습니다.",
      createdAt: "2026-03-18T00:10:00Z"
    },
    {
      id: 2,
      entityType: "LEAD",
      entityId: 3,
      actionType: "CRM_REPLY_RECORDED",
      actor: "system",
      summary: "긍정 답장 수신",
      detail: "온보딩 관련 상세 정보를 요청하는 답장이 기록되었습니다.",
      createdAt: "2026-03-18T02:00:00Z"
    },
    {
      id: 3,
      entityType: "LEAD",
      entityId: 3,
      actionType: "ONBOARDING_STARTED",
      actor: "system",
      summary: "온보딩 시작",
      detail: "상품 카탈로그 요청 단계로 온보딩이 시작되었습니다.",
      createdAt: "2026-03-18T03:00:00Z"
    }
  ];
}

@Injectable()
export class AuditLogService {
  private readonly stateFilePath = resolve(process.cwd(), ".data", "audit-log.json");
  private readonly databaseEnabled = isDatabaseStorageEnabled();
  private readonly devSeedEnabled = isDevSeedEnabled();
  private nextAuditLogId = 4;
  private readonly items: AuditLogRecord[] = createDefaultAuditLogs();
  private seedPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {
    if (!this.databaseEnabled) {
      this.loadState();
    }
  }

  async listRecent(limit = 20): Promise<AuditLogItemDto[]> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const items = await this.prisma.auditLog.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: limit
      });

      return items.map((item) => this.toDto(item));
    }

    return [...this.items]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }

  async log(payload: CreateAuditLogDto): Promise<AuditLogItemDto> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const created = await this.prisma.auditLog.create({
        data: {
          entityType: payload.entityType,
          entityId: BigInt(payload.entityId),
          actionType: payload.actionType,
          actor: payload.actor,
          beforeData: this.toNullableJson(payload.beforeData),
          afterData: this.buildAfterData(payload),
          createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date()
        }
      });

      return this.toDto(created);
    }

    const item: AuditLogRecord = {
      id: this.nextAuditLogId++,
      entityType: payload.entityType,
      entityId: payload.entityId,
      actionType: payload.actionType,
      actor: payload.actor,
      summary: payload.summary,
      detail: payload.detail,
      createdAt: payload.createdAt ?? new Date().toISOString()
    };

    this.items.unshift(item);
    this.saveState();
    return item;
  }

  private buildAfterData(payload: CreateAuditLogDto): Prisma.InputJsonValue | undefined {
    const nextAfterData =
      payload.afterData && typeof payload.afterData === "object" && !Array.isArray(payload.afterData)
        ? { ...payload.afterData }
        : {};

    if (payload.summary) {
      Reflect.set(nextAfterData, "summary", payload.summary);
    }

    if (payload.detail) {
      Reflect.set(nextAfterData, "detail", payload.detail);
    }

    return Object.keys(nextAfterData).length > 0
      ? (nextAfterData as Prisma.InputJsonValue)
      : undefined;
  }

  private toDto(record: {
    id: bigint;
    entityType: string;
    entityId: bigint;
    actionType: string;
    actor: string | null;
    beforeData: Prisma.JsonValue | null;
    afterData: Prisma.JsonValue | null;
    createdAt: Date;
  }): AuditLogItemDto {
    return {
      id: Number(record.id),
      entityType: record.entityType,
      entityId: Number(record.entityId),
      actionType: record.actionType,
      actor: record.actor ?? undefined,
      summary: this.readString(record.afterData, "summary"),
      detail: this.readString(record.afterData, "detail"),
      createdAt: record.createdAt.toISOString()
    };
  }

  private readString(value: Prisma.JsonValue | null, key: string): string | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    const nextValue = Reflect.get(value, key);
    return typeof nextValue === "string" ? nextValue : undefined;
  }

  private toNullableJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return undefined;
    }

    return value as Prisma.InputJsonValue;
  }

  private async ensureDatabaseSeed() {
    if (!this.databaseEnabled || !this.devSeedEnabled) {
      return;
    }

    if (!this.seedPromise) {
      this.seedPromise = (async () => {
        const auditCount = await this.prisma.auditLog.count();

        if (auditCount > 0) {
          return;
        }

        await this.prisma.auditLog.createMany({
          data: createDefaultAuditLogs().map((item) => ({
            entityType: item.entityType,
            entityId: BigInt(item.entityId),
            actionType: item.actionType,
            actor: item.actor,
            afterData: {
              summary: item.summary,
              detail: item.detail
            },
            createdAt: new Date(item.createdAt)
          }))
        });
      })();
    }

    await this.seedPromise;
  }

  private loadState() {
    const state = readJsonFile<AuditLogState | null>(this.stateFilePath, null);

    if (!state) {
      return;
    }

    this.nextAuditLogId = state.nextAuditLogId;
    this.items.splice(0, this.items.length, ...state.items);
  }

  private saveState() {
    writeJsonFile<AuditLogState>(this.stateFilePath, {
      nextAuditLogId: this.nextAuditLogId,
      items: this.items
    });
  }
}
