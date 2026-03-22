import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { isDatabaseStorageEnabled } from "../../common/runtime-flags";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CampaignDetailDto } from "../campaigns/campaigns.types";
import { LeadsService } from "../leads/leads.service";
import {
  DiscoveryCandidateDto,
  DiscoveryDecisionStatus,
  DiscoveryImportAction,
  DiscoveryNormalizedCandidateDto,
  DiscoveryRunDto,
  DiscoveryRunListQueryDto,
  DiscoveryRunStatus,
  DiscoveryRunSummaryDto,
  ImportDiscoveryCandidatesDto
} from "./discovery.types";

type PersistedCandidate = {
  raw: Record<string, unknown>;
  normalized: DiscoveryNormalizedCandidateDto;
  externalSourceType: string;
  externalId?: string;
  handle?: string;
};

const discoveryRunArgs = Prisma.validator<Prisma.DiscoveryRunDefaultArgs>()({
  include: {
    campaign: true,
    candidates: {
      orderBy: {
        id: "asc"
      }
    }
  }
});

type DiscoveryRunRecord = Prisma.DiscoveryRunGetPayload<typeof discoveryRunArgs>;

@Injectable()
export class DiscoveryIngestionService {
  private readonly databaseEnabled = isDatabaseStorageEnabled();

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
    private readonly auditLogService: AuditLogService
  ) {}

  async createRun(
    campaign: CampaignDetailDto,
    requestedBy?: string
  ): Promise<DiscoveryRunDto> {
    this.assertDatabaseEnabled();
    await this.ensureNoRunningRun(campaign.id);

    const run = await this.prisma.discoveryRun.create({
      ...discoveryRunArgs,
      data: {
        campaignId: BigInt(campaign.id),
        platform: "INSTAGRAM",
        sourceSnapshot: campaign.sources as unknown as Prisma.InputJsonValue,
        status: "RUNNING",
        requestedBy
      }
    });

    return this.toRunDto(run);
  }

  async saveCandidates(runId: number, candidates: PersistedCandidate[]) {
    this.assertDatabaseEnabled();

    if (!candidates.length) {
      return;
    }

    await this.prisma.discoveryCandidate.createMany({
      data: candidates.map((candidate) => ({
        runId: BigInt(runId),
        externalSourceType: candidate.externalSourceType,
        externalId: candidate.externalId,
        handle: candidate.handle,
        payloadJson: candidate.raw as Prisma.InputJsonValue,
        normalizedJson: candidate.normalized as unknown as Prisma.InputJsonValue,
        decisionStatus: "PENDING"
      }))
    });
  }

  async finalizeRun(
    runId: number,
    status: DiscoveryRunStatus,
    summary: DiscoveryRunSummaryDto,
    error?: { message: string; details?: string[] }
  ): Promise<DiscoveryRunDto> {
    this.assertDatabaseEnabled();

    const run = await this.prisma.discoveryRun.update({
      ...discoveryRunArgs,
      where: {
        id: BigInt(runId)
      },
      data: {
        status,
        summaryJson: summary as unknown as Prisma.InputJsonValue,
        errorJson: error ? (error as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        finishedAt: new Date(),
        updatedAt: new Date()
      }
    });

    await this.auditLogService.log({
      entityType: "DISCOVERY_RUN",
      entityId: runId,
      actionType: status === "FAILED" ? "DISCOVERY_RUN_FAILED" : "DISCOVERY_RUN_COMPLETED",
      actor: run.requestedBy ?? undefined,
      summary: `Discovery run ${status.toLowerCase()}`,
      detail: `${run.campaign.name} discovery finished with status ${status}.`,
      afterData: {
        status,
        summary
      }
    });

    return this.toRunDto(run);
  }

  async listRuns(query: DiscoveryRunListQueryDto): Promise<DiscoveryRunDto[]> {
    this.assertDatabaseEnabled();

    const runs = await this.prisma.discoveryRun.findMany({
      ...discoveryRunArgs,
      where: {
        campaignId: query.campaignId ? BigInt(query.campaignId) : undefined,
        status: query.status || undefined
      },
      orderBy: {
        startedAt: "desc"
      }
    });

    return runs.map((run) => this.toRunDto(run));
  }

  async findRun(runId: number): Promise<DiscoveryRunDto> {
    return this.toRunDto(await this.requireRun(runId));
  }

  async listCandidates(runId: number): Promise<DiscoveryCandidateDto[]> {
    const run = await this.requireRun(runId);
    const csvPayload = this.buildImportPayload(
      run.candidates.map((candidate) => ({
        id: Number(candidate.id),
        normalized: this.toNormalizedCandidate(candidate.normalizedJson),
        action: this.toImportAction(candidate.decisionStatus)
      }))
    );

    const preview = await this.leadsService.previewImportCsv({
      csvText: csvPayload.csvText,
      campaignId: Number(run.campaignId),
      platform: run.platform,
      actions: csvPayload.actions
    });

    return run.candidates.map((candidate, index) => {
      const previewRow = preview.rows[index];
      const decisionStatus = this.toDecisionStatus(candidate.decisionStatus);

      return {
        id: Number(candidate.id),
        runId: Number(candidate.runId),
        externalSourceType: candidate.externalSourceType,
        externalId: candidate.externalId ?? undefined,
        handle: candidate.handle ?? undefined,
        decisionStatus,
        createdAt: candidate.createdAt.toISOString(),
        payload: this.toJsonObject(candidate.payloadJson),
        normalized: this.toNormalizedCandidate(candidate.normalizedJson),
        preview: {
          status: previewRow?.status ?? "SKIP",
          reason: previewRow?.reason,
          suggestedAction:
            decisionStatus === "OVERWRITE" || decisionStatus === "MERGE"
              ? decisionStatus
              : "SKIP"
        }
      };
    });
  }

  async importCandidates(
    runId: number,
    payload: ImportDiscoveryCandidatesDto
  ) {
    const run = await this.requireRun(runId);

    if (run.status === "RUNNING") {
      throw new ConflictException("Cannot import candidates while discovery is still running.");
    }

    if (!payload.selections.length) {
      throw new ConflictException("At least one candidate selection is required.");
    }

    const actionableSelections = payload.selections.filter(
      (selection) => selection.action !== "SKIP"
    );

    if (!actionableSelections.length) {
      throw new ConflictException("At least one non-SKIP candidate selection is required.");
    }

    const selectedCandidates = actionableSelections.map((selection) => {
      const candidate = run.candidates.find((item) => Number(item.id) === selection.candidateId);

      if (!candidate) {
        throw new NotFoundException(`Discovery candidate ${selection.candidateId} not found.`);
      }

      return {
        id: selection.candidateId,
        action: selection.action,
        normalized: this.toNormalizedCandidate(candidate.normalizedJson)
      };
    });

    await this.prisma.$transaction(
      payload.selections.map((selection) =>
        this.prisma.discoveryCandidate.update({
          where: {
            id: BigInt(selection.candidateId)
          },
          data: {
            decisionStatus: selection.action
          }
        })
      )
    );

    const importPayload = this.buildImportPayload(selectedCandidates);
    const result = await this.leadsService.importCsv({
      csvText: importPayload.csvText,
      campaignId: Number(run.campaignId),
      platform: run.platform,
      fileName: `discovery-run-${runId}.csv`,
      templateName: `Discovery run ${runId}`,
      actor: payload.actor,
      actions: importPayload.actions
    });

    const skippedRows = new Set(result.skipped.map((item) => item.rowNumber));
    const importedCandidateIds = selectedCandidates
      .filter((_, index) => !skippedRows.has(index + 2))
      .map((candidate) => candidate.id);

    if (importedCandidateIds.length) {
      await this.prisma.discoveryCandidate.updateMany({
        where: {
          id: {
            in: importedCandidateIds.map((id) => BigInt(id))
          }
        },
        data: {
          decisionStatus: "IMPORTED"
        }
      });
    }

    const existingSummary = this.toSummary(run.summaryJson);
    const nextSummary: DiscoveryRunSummaryDto = {
      ...(existingSummary ?? {
        dryRun: false,
        candidateCount: run.candidates.length,
        sourceResults: [],
        warnings: []
      }),
      importedCount: result.imported.length,
      skippedCount: result.skipped.length,
      overwriteCount: actionableSelections.filter((item) => item.action === "OVERWRITE").length,
      mergeCount: actionableSelections.filter((item) => item.action === "MERGE").length
    };

    const updatedRun = await this.prisma.discoveryRun.update({
      ...discoveryRunArgs,
      where: {
        id: BigInt(runId)
      },
      data: {
        status: "IMPORTED",
        summaryJson: nextSummary as unknown as Prisma.InputJsonValue,
        updatedAt: new Date()
      }
    });

    await this.auditLogService.log({
      entityType: "DISCOVERY_RUN",
      entityId: runId,
      actionType: "DISCOVERY_IMPORTED",
      actor: payload.actor,
      summary: "Discovery candidates imported",
      detail: `${result.imported.length} candidates were imported from discovery run ${runId}.`,
      afterData: {
        importedCount: result.imported.length,
        skippedCount: result.skipped.length
      }
    });

    return {
      run: this.toRunDto(updatedRun),
      result
    };
  }

  private async requireRun(runId: number): Promise<DiscoveryRunRecord> {
    this.assertDatabaseEnabled();
    const run = await this.prisma.discoveryRun.findUnique({
      ...discoveryRunArgs,
      where: {
        id: BigInt(runId)
      }
    });

    if (!run) {
      throw new NotFoundException(`Discovery run ${runId} not found.`);
    }

    return run;
  }

  private async ensureNoRunningRun(campaignId: number) {
    const existing = await this.prisma.discoveryRun.findFirst({
      where: {
        campaignId: BigInt(campaignId),
        status: "RUNNING"
      },
      orderBy: {
        startedAt: "desc"
      }
    });

    if (existing) {
      throw new ConflictException(
        `Campaign ${campaignId} already has a running discovery batch.`
      );
    }
  }

  private buildImportPayload(
    candidates: Array<{
      id: number;
      normalized: DiscoveryNormalizedCandidateDto;
      action: DiscoveryImportAction;
    }>
  ) {
    const headers = [
      "campaignId",
      "platform",
      "handle",
      "displayName",
      "category",
      "followerCount",
      "postCount",
      "bio",
      "contactValue"
    ];

    const lines = candidates.map((candidate) =>
      [
        candidate.normalized.campaignId,
        candidate.normalized.platform,
        candidate.normalized.handle,
        candidate.normalized.displayName,
        candidate.normalized.category,
        candidate.normalized.followerCount,
        candidate.normalized.postCount,
        candidate.normalized.bio,
        candidate.normalized.contactValue
      ]
        .map((value) => this.escapeCsvValue(value))
        .join(",")
    );

    return {
      csvText: [headers.join(","), ...lines].join("\n"),
      actions: candidates.map((candidate, index) => ({
        rowNumber: index + 2,
        action: candidate.action
      }))
    };
  }

  private escapeCsvValue(value: string | number | undefined) {
    const nextValue = value === undefined ? "" : String(value);

    if (nextValue.includes(",") || nextValue.includes('"') || nextValue.includes("\n")) {
      return `"${nextValue.replace(/"/g, '""')}"`;
    }

    return nextValue;
  }

  private toRunDto(run: DiscoveryRunRecord): DiscoveryRunDto {
    return {
      id: Number(run.id),
      campaignId: Number(run.campaignId),
      campaignName: run.campaign.name,
      platform: run.platform,
      status: run.status as DiscoveryRunStatus,
      requestedBy: run.requestedBy ?? undefined,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString(),
      summary: this.toSummary(run.summaryJson),
      error: this.toError(run.errorJson)
    };
  }

  private toDecisionStatus(value: string): DiscoveryDecisionStatus {
    if (["PENDING", "SKIP", "OVERWRITE", "MERGE", "IMPORTED"].includes(value)) {
      return value as DiscoveryDecisionStatus;
    }

    return "PENDING";
  }

  private toImportAction(value: string): DiscoveryImportAction {
    if (value === "OVERWRITE" || value === "MERGE") {
      return value;
    }

    return "SKIP";
  }

  private toSummary(value: Prisma.JsonValue | null): DiscoveryRunSummaryDto | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    return value as unknown as DiscoveryRunSummaryDto;
  }

  private toError(
    value: Prisma.JsonValue | null
  ): DiscoveryRunDto["error"] | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    const message = Reflect.get(value, "message");
    const details = Reflect.get(value, "details");

    return typeof message === "string"
      ? {
          message,
          details: Array.isArray(details)
            ? details.filter((item): item is string => typeof item === "string")
            : undefined
        }
      : undefined;
  }

  private toJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private toNormalizedCandidate(value: Prisma.JsonValue): DiscoveryNormalizedCandidateDto {
    const json = this.toJsonObject(value);
    const posts: DiscoveryNormalizedCandidateDto["posts"] = [];

    if (Array.isArray(json.posts)) {
      for (const item of json.posts) {
        if (!item || typeof item !== "object") {
          continue;
        }

        const postUrl =
          typeof Reflect.get(item, "postUrl") === "string"
            ? (Reflect.get(item, "postUrl") as string)
            : "";

        if (!postUrl) {
          continue;
        }

        posts.push({
          postUrl,
          caption:
            typeof Reflect.get(item, "caption") === "string"
              ? (Reflect.get(item, "caption") as string)
              : undefined,
          postedAt:
            typeof Reflect.get(item, "postedAt") === "string"
              ? (Reflect.get(item, "postedAt") as string)
              : undefined
        });
      }
    }

    return {
      campaignId:
        typeof json.campaignId === "number" ? json.campaignId : 1,
      platform: "INSTAGRAM",
      handle: typeof json.handle === "string" ? json.handle : undefined,
      displayName: typeof json.displayName === "string" ? json.displayName : undefined,
      category: typeof json.category === "string" ? json.category : undefined,
      followerCount:
        typeof json.followerCount === "number" ? json.followerCount : undefined,
      postCount: typeof json.postCount === "number" ? json.postCount : undefined,
      bio: typeof json.bio === "string" ? json.bio : undefined,
      contactValue: typeof json.contactValue === "string" ? json.contactValue : undefined,
      posts
    };
  }

  private assertDatabaseEnabled() {
    if (!this.databaseEnabled) {
      throw new ServiceUnavailableException(
        "Instagram discovery requires PostgreSQL mode. JSON fallback does not support discovery."
      );
    }
  }
}
