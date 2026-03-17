import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CampaignDetailDto,
  CampaignFilterDto,
  CampaignSourceDto,
  CampaignSummaryDto,
  CreateCampaignDto,
  CreateCampaignFilterDto,
  CreateCampaignSourceDto,
  ReviewChecklistTemplateDto,
  ScoringRuleSetDto,
  UpdateCampaignDto,
  UpsertReviewChecklistTemplateDto,
  UpsertScoringRuleSetDto
} from "./campaigns.types";

type CampaignConfig = CampaignDetailDto;

@Injectable()
export class CampaignsService {
  private nextCampaignId = 2;
  private nextSourceId = 3;
  private nextFilterId = 3;
  private nextRuleSetId = 2;
  private nextRuleId = 4;
  private nextChecklistTemplateId = 2;
  private nextChecklistItemId = 4;

  private readonly campaigns: CampaignConfig[] = [
    {
      id: 1,
      name: "K-Beauty Instagram Sellers",
      category: "K-Beauty",
      targetPlatform: "INSTAGRAM",
      outreachChannelPriority: "EMAIL",
      status: "ACTIVE",
      description: "공개 판매자 후보를 찾고 이메일 우선으로 검수하는 첫 캠페인",
      sources: [
        {
          id: 1,
          sourceType: "HASHTAG",
          sourceValue: "#kbeautystore",
          notes: "해시태그 기반 탐색"
        },
        {
          id: 2,
          sourceType: "SEED_ACCOUNT",
          sourceValue: "@kbeauty_example",
          notes: "유사 계정 탐색"
        }
      ],
      filters: [
        {
          id: 1,
          filterType: "FOLLOWER_COUNT",
          operator: ">=",
          filterValue: "3000"
        },
        {
          id: 2,
          filterType: "EXCLUDE_CATEGORY",
          operator: "NOT_IN",
          filterValue: "식품,의약품"
        }
      ],
      scoringRuleSet: {
        id: 1,
        name: "Default K-Beauty Score",
        isActive: true,
        rules: [
          {
            id: 1,
            ruleName: "판매 링크 존재",
            scoreDelta: 20,
            ruleType: "PROFILE",
            conditionSummary: "프로필에 쇼핑 링크 또는 자사몰 링크가 있다"
          },
          {
            id: 2,
            ruleName: "이메일 공개",
            scoreDelta: 15,
            ruleType: "CONTACT",
            conditionSummary: "공개 이메일이 확인된다"
          },
          {
            id: 3,
            ruleName: "민감 품목 감점",
            scoreDelta: -30,
            ruleType: "RISK",
            conditionSummary: "규제 가능성이 큰 민감 품목으로 보인다"
          }
        ]
      },
      reviewChecklistTemplate: {
        id: 1,
        name: "Default Review Checklist",
        isActive: true,
        items: [
          {
            id: 1,
            label: "실제 판매 계정으로 보인다",
            itemType: "BOOLEAN",
            isRequired: true
          },
          {
            id: 2,
            label: "공개 연락 채널이 존재한다",
            itemType: "BOOLEAN",
            isRequired: true
          },
          {
            id: 3,
            label: "개인화 포인트 메모를 남겼다",
            itemType: "TEXT",
            isRequired: false
          }
        ]
      }
    }
  ];

  findAll(): CampaignSummaryDto[] {
    return this.campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      category: campaign.category,
      targetPlatform: campaign.targetPlatform,
      outreachChannelPriority: campaign.outreachChannelPriority,
      status: campaign.status,
      description: campaign.description,
      sourceCount: campaign.sources.length,
      filterCount: campaign.filters.length
    }));
  }

  findOne(id: number): CampaignDetailDto {
    return this.requireCampaign(id);
  }

  create(payload: CreateCampaignDto): CampaignDetailDto {
    const campaign: CampaignConfig = {
      id: this.nextCampaignId++,
      name: payload.name,
      category: payload.category,
      targetPlatform: payload.targetPlatform,
      outreachChannelPriority: payload.outreachChannelPriority,
      status: payload.status ?? "ACTIVE",
      description: payload.description,
      sources: [],
      filters: [],
      scoringRuleSet: {
        id: this.nextRuleSetId++,
        name: `${payload.name} Rule Set`,
        isActive: true,
        rules: []
      },
      reviewChecklistTemplate: {
        id: this.nextChecklistTemplateId++,
        name: `${payload.name} Checklist`,
        isActive: true,
        items: []
      }
    };

    this.campaigns.push(campaign);
    return campaign;
  }

  update(id: number, payload: UpdateCampaignDto): CampaignDetailDto {
    const campaign = this.requireCampaign(id);

    Object.assign(campaign, {
      name: payload.name ?? campaign.name,
      category: payload.category ?? campaign.category,
      targetPlatform: payload.targetPlatform ?? campaign.targetPlatform,
      outreachChannelPriority:
        payload.outreachChannelPriority ?? campaign.outreachChannelPriority,
      status: payload.status ?? campaign.status,
      description: payload.description ?? campaign.description
    });

    return campaign;
  }

  listSources(id: number): CampaignSourceDto[] {
    return this.requireCampaign(id).sources;
  }

  addSource(id: number, payload: CreateCampaignSourceDto): CampaignSourceDto {
    const campaign = this.requireCampaign(id);
    const source: CampaignSourceDto = {
      id: this.nextSourceId++,
      sourceType: payload.sourceType,
      sourceValue: payload.sourceValue,
      notes: payload.notes
    };

    campaign.sources.push(source);
    return source;
  }

  listFilters(id: number): CampaignFilterDto[] {
    return this.requireCampaign(id).filters;
  }

  addFilter(id: number, payload: CreateCampaignFilterDto): CampaignFilterDto {
    const campaign = this.requireCampaign(id);
    const filter: CampaignFilterDto = {
      id: this.nextFilterId++,
      filterType: payload.filterType,
      operator: payload.operator,
      filterValue: payload.filterValue
    };

    campaign.filters.push(filter);
    return filter;
  }

  getScoringRuleSet(id: number): ScoringRuleSetDto {
    return this.requireCampaign(id).scoringRuleSet;
  }

  upsertScoringRuleSet(
    id: number,
    payload: UpsertScoringRuleSetDto
  ): ScoringRuleSetDto {
    const campaign = this.requireCampaign(id);

    campaign.scoringRuleSet = {
      id: campaign.scoringRuleSet?.id ?? this.nextRuleSetId++,
      name: payload.name,
      isActive: payload.isActive,
      rules: payload.rules.map((rule) => ({
        id: rule.id ?? this.nextRuleId++,
        ruleName: rule.ruleName,
        scoreDelta: rule.scoreDelta,
        ruleType: rule.ruleType,
        conditionSummary: rule.conditionSummary
      }))
    };

    return campaign.scoringRuleSet;
  }

  getReviewChecklistTemplate(id: number): ReviewChecklistTemplateDto {
    return this.requireCampaign(id).reviewChecklistTemplate;
  }

  upsertReviewChecklistTemplate(
    id: number,
    payload: UpsertReviewChecklistTemplateDto
  ): ReviewChecklistTemplateDto {
    const campaign = this.requireCampaign(id);

    campaign.reviewChecklistTemplate = {
      id:
        campaign.reviewChecklistTemplate?.id ?? this.nextChecklistTemplateId++,
      name: payload.name,
      isActive: payload.isActive,
      items: payload.items.map((item) => ({
        id: item.id ?? this.nextChecklistItemId++,
        label: item.label,
        itemType: item.itemType,
        isRequired: item.isRequired
      }))
    };

    return campaign.reviewChecklistTemplate;
  }

  private requireCampaign(id: number): CampaignConfig {
    const campaign = this.campaigns.find((item) => item.id === id);

    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }

    return campaign;
  }
}
