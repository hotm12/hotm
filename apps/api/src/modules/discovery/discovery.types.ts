export type DiscoveryRunStatus =
  | "RUNNING"
  | "SUCCEEDED"
  | "PARTIAL"
  | "FAILED"
  | "IMPORTED";

export type DiscoveryDecisionStatus =
  | "PENDING"
  | "SKIP"
  | "OVERWRITE"
  | "MERGE"
  | "IMPORTED";

export type DiscoveryImportAction = "SKIP" | "OVERWRITE" | "MERGE";

export interface DiscoveryNormalizedCandidateDto {
  campaignId: number;
  platform: "INSTAGRAM";
  handle?: string;
  displayName?: string;
  category?: string;
  followerCount?: number;
  postCount?: number;
  bio?: string;
  contactValue?: string;
  posts: Array<{
    postUrl: string;
    caption?: string;
    postedAt?: string;
  }>;
}

export interface DiscoverySourceResultDto {
  sourceType: string;
  sourceValue: string;
  status: "SUCCEEDED" | "FAILED" | "SKIPPED";
  candidateCount: number;
  warning?: string;
  error?: string;
}

export interface DiscoveryRunSummaryDto {
  dryRun: boolean;
  candidateCount: number;
  importedCount?: number;
  skippedCount?: number;
  overwriteCount?: number;
  mergeCount?: number;
  sourceResults: DiscoverySourceResultDto[];
  warnings: string[];
}

export interface DiscoveryRunDto {
  id: number;
  campaignId: number;
  campaignName?: string;
  platform: string;
  status: DiscoveryRunStatus;
  requestedBy?: string;
  startedAt: string;
  finishedAt?: string;
  summary?: DiscoveryRunSummaryDto;
  error?: {
    message: string;
    details?: string[];
  };
}

export interface DiscoveryRunListQueryDto {
  campaignId?: string;
  status?: DiscoveryRunStatus;
}

export interface DiscoveryCandidateDto {
  id: number;
  runId: number;
  externalSourceType: string;
  externalId?: string;
  handle?: string;
  decisionStatus: DiscoveryDecisionStatus;
  createdAt: string;
  payload: Record<string, unknown>;
  normalized: DiscoveryNormalizedCandidateDto;
  preview: {
    status: "READY" | "SKIP";
    reason?: string;
    suggestedAction: DiscoveryImportAction;
  };
}

export interface RunInstagramDiscoveryDto {
  maxCandidatesPerSource?: number;
  maxPostsPerLead?: number;
  dryRun?: boolean;
  actor?: string;
}

export interface ImportDiscoveryCandidatesDto {
  actor?: string;
  selections: Array<{
    candidateId: number;
    action: DiscoveryImportAction;
  }>;
}

export interface DiscoveryCollectorCandidate {
  externalSourceType: string;
  externalId?: string;
  handle?: string;
  payload: Record<string, unknown>;
}
