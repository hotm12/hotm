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
}

export interface OutreachPreviewDto {
  leadId: number;
  displayName: string;
  channel: string;
  subject?: string;
  body: string;
  deliveryStatus: string;
  recommendedAction: string;
}

export interface ApproveOutreachDto {
  channel?: string;
}

export interface SendEmailDto {
  subject?: string;
  body?: string;
}

export interface QueueDmDto {
  body?: string;
}
