export interface LeadSummaryDto {
  id: number;
  campaignId: number;
  platform: string;
  handle: string;
  displayName: string;
  category?: string;
  followerCount?: number;
  leadStatus: string;
  crmStage?: string;
  totalScore: number;
  scoreGrade: string;
  riskFlags: string[];
}

export interface LeadContactDto {
  id: number;
  contactType: string;
  contactValue: string;
  isPrimary: boolean;
}

export interface LeadPostDto {
  id: number;
  postUrl: string;
  caption: string;
  postedAt: string;
}

export interface LeadScoreBreakdownDto {
  label: string;
  scoreDelta: number;
  reason: string;
}

export interface LeadScoreDto {
  totalScore: number;
  scoreGrade: string;
  scoreBreakdown: LeadScoreBreakdownDto[];
}

export interface ReviewChecklistAnswerDto {
  id: number;
  label: string;
  passed: boolean | null;
  note?: string;
}

export interface LeadDetailDto extends LeadSummaryDto {
  bio?: string;
  postCount?: number;
  reviewNotes?: string;
  contacts: LeadContactDto[];
  posts: LeadPostDto[];
  score: LeadScoreDto;
  reviewChecklistAnswers: ReviewChecklistAnswerDto[];
}

export interface CreateLeadDto {
  campaignId: number;
  platform: string;
  handle: string;
  displayName: string;
  category?: string;
  followerCount?: number;
  postCount?: number;
  bio?: string;
  contactValue?: string;
  actor?: string;
}

export interface UpdateLeadDto {
  campaignId?: number;
  platform?: string;
  handle?: string;
  displayName?: string;
  category?: string;
  followerCount?: number;
  postCount?: number;
  bio?: string;
  contactValue?: string;
  leadStatus?: string;
  crmStage?: string;
  reviewNotes?: string;
  actor?: string;
}

export interface ImportLeadsCsvDto {
  csvText: string;
  campaignId?: number;
  platform?: string;
  fileName?: string;
  templateName?: string;
  actor?: string;
  actions?: Array<{
    rowNumber: number;
    action: "SKIP" | "OVERWRITE" | "MERGE";
  }>;
}

export interface ImportLeadsCsvSkippedItemDto {
  rowNumber: number;
  reason: string;
  handle?: string;
  contactValue?: string;
}

export interface ImportLeadsCsvResultDto {
  imported: LeadDetailDto[];
  skipped: ImportLeadsCsvSkippedItemDto[];
}

export interface ImportLeadsCsvPreviewRowDto {
  rowNumber: number;
  campaignId: number;
  platform: string;
  handle?: string;
  displayName?: string;
  category?: string;
  followerCount?: number;
  postCount?: number;
  bio?: string;
  contactValue?: string;
  status: "READY" | "SKIP";
  reason?: string;
}

export interface ImportLeadsCsvPreviewResultDto {
  rows: ImportLeadsCsvPreviewRowDto[];
  readyCount: number;
  skipCount: number;
}

export interface LeadImportHistoryItemDto {
  id: number;
  fileName?: string;
  templateName?: string;
  campaignId?: number;
  platform?: string;
  importedCount: number;
  skippedCount: number;
  overwriteCount: number;
  mergeCount: number;
  createdAt: string;
}

export interface CreateLeadContactDto {
  contactType: string;
  contactValue: string;
  isPrimary?: boolean;
  actor?: string;
}

export interface CreateLeadPostDto {
  postUrl: string;
  caption?: string;
  postedAt?: string;
  actor?: string;
}

export interface LeadListQueryDto {
  campaignId?: string;
  platform?: string;
  leadStatus?: string;
  keyword?: string;
}
