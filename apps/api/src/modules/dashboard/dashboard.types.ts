import { AuditLogItemDto } from "../audit-log/audit-log.types";

export interface DashboardMetricDto {
  label: string;
  value: number;
  description: string;
}

export interface DashboardCountDto {
  label: string;
  value: number;
}

export interface DashboardOnboardingItemDto {
  leadId: number;
  displayName: string;
  onboardingStatus: string;
  nextAction?: string;
  updatedAt?: string;
}

export interface DashboardStorageDto {
  storageMode: "DATABASE" | "JSON_FALLBACK";
  devSeedEnabled: boolean;
  databaseUrlConfigured: boolean;
}

export interface DashboardDto {
  metrics: DashboardMetricDto[];
  leadStatusCounts: DashboardCountDto[];
  crmStageCounts: DashboardCountDto[];
  onboardingItems: DashboardOnboardingItemDto[];
  recentActivity: AuditLogItemDto[];
  storage: DashboardStorageDto;
}
