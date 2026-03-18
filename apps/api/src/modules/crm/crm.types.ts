export interface CrmBoardCardDto {
  leadId: number;
  displayName: string;
  handle: string;
  platform: string;
  crmStage: string;
  totalScore: number;
  scoreGrade: string;
  latestReplyType?: string;
  latestActivitySummary?: string;
}

export interface CrmBoardColumnDto {
  stage: string;
  items: CrmBoardCardDto[];
}

export interface ReplyDto {
  id: number;
  leadId: number;
  channel: string;
  replyType: string;
  messageBody: string;
  receivedAt: string;
}

export interface ActivityDto {
  id: number;
  leadId: number;
  activityType: string;
  summary: string;
  detail?: string;
  occurredAt: string;
}

export interface CreateReplyDto {
  leadId: number;
  channel: string;
  replyType: string;
  messageBody: string;
}

export interface MoveCrmStageDto {
  leadId: number;
  nextStage: string;
}

export interface CreateActivityDto {
  leadId: number;
  activityType: string;
  summary: string;
  detail?: string;
}
