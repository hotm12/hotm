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
}

export interface LeadListQueryDto {
  campaignId?: string;
  platform?: string;
  leadStatus?: string;
  keyword?: string;
}
