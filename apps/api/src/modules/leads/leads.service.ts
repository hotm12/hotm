import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolve } from "node:path";
import {
  createDefaultLeadSeeds,
  defaultChecklistLabels,
  ensurePrimaryCampaignSeed
} from "../../common/dev-seed";
import { readJsonFile, writeJsonFile } from "../../common/json-file-store";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CreateLeadDto,
  LeadDetailDto,
  LeadListQueryDto,
  LeadScoreDto,
  LeadSummaryDto,
  ReviewChecklistAnswerDto
} from "./leads.types";

type LeadRecord = Omit<LeadDetailDto, "score" | "totalScore" | "scoreGrade">;
type LeadState = {
  nextLeadId: number;
  nextContactId: number;
  nextReviewAnswerId: number;
  leads: LeadRecord[];
};

const leadDetailArgs = Prisma.validator<Prisma.LeadDefaultArgs>()({
  include: {
    campaign: {
      include: {
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
    },
    contacts: {
      orderBy: {
        id: "asc"
      }
    },
    posts: {
      orderBy: {
        id: "asc"
      }
    },
    checklistAnswers: {
      orderBy: {
        id: "asc"
      },
      include: {
        checklistItem: true
      }
    }
  }
});

type LeadDbRecord = Prisma.LeadGetPayload<typeof leadDetailArgs>;

@Injectable()
export class LeadsService {
  private readonly stateFilePath = resolve(process.cwd(), ".data", "leads.json");
  private readonly databaseEnabled = Boolean(process.env.DATABASE_URL?.trim());
  private nextLeadId = 4;
  private nextContactId = 5;
  private nextReviewAnswerId = 8;
  private readonly leads: LeadRecord[] = createDefaultLeadSeeds();
  private seedPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {
    if (!this.databaseEnabled) {
      this.loadState();
    }
  }

  async findAll(query: LeadListQueryDto): Promise<LeadSummaryDto[]> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const leads = await this.prisma.lead.findMany({
        ...leadDetailArgs,
        where: this.buildDatabaseWhere(query),
        orderBy: {
          id: "desc"
        }
      });

      return leads.map((lead) => this.toSummaryFromDb(lead));
    }

    return this.leads
      .filter((lead) => this.matchesQuery(lead, query))
      .map((lead) => this.toSummaryFromState(lead));
  }

  async findOne(id: number): Promise<LeadDetailDto> {
    if (this.databaseEnabled) {
      return this.toDetailFromDb(await this.requireLeadRecord(id));
    }

    return this.toDetailFromState(this.requireLeadFromState(id));
  }

  async create(payload: CreateLeadDto): Promise<LeadDetailDto> {
    const contactValue = payload.contactValue?.trim();

    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      await this.requireCampaign(payload.campaignId);

      const lead = await this.prisma.lead.create({
        ...leadDetailArgs,
        data: {
          campaignId: BigInt(payload.campaignId),
          platform: payload.platform,
          handle: payload.handle,
          displayName: payload.displayName,
          category: payload.category,
          followerCount: payload.followerCount,
          postCount: payload.postCount,
          leadStatus: "NEW",
          crmStage: "CONTACTED",
          riskFlags: [],
          bio: payload.bio,
          reviewNotes: "New lead created",
          contacts: contactValue
            ? {
                create: {
                  contactType: "EMAIL",
                  contactValue,
                  isPrimary: true
                }
              }
            : undefined
        }
      });

      return this.toDetailFromDb(lead);
    }

    const record: LeadRecord = {
      id: this.nextLeadId++,
      campaignId: payload.campaignId,
      platform: payload.platform,
      handle: payload.handle,
      displayName: payload.displayName,
      category: payload.category,
      followerCount: payload.followerCount,
      postCount: payload.postCount,
      leadStatus: "NEW",
      crmStage: "CONTACTED",
      riskFlags: [],
      bio: payload.bio,
      reviewNotes: "New lead created",
      reviewChecklistAnswers: [
        {
          id: this.nextReviewAnswerId++,
          label: defaultChecklistLabels[0],
          passed: null,
          note: ""
        },
        {
          id: this.nextReviewAnswerId++,
          label: defaultChecklistLabels[1],
          passed: Boolean(contactValue),
          note: contactValue ? "Contact value was provided at registration." : ""
        }
      ],
      contacts: contactValue
        ? [
            {
              id: this.nextContactId++,
              contactType: "EMAIL",
              contactValue,
              isPrimary: true
            }
          ]
        : [],
      posts: []
    };

    this.leads.unshift(record);
    this.saveState();
    return this.toDetailFromState(record);
  }

  async recalculateScore(id: number): Promise<LeadScoreDto> {
    if (this.databaseEnabled) {
      const lead = await this.requireLeadRecord(id);
      return this.buildScore({
        followerCount: lead.followerCount,
        postCount: lead.postCount,
        contacts: lead.contacts,
        riskFlags: this.toRiskFlags(lead.riskFlags)
      });
    }

    return this.buildScore(this.requireLeadFromState(id));
  }

  async listReviewQueue(): Promise<LeadDetailDto[]> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const leads = await this.prisma.lead.findMany({
        ...leadDetailArgs,
        where: {
          leadStatus: {
            in: ["NEW", "REVIEW_READY", "ON_HOLD"]
          }
        },
        orderBy: {
          id: "desc"
        }
      });

      return leads.map((lead) => this.toDetailFromDb(lead));
    }

    return this.leads
      .filter((lead) => ["NEW", "REVIEW_READY", "ON_HOLD"].includes(lead.leadStatus))
      .map((lead) => this.toDetailFromState(lead));
  }

  async listOutreachCandidates(): Promise<LeadDetailDto[]> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const leads = await this.prisma.lead.findMany({
        ...leadDetailArgs,
        where: {
          leadStatus: "APPROVED"
        },
        orderBy: {
          id: "desc"
        }
      });

      return leads.map((lead) => this.toDetailFromDb(lead));
    }

    return this.leads
      .filter((lead) => lead.leadStatus === "APPROVED")
      .map((lead) => this.toDetailFromState(lead));
  }

  async listCrmLeads(): Promise<LeadDetailDto[]> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const leads = await this.prisma.lead.findMany({
        ...leadDetailArgs,
        where: {
          crmStage: {
            not: null
          }
        },
        orderBy: {
          id: "desc"
        }
      });

      return leads.map((lead) => this.toDetailFromDb(lead));
    }

    return this.leads
      .filter((lead) => Boolean(lead.crmStage))
      .map((lead) => this.toDetailFromState(lead));
  }

  async moveCrmStage(id: number, nextStage: string): Promise<LeadDetailDto> {
    if (this.databaseEnabled) {
      const lead = await this.prisma.lead.update({
        ...leadDetailArgs,
        where: {
          id: BigInt(id)
        },
        data: {
          crmStage: nextStage
        }
      });

      return this.toDetailFromDb(lead);
    }

    const lead = this.requireLeadFromState(id);
    lead.crmStage = nextStage;
    this.saveState();
    return this.toDetailFromState(lead);
  }

  async submitReview(
    id: number,
    payload: {
      decisionStatus: string;
      reviewNotes?: string;
      checklistAnswers: Array<{
        label: string;
        passed: boolean | null;
        note?: string;
      }>;
    }
  ): Promise<LeadDetailDto> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const lead = await this.requireLeadRecord(id);

      await this.prisma.$transaction(async (tx) => {
        let template = await tx.reviewChecklistTemplate.findFirst({
          where: {
            campaignId: lead.campaignId
          },
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
        });

        if (!template) {
          template = await tx.reviewChecklistTemplate.create({
            data: {
              campaignId: lead.campaignId,
              name: "Lead Review Checklist",
              isActive: true
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

        const itemByLabel = new Map(template.items.map((item) => [item.label, item]));
        let nextSortOrder = template.items.length;
        const resolvedItems: Array<{
          itemId: bigint;
          answer: (typeof payload.checklistAnswers)[number];
        }> = [];

        for (const answer of payload.checklistAnswers) {
          let item = itemByLabel.get(answer.label);

          if (!item) {
            item = await tx.reviewChecklistItem.create({
              data: {
                templateId: template.id,
                label: answer.label,
                itemType: answer.passed === null ? "TEXT" : "BOOLEAN",
                isRequired: false,
                sortOrder: nextSortOrder++
              }
            });
            itemByLabel.set(answer.label, item);
          }

          resolvedItems.push({
            itemId: item.id,
            answer
          });
        }

        await tx.reviewChecklistAnswer.deleteMany({
          where: {
            leadId: BigInt(id)
          }
        });

        await tx.lead.update({
          where: {
            id: BigInt(id)
          },
          data: {
            leadStatus: payload.decisionStatus,
            reviewNotes: payload.reviewNotes,
            checklistAnswers: {
              create: resolvedItems.map(({ itemId, answer }) => ({
                checklistItem: {
                  connect: {
                    id: itemId
                  }
                },
                answerValue: this.toAnswerValue(answer.passed),
                note: answer.note
              }))
            }
          }
        });
      });

      return this.findOne(id);
    }

    const lead = this.requireLeadFromState(id);
    lead.leadStatus = payload.decisionStatus;
    lead.reviewNotes = payload.reviewNotes ?? lead.reviewNotes;
    lead.reviewChecklistAnswers = payload.checklistAnswers.map((answer) => ({
      id: this.nextReviewAnswerId++,
      label: answer.label,
      passed: answer.passed,
      note: answer.note
    }));

    this.saveState();
    return this.toDetailFromState(lead);
  }

  private matchesQuery(lead: LeadRecord, query: LeadListQueryDto) {
    if (query.campaignId && lead.campaignId !== Number(query.campaignId)) {
      return false;
    }

    if (query.platform && lead.platform !== query.platform) {
      return false;
    }

    if (query.leadStatus && lead.leadStatus !== query.leadStatus) {
      return false;
    }

    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      const haystack = `${lead.handle} ${lead.displayName} ${lead.category ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    }

    return true;
  }

  private buildDatabaseWhere(query: LeadListQueryDto): Prisma.LeadWhereInput {
    const where: Prisma.LeadWhereInput = {};

    if (query.campaignId) {
      where.campaignId = BigInt(Number(query.campaignId));
    }

    if (query.platform) {
      where.platform = query.platform;
    }

    if (query.leadStatus) {
      where.leadStatus = query.leadStatus;
    }

    if (query.keyword) {
      where.OR = [
        {
          handle: {
            contains: query.keyword,
            mode: "insensitive"
          }
        },
        {
          displayName: {
            contains: query.keyword,
            mode: "insensitive"
          }
        },
        {
          category: {
            contains: query.keyword,
            mode: "insensitive"
          }
        }
      ];
    }

    return where;
  }

  private requireLeadFromState(id: number): LeadRecord {
    const lead = this.leads.find((item) => item.id === id);

    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    return lead;
  }

  private async requireLeadRecord(id: number): Promise<LeadDbRecord> {
    await this.ensureDatabaseSeed();
    const lead = await this.prisma.lead.findUnique({
      ...leadDetailArgs,
      where: {
        id: BigInt(id)
      }
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    return lead;
  }

  private toSummaryFromState(lead: LeadRecord): LeadSummaryDto {
    const score = this.buildScore(lead);

    return {
      id: lead.id,
      campaignId: lead.campaignId,
      platform: lead.platform,
      handle: lead.handle,
      displayName: lead.displayName,
      category: lead.category,
      followerCount: lead.followerCount,
      leadStatus: lead.leadStatus,
      crmStage: lead.crmStage,
      totalScore: score.totalScore,
      scoreGrade: score.scoreGrade,
      riskFlags: lead.riskFlags
    };
  }

  private toDetailFromState(lead: LeadRecord): LeadDetailDto {
    return {
      ...this.toSummaryFromState(lead),
      bio: lead.bio,
      postCount: lead.postCount,
      reviewNotes: lead.reviewNotes,
      contacts: lead.contacts,
      posts: lead.posts,
      score: this.buildScore(lead),
      reviewChecklistAnswers: lead.reviewChecklistAnswers
    };
  }

  private toSummaryFromDb(lead: LeadDbRecord): LeadSummaryDto {
    const score = this.buildScore({
      followerCount: lead.followerCount,
      postCount: lead.postCount,
      contacts: lead.contacts,
      riskFlags: this.toRiskFlags(lead.riskFlags)
    });

    return {
      id: this.toNumber(lead.id),
      campaignId: this.toNumber(lead.campaignId),
      platform: lead.platform,
      handle: lead.handle,
      displayName: lead.displayName ?? lead.handle,
      category: lead.category ?? undefined,
      followerCount: lead.followerCount ?? undefined,
      leadStatus: lead.leadStatus,
      crmStage: lead.crmStage ?? undefined,
      totalScore: score.totalScore,
      scoreGrade: score.scoreGrade,
      riskFlags: this.toRiskFlags(lead.riskFlags)
    };
  }

  private toDetailFromDb(lead: LeadDbRecord): LeadDetailDto {
    return {
      ...this.toSummaryFromDb(lead),
      bio: lead.bio ?? undefined,
      postCount: lead.postCount ?? undefined,
      reviewNotes: lead.reviewNotes ?? undefined,
      contacts: lead.contacts.map((contact) => ({
        id: this.toNumber(contact.id),
        contactType: contact.contactType,
        contactValue: contact.contactValue,
        isPrimary: contact.isPrimary
      })),
      posts: lead.posts.map((post) => ({
        id: this.toNumber(post.id),
        postUrl: post.postUrl ?? "",
        caption: post.caption ?? "",
        postedAt: post.postedAt?.toISOString() ?? ""
      })),
      score: this.buildScore({
        followerCount: lead.followerCount,
        postCount: lead.postCount,
        contacts: lead.contacts,
        riskFlags: this.toRiskFlags(lead.riskFlags)
      }),
      reviewChecklistAnswers: this.mergeChecklistAnswers(lead)
    };
  }

  private mergeChecklistAnswers(lead: LeadDbRecord): ReviewChecklistAnswerDto[] {
    const templateItems =
      lead.campaign.reviewChecklistTemplates[0]?.items ?? [];
    const answersByItemId = new Map(
      lead.checklistAnswers.map((answer) => [
        answer.checklistItemId.toString(),
        answer
      ])
    );

    const merged = templateItems.map((item) => {
      const answer = answersByItemId.get(item.id.toString());

      return {
        id: answer ? this.toNumber(answer.id) : this.toNumber(item.id),
        label: item.label,
        passed: answer ? this.fromAnswerValue(answer.answerValue) : null,
        note: answer?.note ?? ""
      };
    });

    const templateItemIds = new Set(templateItems.map((item) => item.id.toString()));

    for (const answer of lead.checklistAnswers) {
      if (templateItemIds.has(answer.checklistItemId.toString())) {
        continue;
      }

      merged.push({
        id: this.toNumber(answer.id),
        label: answer.checklistItem.label,
        passed: this.fromAnswerValue(answer.answerValue),
        note: answer.note ?? ""
      });
    }

    return merged;
  }

  private buildScore(lead: {
    followerCount?: number | null;
    postCount?: number | null;
    contacts: Array<{ contactType: string }>;
    riskFlags: string[];
  }): LeadScoreDto {
    const scoreBreakdown: LeadScoreDto["scoreBreakdown"] = [];
    let totalScore = 0;

    if ((lead.followerCount ?? 0) >= 10000) {
      scoreBreakdown.push({
        label: "Audience size",
        scoreDelta: 25,
        reason: "Follower count is at least 10,000."
      });
      totalScore += 25;
    } else if ((lead.followerCount ?? 0) >= 3000) {
      scoreBreakdown.push({
        label: "Audience size",
        scoreDelta: 15,
        reason: "Follower count is at least 3,000."
      });
      totalScore += 15;
    }

    if (lead.contacts.some((item) => item.contactType === "EMAIL")) {
      scoreBreakdown.push({
        label: "Public contact",
        scoreDelta: 15,
        reason: "A reachable email contact is available."
      });
      totalScore += 15;
    }

    if ((lead.postCount ?? 0) >= 100) {
      scoreBreakdown.push({
        label: "Content activity",
        scoreDelta: 10,
        reason: "Posting history is active enough for outreach."
      });
      totalScore += 10;
    }

    if (lead.riskFlags.length > 0) {
      scoreBreakdown.push({
        label: "Risk signal",
        scoreDelta: -10,
        reason: "Manual review is still needed for at least one risk flag."
      });
      totalScore -= 10;
    }

    const scoreGrade =
      totalScore >= 40 ? "A" : totalScore >= 25 ? "B" : totalScore >= 10 ? "C" : "D";

    return {
      totalScore,
      scoreGrade,
      scoreBreakdown
    };
  }

  private async ensureDatabaseSeed() {
    if (!this.databaseEnabled) {
      return;
    }

    if (!this.seedPromise) {
      this.seedPromise = (async () => {
        const leadCount = await this.prisma.lead.count();

        if (leadCount > 0) {
          return;
        }

        const campaign = await ensurePrimaryCampaignSeed(this.prisma);
        const template = campaign.reviewChecklistTemplates[0];

        const itemByLabel = new Map(template.items.map((item) => [item.label, item]));

        for (const lead of createDefaultLeadSeeds()) {
          await this.prisma.lead.create({
            data: {
              campaignId: campaign.id,
              platform: lead.platform,
              handle: lead.handle,
              displayName: lead.displayName,
              category: lead.category,
              followerCount: lead.followerCount,
              postCount: lead.postCount,
              leadStatus: lead.leadStatus,
              crmStage: lead.crmStage,
              riskFlags: lead.riskFlags,
              bio: lead.bio,
              reviewNotes: lead.reviewNotes,
              contacts: {
                create: lead.contacts.map((contact) => ({
                  contactType: contact.contactType,
                  contactValue: contact.contactValue,
                  isPrimary: contact.isPrimary
                }))
              },
              posts: {
                create: lead.posts.map((post) => ({
                  postUrl: post.postUrl,
                  caption: post.caption,
                  postedAt: post.postedAt ? new Date(post.postedAt) : undefined
                }))
              },
              checklistAnswers: {
                create: lead.reviewChecklistAnswers
                  .map((answer) => {
                    const item = itemByLabel.get(answer.label);

                    if (!item) {
                      return null;
                    }

                    return {
                      checklistItem: {
                        connect: {
                          id: item.id
                        }
                      },
                      answerValue: this.toAnswerValue(answer.passed),
                      note: answer.note
                    };
                  })
                  .filter((answer): answer is NonNullable<typeof answer> => Boolean(answer))
              }
            }
          });
        }
      })();
    }

    await this.seedPromise;
  }

  private async requireCampaign(id: number) {
    const campaign = await this.prisma.campaign.findUnique({
      where: {
        id: BigInt(id)
      }
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }
  }

  private toRiskFlags(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === "string");
  }

  private toAnswerValue(value: boolean | null) {
    if (value === true) {
      return "PASS";
    }

    if (value === false) {
      return "FAIL";
    }

    return "PENDING";
  }

  private fromAnswerValue(value: string | null | undefined) {
    if (value === "PASS") {
      return true;
    }

    if (value === "FAIL") {
      return false;
    }

    return null;
  }

  private toNumber(value: bigint): number {
    return Number(value);
  }

  private loadState() {
    const state = readJsonFile<LeadState | null>(this.stateFilePath, null);

    if (!state) {
      return;
    }

    this.nextLeadId = state.nextLeadId;
    this.nextContactId = state.nextContactId;
    this.nextReviewAnswerId = state.nextReviewAnswerId;
    this.leads.splice(0, this.leads.length, ...state.leads);
  }

  private saveState() {
    writeJsonFile<LeadState>(this.stateFilePath, {
      nextLeadId: this.nextLeadId,
      nextContactId: this.nextContactId,
      nextReviewAnswerId: this.nextReviewAnswerId,
      leads: this.leads
    });
  }
}
