import { Injectable, NotFoundException } from "@nestjs/common";
import { resolve } from "node:path";
import { readJsonFile, writeJsonFile } from "../../common/json-file-store";
import { isDatabaseStorageEnabled, isDevSeedEnabled } from "../../common/runtime-flags";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { LeadsService } from "../leads/leads.service";
import {
  OnboardingDetailDto,
  OnboardingSummaryDto,
  StartOnboardingDto,
  UpdateOnboardingDto
} from "./onboarding.types";

type OnboardingRecord = {
  leadId: number;
  onboardingStatus: string;
  nextAction?: string;
  notes?: string;
  startedAt?: string;
  updatedAt?: string;
};

type OnboardingState = {
  items: OnboardingRecord[];
};

@Injectable()
export class OnboardingService {
  private readonly stateFilePath = resolve(process.cwd(), ".data", "onboarding.json");
  private readonly databaseEnabled = isDatabaseStorageEnabled();
  private readonly devSeedEnabled = isDevSeedEnabled();
  private seedPromise: Promise<void> | null = null;

  private readonly items: OnboardingRecord[] = [
    {
      leadId: 3,
      onboardingStatus: "IN_PROGRESS",
      nextAction: "Request product catalog",
      notes: "Seller replied positively. Waiting for listing details.",
      startedAt: "2026-03-18T03:00:00Z",
      updatedAt: "2026-03-18T03:10:00Z"
    }
  ];

  constructor(
    private readonly leadsService: LeadsService,
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService
  ) {
    if (!this.databaseEnabled) {
      this.loadState();
    }
  }

  async findAll(): Promise<OnboardingSummaryDto[]> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const items = await this.prisma.amazonOnboarding.findMany({
        include: {
          lead: true
        },
        orderBy: {
          updatedAt: "desc"
        }
      });

      return items.map((item) => ({
        leadId: Number(item.leadId),
        displayName: item.lead.displayName ?? item.lead.handle,
        handle: item.lead.handle,
        platform: item.lead.platform,
        onboardingStatus: item.onboardingStatus,
        nextAction: item.nextAction ?? undefined,
        updatedAt: item.updatedAt.toISOString()
      }));
    }

    const leads = await this.leadsService.listCrmLeads();
    const summaries: OnboardingSummaryDto[] = [];

    for (const item of this.items) {
      const lead = leads.find((entry) => entry.id === item.leadId);

      if (!lead) {
        continue;
      }

      summaries.push({
        leadId: item.leadId,
        displayName: lead.displayName,
        handle: lead.handle,
        platform: lead.platform,
        onboardingStatus: item.onboardingStatus,
        nextAction: item.nextAction,
        updatedAt: item.updatedAt
      });
    }

    return summaries;
  }

  async findOne(leadId: number): Promise<OnboardingDetailDto> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
    }

    const lead = await this.leadsService.findOne(leadId);

    if (this.databaseEnabled) {
      const item = await this.prisma.amazonOnboarding.findUnique({
        where: {
          leadId: BigInt(leadId)
        }
      });

      return {
        leadId,
        displayName: lead.displayName,
        handle: lead.handle,
        platform: lead.platform,
        crmStage: lead.crmStage,
        onboardingStatus: item?.onboardingStatus ?? "NOT_STARTED",
        nextAction: item?.nextAction ?? undefined,
        notes: item?.notes ?? undefined,
        startedAt: item?.startedAt?.toISOString(),
        updatedAt: item?.updatedAt.toISOString()
      };
    }

    const item = this.items.find((entry) => entry.leadId === leadId);

    return {
      leadId,
      displayName: lead.displayName,
      handle: lead.handle,
      platform: lead.platform,
      crmStage: lead.crmStage,
      onboardingStatus: item?.onboardingStatus ?? "NOT_STARTED",
      nextAction: item?.nextAction,
      notes: item?.notes,
      startedAt: item?.startedAt,
      updatedAt: item?.updatedAt
    };
  }

  async start(payload: StartOnboardingDto): Promise<OnboardingDetailDto> {
    const now = new Date();
    await this.leadsService.moveCrmStage(payload.leadId, "ONBOARDING");

    if (this.databaseEnabled) {
      await this.prisma.amazonOnboarding.upsert({
        where: {
          leadId: BigInt(payload.leadId)
        },
        update: {
          onboardingStatus: payload.onboardingStatus ?? "IN_PROGRESS",
          nextAction: payload.nextAction,
          notes: payload.notes,
          startedAt: now
        },
        create: {
          leadId: BigInt(payload.leadId),
          onboardingStatus: payload.onboardingStatus ?? "IN_PROGRESS",
          nextAction: payload.nextAction,
          notes: payload.notes,
          startedAt: now
        }
      });

      await this.auditLogService.log({
        entityType: "LEAD",
        entityId: payload.leadId,
        actionType: "ONBOARDING_STARTED",
        summary: "온보딩 시작",
        detail: payload.nextAction ?? payload.notes
      });

      return this.findOne(payload.leadId);
    }

    const existing = this.items.find((item) => item.leadId === payload.leadId);

    if (existing) {
      existing.onboardingStatus = payload.onboardingStatus ?? "IN_PROGRESS";
      existing.nextAction = payload.nextAction;
      existing.notes = payload.notes;
      existing.startedAt = existing.startedAt ?? now.toISOString();
      existing.updatedAt = now.toISOString();
    } else {
      this.items.unshift({
        leadId: payload.leadId,
        onboardingStatus: payload.onboardingStatus ?? "IN_PROGRESS",
        nextAction: payload.nextAction,
        notes: payload.notes,
        startedAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
    }

    await this.auditLogService.log({
      entityType: "LEAD",
      entityId: payload.leadId,
      actionType: "ONBOARDING_STARTED",
      summary: "온보딩 시작",
      detail: payload.nextAction ?? payload.notes
    });

    this.saveState();
    return this.findOne(payload.leadId);
  }

  async update(
    leadId: number,
    payload: UpdateOnboardingDto
  ): Promise<OnboardingDetailDto> {
    const now = new Date();

    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const existing = await this.prisma.amazonOnboarding.findUnique({
        where: {
          leadId: BigInt(leadId)
        }
      });

      if (!existing) {
        throw new NotFoundException(`Onboarding ${leadId} not found`);
      }

      await this.prisma.amazonOnboarding.update({
        where: {
          leadId: BigInt(leadId)
        },
        data: {
          onboardingStatus: payload.onboardingStatus ?? existing.onboardingStatus,
          nextAction: payload.nextAction ?? existing.nextAction,
          notes: payload.notes ?? existing.notes,
          updatedAt: now
        }
      });

      await this.auditLogService.log({
        entityType: "LEAD",
        entityId: leadId,
        actionType: "ONBOARDING_UPDATED",
        summary: `온보딩 상태 업데이트: ${payload.onboardingStatus ?? existing.onboardingStatus}`,
        detail: payload.nextAction ?? payload.notes
      });

      return this.findOne(leadId);
    }

    const item = this.items.find((entry) => entry.leadId === leadId);

    if (!item) {
      throw new NotFoundException(`Onboarding ${leadId} not found`);
    }

    item.onboardingStatus = payload.onboardingStatus ?? item.onboardingStatus;
    item.nextAction = payload.nextAction ?? item.nextAction;
    item.notes = payload.notes ?? item.notes;
    item.updatedAt = now.toISOString();
    await this.auditLogService.log({
      entityType: "LEAD",
      entityId: leadId,
      actionType: "ONBOARDING_UPDATED",
      summary: `온보딩 상태 업데이트: ${payload.onboardingStatus ?? item.onboardingStatus}`,
      detail: payload.nextAction ?? payload.notes
    });
    this.saveState();

    return this.findOne(leadId);
  }

  private loadState() {
    const state = readJsonFile<OnboardingState | null>(this.stateFilePath, null);

    if (!state) {
      return;
    }

    this.items.splice(0, this.items.length, ...state.items);
  }

  private saveState() {
    writeJsonFile<OnboardingState>(this.stateFilePath, {
      items: this.items
    });
  }

  private async ensureDatabaseSeed() {
    if (!this.databaseEnabled || !this.devSeedEnabled) {
      return;
    }

    if (!this.seedPromise) {
      this.seedPromise = (async () => {
        await this.leadsService.listCrmLeads();

        const onboardingCount = await this.prisma.amazonOnboarding.count();

        if (onboardingCount > 0) {
          return;
        }

        const [defaultItem] = this.items;
        const lead = await this.prisma.lead.findFirst({
          where: {
            OR: [
              {
                handle: "@kglow_finds"
              },
              {
                crmStage: "REPLIED"
              }
            ]
          },
          orderBy: {
            id: "asc"
          }
        });

        if (!lead || !defaultItem) {
          return;
        }

        await this.prisma.amazonOnboarding.create({
          data: {
            leadId: lead.id,
            onboardingStatus: defaultItem.onboardingStatus,
            nextAction: defaultItem.nextAction,
            notes: defaultItem.notes,
            startedAt: defaultItem.startedAt ? new Date(defaultItem.startedAt) : undefined,
            updatedAt: defaultItem.updatedAt ? new Date(defaultItem.updatedAt) : new Date()
          }
        });
      })();
    }

    await this.seedPromise;
  }
}
