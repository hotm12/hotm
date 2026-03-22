export interface OutreachQueueItemDto {
  leadId: number;
  displayName: string;
  handle: string;
  platform: string;
  channel: string;
  deliveryStatus: string;
  subject?: string;
  previewText: string;
  approvedAt?: string;
  sentAt?: string;
  safetyChecks: string[];
}

export interface OutreachPreviewDto {
  leadId: number;
  displayName: string;
  channel: string;
  subject?: string;
  body: string;
  deliveryStatus: string;
  recommendedAction: string;
  safetyChecks: string[];
  canApprove: boolean;
  canSendEmail: boolean;
  canQueueDm: boolean;
}

export interface ApproveOutreachDto {
  channel?: string;
  actor?: string;
  approvalNote?: string;
  confirmed?: boolean;
}

export interface SendEmailDto {
  subject?: string;
  body?: string;
  actor?: string;
  approvalNote?: string;
  confirmed?: boolean;
}

export interface QueueDmDto {
  body?: string;
  actor?: string;
  approvalNote?: string;
  confirmed?: boolean;
}
