export interface CampaignSourceDto {
  id: number;
  sourceType: string;
  sourceValue: string;
  notes?: string;
}

export interface CampaignFilterDto {
  id: number;
  filterType: string;
  operator: string;
  filterValue: string;
}

export interface ScoringRuleDto {
  id: number;
  ruleName: string;
  scoreDelta: number;
  ruleType: string;
  conditionSummary: string;
}

export interface ScoringRuleSetDto {
  id: number;
  name: string;
  isActive: boolean;
  rules: ScoringRuleDto[];
}

export interface ReviewChecklistItemDto {
  id: number;
  label: string;
  itemType: string;
  isRequired: boolean;
}

export interface ReviewChecklistTemplateDto {
  id: number;
  name: string;
  isActive: boolean;
  items: ReviewChecklistItemDto[];
}

export interface CampaignSummaryDto {
  id: number;
  name: string;
  category?: string;
  targetPlatform: string;
  outreachChannelPriority: string;
  status: string;
  description?: string;
  sourceCount: number;
  filterCount: number;
}

export interface CampaignDetailDto {
  id: number;
  name: string;
  category?: string;
  targetPlatform: string;
  outreachChannelPriority: string;
  status: string;
  description?: string;
  sources: CampaignSourceDto[];
  filters: CampaignFilterDto[];
  scoringRuleSet: ScoringRuleSetDto;
  reviewChecklistTemplate: ReviewChecklistTemplateDto;
}

export interface CreateCampaignDto {
  name: string;
  category?: string;
  targetPlatform: string;
  outreachChannelPriority: string;
  status?: string;
  description?: string;
}

export interface UpdateCampaignDto {
  name?: string;
  category?: string;
  targetPlatform?: string;
  outreachChannelPriority?: string;
  status?: string;
  description?: string;
}

export interface CreateCampaignSourceDto {
  sourceType: string;
  sourceValue: string;
  notes?: string;
}

export interface CreateCampaignFilterDto {
  filterType: string;
  operator: string;
  filterValue: string;
}

export interface UpsertScoringRuleSetDto {
  name: string;
  isActive: boolean;
  rules: Array<{
    id?: number;
    ruleName: string;
    scoreDelta: number;
    ruleType: string;
    conditionSummary: string;
  }>;
}

export interface UpsertReviewChecklistTemplateDto {
  name: string;
  isActive: boolean;
  items: Array<{
    id?: number;
    label: string;
    itemType: string;
    isRequired: boolean;
  }>;
}
