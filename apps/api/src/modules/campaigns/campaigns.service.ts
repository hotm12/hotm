import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolve } from "node:path";
import {
  createDefaultCampaignSeed,
  ensurePrimaryCampaignSeed
} from "../../common/dev-seed";
import { readJsonFile, writeJsonFile } from "../../common/json-file-store";
import { PrismaService } from "../../prisma/prisma.service";
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
type CampaignState = {
  nextCampaignId: number;
  nextSourceId: number;
  nextFilterId: number;
  nextRuleSetId: number;
  nextRuleId: number;
  nextChecklistTemplateId: number;
  nextChecklistItemId: number;
  campaigns: CampaignConfig[];
};

const campaignDetailArgs = Prisma.validator<Prisma.CampaignDefaultArgs>()({
  include: {
    sources: {
      orderBy: {
        id: "asc"
      }
    },
    filters: {
      orderBy: {
        id: "asc"
      }
    },
    scoringRuleSets: {
      orderBy: {
        updatedAt: "desc"
      },
      include: {
        rules: {
          orderBy: {
            sortOrder: "asc"
          }
        }
      }
    },
    reviewChecklistTemplates: {
      orderBy: {
        updatedAt: "desc"
      },
      include: {
        items: {
          orderBy: {
            sortOrder: "asc"
          }
        }
      }
    }
  }
});

type CampaignRecord = Prisma.CampaignGetPayload<typeof campaignDetailArgs>;
type RuleSetRecord = CampaignRecord["scoringRuleSets"][number];
type ChecklistTemplateRecord = CampaignRecord["reviewChecklistTemplates"][number];

function createDefaultCampaigns(): CampaignConfig[] {
  const defaultCampaign = createDefaultCampaignSeed();

  return [
    {
      id: 1,
      name: defaultCampaign.name,
      category: defaultCampaign.category,
      targetPlatform: defaultCampaign.targetPlatform,
      outreachChannelPriority: defaultCampaign.outreachChannelPriority,
      status: defaultCampaign.status,
      description: defaultCampaign.description,
      sources: defaultCampaign.sources.map((source, index) => ({
        id: index + 1,
        sourceType: source.sourceType,
        sourceValue: source.sourceValue,
        notes: source.notes
      })),
      filters: defaultCampaign.filters.map((filter, index) => ({
        id: index + 1,
        filterType: filter.filterType,
        operator: filter.operator,
        filterValue: filter.filterValue
      })),
      scoringRuleSet: {
        id: 1,
        name: defaultCampaign.scoringRuleSet.name,
        isActive: defaultCampaign.scoringRuleSet.isActive,
        rules: defaultCampaign.scoringRuleSet.rules.map((rule, index) => ({
          id: index + 1,
          ruleName: rule.ruleName,
          scoreDelta: rule.scoreDelta,
          ruleType: rule.ruleType,
          conditionSummary: rule.conditionSummary
        }))
      },
      reviewChecklistTemplate: {
        id: 1,
        name: defaultCampaign.reviewChecklistTemplate.name,
        isActive: defaultCampaign.reviewChecklistTemplate.isActive,
        items: defaultCampaign.reviewChecklistTemplate.items.map((item, index) => ({
          id: index + 1,
          label: item.label,
          itemType: item.itemType,
          isRequired: item.isRequired
        }))
      }
    }
  ];
}

function createEmptyScoringRuleSet(
  id: number,
  name: string
): ScoringRuleSetDto {
  return {
    id,
    name,
    isActive: true,
    rules: []
  };
}

function createEmptyReviewChecklistTemplate(
  id: number,
  name: string
): ReviewChecklistTemplateDto {
  return {
    id,
    name,
    isActive: true,
    items: []
  };
}

@Injectable()
export class CampaignsService {
  private readonly stateFilePath = resolve(process.cwd(), ".data", "campaigns.json");
  private readonly databaseEnabled = Boolean(process.env.DATABASE_URL?.trim());
  private nextCampaignId = 2;
  private nextSourceId = 3;
  private nextFilterId = 3;
  private nextRuleSetId = 2;
  private nextRuleId = 4;
  private nextChecklistTemplateId = 2;
  private nextChecklistItemId = 4;
  private readonly campaigns: CampaignConfig[] = createDefaultCampaigns();
  private seedPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {
    if (!this.databaseEnabled) {
      this.loadState();
    }
  }

  async findAll(): Promise<CampaignSummaryDto[]> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const campaigns = await this.prisma.campaign.findMany({
        ...campaignDetailArgs,
        orderBy: {
          id: "asc"
        }
      });

      return campaigns.map((campaign) => this.toSummary(this.toDetailFromRecord(campaign)));
    }

    return this.campaigns.map((campaign) => this.toSummary(campaign));
  }

  async findOne(id: number): Promise<CampaignDetailDto> {
    if (this.databaseEnabled) {
      return this.requireCampaignFromDatabase(id);
    }

    return this.requireCampaignFromState(id);
  }

  async create(payload: CreateCampaignDto): Promise<CampaignDetailDto> {
    if (this.databaseEnabled) {
      const campaign = await this.prisma.campaign.create({
        ...campaignDetailArgs,
        data: {
          name: payload.name,
          category: payload.category,
          targetPlatform: payload.targetPlatform,
          outreachChannelPriority: payload.outreachChannelPriority,
          status: payload.status ?? "ACTIVE",
          description: payload.description,
          scoringRuleSets: {
            create: {
              name: `${payload.name} Rule Set`,
              isActive: true
            }
          },
          reviewChecklistTemplates: {
            create: {
              name: `${payload.name} Checklist`,
              isActive: true
            }
          }
        }
      });

      return this.toDetailFromRecord(campaign);
    }

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
      scoringRuleSet: createEmptyScoringRuleSet(
        this.nextRuleSetId++,
        `${payload.name} Rule Set`
      ),
      reviewChecklistTemplate: createEmptyReviewChecklistTemplate(
        this.nextChecklistTemplateId++,
        `${payload.name} Checklist`
      )
    };

    this.campaigns.push(campaign);
    this.saveState();
    return campaign;
  }

  async update(id: number, payload: UpdateCampaignDto): Promise<CampaignDetailDto> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const campaign = await this.prisma.campaign.update({
        ...campaignDetailArgs,
        where: {
          id: BigInt(id)
        },
        data: {
          name: payload.name,
          category: payload.category,
          targetPlatform: payload.targetPlatform,
          outreachChannelPriority: payload.outreachChannelPriority,
          status: payload.status,
          description: payload.description
        }
      });

      return this.toDetailFromRecord(campaign);
    }

    const campaign = this.requireCampaignFromState(id);

    Object.assign(campaign, {
      name: payload.name ?? campaign.name,
      category: payload.category ?? campaign.category,
      targetPlatform: payload.targetPlatform ?? campaign.targetPlatform,
      outreachChannelPriority:
        payload.outreachChannelPriority ?? campaign.outreachChannelPriority,
      status: payload.status ?? campaign.status,
      description: payload.description ?? campaign.description
    });

    this.saveState();
    return campaign;
  }

  async listSources(id: number): Promise<CampaignSourceDto[]> {
    if (this.databaseEnabled) {
      const campaign = await this.requireCampaignFromDatabase(id);
      return campaign.sources;
    }

    return this.requireCampaignFromState(id).sources;
  }

  async addSource(
    id: number,
    payload: CreateCampaignSourceDto
  ): Promise<CampaignSourceDto> {
    if (this.databaseEnabled) {
      await this.requireCampaignRecord(id);
      const source = await this.prisma.campaignSource.create({
        data: {
          campaignId: BigInt(id),
          sourceType: payload.sourceType,
          sourceValue: payload.sourceValue,
          notes: payload.notes
        }
      });

      return {
        id: this.toNumber(source.id),
        sourceType: source.sourceType,
        sourceValue: source.sourceValue,
        notes: source.notes ?? undefined
      };
    }

    const campaign = this.requireCampaignFromState(id);
    const source: CampaignSourceDto = {
      id: this.nextSourceId++,
      sourceType: payload.sourceType,
      sourceValue: payload.sourceValue,
      notes: payload.notes
    };

    campaign.sources.push(source);
    this.saveState();
    return source;
  }

  async listFilters(id: number): Promise<CampaignFilterDto[]> {
    if (this.databaseEnabled) {
      const campaign = await this.requireCampaignFromDatabase(id);
      return campaign.filters;
    }

    return this.requireCampaignFromState(id).filters;
  }

  async addFilter(
    id: number,
    payload: CreateCampaignFilterDto
  ): Promise<CampaignFilterDto> {
    if (this.databaseEnabled) {
      await this.requireCampaignRecord(id);
      const filter = await this.prisma.campaignFilter.create({
        data: {
          campaignId: BigInt(id),
          filterType: payload.filterType,
          operator: payload.operator,
          filterValue: payload.filterValue
        }
      });

      return {
        id: this.toNumber(filter.id),
        filterType: filter.filterType,
        operator: filter.operator,
        filterValue: filter.filterValue
      };
    }

    const campaign = this.requireCampaignFromState(id);
    const filter: CampaignFilterDto = {
      id: this.nextFilterId++,
      filterType: payload.filterType,
      operator: payload.operator,
      filterValue: payload.filterValue
    };

    campaign.filters.push(filter);
    this.saveState();
    return filter;
  }

  async getScoringRuleSet(id: number): Promise<ScoringRuleSetDto> {
    if (this.databaseEnabled) {
      return (await this.requireCampaignFromDatabase(id)).scoringRuleSet;
    }

    return this.requireCampaignFromState(id).scoringRuleSet;
  }

  async upsertScoringRuleSet(
    id: number,
    payload: UpsertScoringRuleSetDto
  ): Promise<ScoringRuleSetDto> {
    if (this.databaseEnabled) {
      const campaign = await this.requireCampaignRecord(id);
      const currentRuleSet = campaign.scoringRuleSets[0];

      const ruleSet = await this.prisma.$transaction(async (tx) => {
        if (currentRuleSet) {
          await tx.scoringRule.deleteMany({
            where: {
              ruleSetId: currentRuleSet.id
            }
          });

          return tx.scoringRuleSet.update({
            where: {
              id: currentRuleSet.id
            },
            data: {
              name: payload.name,
              isActive: payload.isActive,
              rules: {
                create: payload.rules.map((rule, index) => ({
                  ruleName: rule.ruleName,
                  scoreDelta: rule.scoreDelta,
                  ruleType: rule.ruleType,
                  conditionJson: {
                    summary: rule.conditionSummary
                  },
                  sortOrder: index
                }))
              }
            },
            include: {
              rules: {
                orderBy: {
                  sortOrder: "asc"
                }
              }
            }
          });
        }

        return tx.scoringRuleSet.create({
          data: {
            campaignId: BigInt(id),
            name: payload.name,
            isActive: payload.isActive,
            rules: {
              create: payload.rules.map((rule, index) => ({
                ruleName: rule.ruleName,
                scoreDelta: rule.scoreDelta,
                ruleType: rule.ruleType,
                conditionJson: {
                  summary: rule.conditionSummary
                },
                sortOrder: index
              }))
            }
          },
          include: {
            rules: {
              orderBy: {
                sortOrder: "asc"
              }
            }
          }
        });
      });

      return this.toRuleSetDto(ruleSet);
    }

    const campaign = this.requireCampaignFromState(id);

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

    this.saveState();
    return campaign.scoringRuleSet;
  }

  async getReviewChecklistTemplate(
    id: number
  ): Promise<ReviewChecklistTemplateDto> {
    if (this.databaseEnabled) {
      return (await this.requireCampaignFromDatabase(id)).reviewChecklistTemplate;
    }

    return this.requireCampaignFromState(id).reviewChecklistTemplate;
  }

  async upsertReviewChecklistTemplate(
    id: number,
    payload: UpsertReviewChecklistTemplateDto
  ): Promise<ReviewChecklistTemplateDto> {
    if (this.databaseEnabled) {
      const campaign = await this.requireCampaignRecord(id);
      const currentTemplate = campaign.reviewChecklistTemplates[0];

      const template = await this.prisma.$transaction(async (tx) => {
        if (currentTemplate) {
          await tx.reviewChecklistItem.deleteMany({
            where: {
              templateId: currentTemplate.id
            }
          });

          return tx.reviewChecklistTemplate.update({
            where: {
              id: currentTemplate.id
            },
            data: {
              name: payload.name,
              isActive: payload.isActive,
              items: {
                create: payload.items.map((item, index) => ({
                  label: item.label,
                  itemType: item.itemType,
                  isRequired: item.isRequired,
                  sortOrder: index
                }))
              }
            },
            include: {
              items: {
                orderBy: {
                  sortOrder: "asc"
                }
              }
            }
          });
        }

        return tx.reviewChecklistTemplate.create({
          data: {
            campaignId: BigInt(id),
            name: payload.name,
            isActive: payload.isActive,
            items: {
              create: payload.items.map((item, index) => ({
                label: item.label,
                itemType: item.itemType,
                isRequired: item.isRequired,
                sortOrder: index
              }))
            }
          },
          include: {
            items: {
              orderBy: {
                sortOrder: "asc"
              }
            }
          }
        });
      });

      return this.toReviewChecklistTemplateDto(template);
    }

    const campaign = this.requireCampaignFromState(id);

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

    this.saveState();
    return campaign.reviewChecklistTemplate;
  }

  private toSummary(campaign: CampaignDetailDto): CampaignSummaryDto {
    return {
      id: campaign.id,
      name: campaign.name,
      category: campaign.category,
      targetPlatform: campaign.targetPlatform,
      outreachChannelPriority: campaign.outreachChannelPriority,
      status: campaign.status,
      description: campaign.description,
      sourceCount: campaign.sources.length,
      filterCount: campaign.filters.length
    };
  }

  private async requireCampaignFromDatabase(id: number): Promise<CampaignDetailDto> {
    return this.toDetailFromRecord(await this.requireCampaignRecord(id));
  }

  private async requireCampaignRecord(id: number): Promise<CampaignRecord> {
    await this.ensureDatabaseSeed();
    const campaign = await this.prisma.campaign.findUnique({
      ...campaignDetailArgs,
      where: {
        id: BigInt(id)
      }
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }

    return campaign;
  }

  private requireCampaignFromState(id: number): CampaignConfig {
    const campaign = this.campaigns.find((item) => item.id === id);

    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }

    return campaign;
  }

  private async ensureDatabaseSeed() {
    if (!this.databaseEnabled) {
      return;
    }

    if (!this.seedPromise) {
      this.seedPromise = (async () => {
        await ensurePrimaryCampaignSeed(this.prisma);
      })();
    }

    await this.seedPromise;
  }

  private toDetailFromRecord(campaign: CampaignRecord): CampaignDetailDto {
    const scoringRuleSet = campaign.scoringRuleSets[0]
      ? this.toRuleSetDto(campaign.scoringRuleSets[0])
      : createEmptyScoringRuleSet(0, `${campaign.name} Rule Set`);

    const reviewChecklistTemplate = campaign.reviewChecklistTemplates[0]
      ? this.toReviewChecklistTemplateDto(campaign.reviewChecklistTemplates[0])
      : createEmptyReviewChecklistTemplate(0, `${campaign.name} Checklist`);

    return {
      id: this.toNumber(campaign.id),
      name: campaign.name,
      category: campaign.category ?? undefined,
      targetPlatform: campaign.targetPlatform,
      outreachChannelPriority: campaign.outreachChannelPriority,
      status: campaign.status,
      description: campaign.description ?? undefined,
      sources: campaign.sources.map((source) => ({
        id: this.toNumber(source.id),
        sourceType: source.sourceType,
        sourceValue: source.sourceValue,
        notes: source.notes ?? undefined
      })),
      filters: campaign.filters.map((filter) => ({
        id: this.toNumber(filter.id),
        filterType: filter.filterType,
        operator: filter.operator,
        filterValue: filter.filterValue
      })),
      scoringRuleSet,
      reviewChecklistTemplate
    };
  }

  private toRuleSetDto(ruleSet: RuleSetRecord): ScoringRuleSetDto {
    return {
      id: this.toNumber(ruleSet.id),
      name: ruleSet.name,
      isActive: ruleSet.isActive,
      rules: ruleSet.rules.map((rule) => ({
        id: this.toNumber(rule.id),
        ruleName: rule.ruleName,
        scoreDelta: rule.scoreDelta,
        ruleType: rule.ruleType,
        conditionSummary: this.toConditionSummary(rule.conditionJson)
      }))
    };
  }

  private toReviewChecklistTemplateDto(
    template: ChecklistTemplateRecord
  ): ReviewChecklistTemplateDto {
    return {
      id: this.toNumber(template.id),
      name: template.name,
      isActive: template.isActive,
      items: template.items.map((item) => ({
        id: this.toNumber(item.id),
        label: item.label,
        itemType: item.itemType,
        isRequired: item.isRequired
      }))
    };
  }

  private toConditionSummary(value: Prisma.JsonValue): string {
    if (typeof value === "string") {
      return value;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const summary = Reflect.get(value, "summary");

      if (typeof summary === "string") {
        return summary;
      }
    }

    return JSON.stringify(value);
  }

  private toNumber(value: bigint): number {
    return Number(value);
  }

  private loadState() {
    const state = readJsonFile<CampaignState | null>(this.stateFilePath, null);

    if (!state) {
      return;
    }

    this.nextCampaignId = state.nextCampaignId;
    this.nextSourceId = state.nextSourceId;
    this.nextFilterId = state.nextFilterId;
    this.nextRuleSetId = state.nextRuleSetId;
    this.nextRuleId = state.nextRuleId;
    this.nextChecklistTemplateId = state.nextChecklistTemplateId;
    this.nextChecklistItemId = state.nextChecklistItemId;
    this.campaigns.splice(0, this.campaigns.length, ...state.campaigns);
  }

  private saveState() {
    writeJsonFile<CampaignState>(this.stateFilePath, {
      nextCampaignId: this.nextCampaignId,
      nextSourceId: this.nextSourceId,
      nextFilterId: this.nextFilterId,
      nextRuleSetId: this.nextRuleSetId,
      nextRuleId: this.nextRuleId,
      nextChecklistTemplateId: this.nextChecklistTemplateId,
      nextChecklistItemId: this.nextChecklistItemId,
      campaigns: this.campaigns
    });
  }
}
