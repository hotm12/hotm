import { ConflictException, Injectable } from "@nestjs/common";
import { CampaignsService } from "../campaigns/campaigns.service";
import { DiscoveryIngestionService } from "./discovery-ingestion.service";
import { InstagramDiscoveryCollector } from "./instagram-discovery.collector";
import { InstagramDiscoveryNormalizer } from "./instagram-discovery.normalizer";
import {
  DiscoveryImportAction,
  DiscoveryRunListQueryDto,
  ImportDiscoveryCandidatesDto,
  RunInstagramDiscoveryDto
} from "./discovery.types";

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly collector: InstagramDiscoveryCollector,
    private readonly normalizer: InstagramDiscoveryNormalizer,
    private readonly ingestionService: DiscoveryIngestionService
  ) {}

  async runInstagramDiscovery(campaignId: number, payload: RunInstagramDiscoveryDto) {
    const campaign = await this.campaignsService.findOne(campaignId);

    if (campaign.targetPlatform !== "INSTAGRAM") {
      throw new ConflictException(
        `Campaign ${campaignId} targets ${campaign.targetPlatform}. Discovery v1 only supports INSTAGRAM campaigns.`
      );
    }

    const run = await this.ingestionService.createRun(campaign, payload.actor);
    const maxCandidatesPerSource = Math.max(1, payload.maxCandidatesPerSource ?? 10);
    const maxPostsPerLead = Math.max(1, payload.maxPostsPerLead ?? 3);
    const warnings: string[] = [];
    const sourceResults = [];
    const persistedCandidates: Array<{
      raw: Record<string, unknown>;
      normalized: ReturnType<InstagramDiscoveryNormalizer["normalizeCandidate"]>;
      externalSourceType: string;
      externalId?: string;
      handle?: string;
    }> = [];
    const seenCandidateKeys = new Set<string>();
    const errors: string[] = [];

    try {
      for (const source of campaign.sources) {
        try {
          const result = await this.collector.collect(source, {
            maxCandidatesPerSource,
            maxPostsPerLead,
            dryRun: payload.dryRun ?? false
          });

          sourceResults.push(result.sourceResult);
          warnings.push(...result.warnings);

          for (const candidate of result.candidates) {
            const normalized = this.normalizer.normalizeCandidate(
              campaign,
              candidate,
              maxPostsPerLead
            );
            const dedupeKey =
              normalized.handle?.trim().toLowerCase() ||
              candidate.externalId ||
              `${candidate.externalSourceType}:${JSON.stringify(candidate.payload)}`;

            if (seenCandidateKeys.has(dedupeKey)) {
              warnings.push(`Duplicate candidate skipped inside run: ${dedupeKey}`);
              continue;
            }

            seenCandidateKeys.add(dedupeKey);
            persistedCandidates.push({
              raw: candidate.payload,
              normalized,
              externalSourceType: candidate.externalSourceType,
              externalId: candidate.externalId,
              handle: candidate.handle
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown discovery error";
          errors.push(`${source.sourceType}:${source.sourceValue} -> ${message}`);
          sourceResults.push({
            sourceType: source.sourceType,
            sourceValue: source.sourceValue,
            status: "FAILED" as const,
            candidateCount: 0,
            error: message
          });
        }
      }

      await this.ingestionService.saveCandidates(run.id, persistedCandidates);

      const status =
        errors.length > 0
          ? persistedCandidates.length > 0
            ? "PARTIAL"
            : "FAILED"
          : "SUCCEEDED";

      return this.ingestionService.finalizeRun(
        run.id,
        status,
        {
          dryRun: payload.dryRun ?? false,
          candidateCount: persistedCandidates.length,
          sourceResults,
          warnings
        },
        errors.length
          ? {
              message:
                status === "FAILED"
                  ? "Discovery run failed."
                  : "Discovery run completed with partial failures.",
              details: errors
            }
          : undefined
      );
    } catch (error) {
      return this.ingestionService.finalizeRun(
        run.id,
        "FAILED",
        {
          dryRun: payload.dryRun ?? false,
          candidateCount: persistedCandidates.length,
          sourceResults,
          warnings
        },
        {
          message: error instanceof Error ? error.message : "Unknown discovery error",
          details: errors
        }
      );
    }
  }

  async listRuns(query: DiscoveryRunListQueryDto) {
    return this.ingestionService.listRuns(query);
  }

  async findRun(runId: number) {
    return this.ingestionService.findRun(runId);
  }

  async listCandidates(runId: number) {
    return this.ingestionService.listCandidates(runId);
  }

  async importCandidates(runId: number, payload: ImportDiscoveryCandidatesDto) {
    return this.ingestionService.importCandidates(runId, {
      actor: payload.actor,
      selections: payload.selections.map((selection) => ({
        candidateId: selection.candidateId,
        action: this.normalizeImportAction(selection.action)
      }))
    });
  }

  private normalizeImportAction(action: string): DiscoveryImportAction {
    if (action === "OVERWRITE" || action === "MERGE") {
      return action;
    }

    return "SKIP";
  }
}
