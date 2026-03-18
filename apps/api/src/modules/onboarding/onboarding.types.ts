export interface OnboardingSummaryDto {
  leadId: number;
  displayName: string;
  handle: string;
  platform: string;
  onboardingStatus: string;
  nextAction?: string;
  updatedAt?: string;
}

export interface OnboardingDetailDto extends OnboardingSummaryDto {
  notes?: string;
  startedAt?: string;
  crmStage?: string;
}

export interface StartOnboardingDto {
  leadId: number;
  onboardingStatus?: string;
  nextAction?: string;
  notes?: string;
}

export interface UpdateOnboardingDto {
  onboardingStatus?: string;
  nextAction?: string;
  notes?: string;
}
