export interface AuditLogItemDto {
  id: number;
  entityType: string;
  entityId: number;
  actionType: string;
  actor?: string;
  summary?: string;
  detail?: string;
  createdAt: string;
}

export interface CreateAuditLogDto {
  entityType: string;
  entityId: number;
  actionType: string;
  actor?: string;
  summary?: string;
  detail?: string;
  beforeData?: unknown;
  afterData?: unknown;
  createdAt?: string;
}
