import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolve } from "node:path";
import {
  createDefaultLeadSeeds,
  defaultChecklistLabels,
  ensurePrimaryCampaignSeed
} from "../../common/dev-seed";
import { readJsonFile, writeJsonFile } from "../../common/json-file-store";
import { isDatabaseStorageEnabled, isDevSeedEnabled } from "../../common/runtime-flags";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  CreateLeadDto,
  CreateLeadContactDto,
  CreateLeadPostDto,
  ImportLeadsCsvDto,
  ImportLeadsCsvPreviewResultDto,
  ImportLeadsCsvResultDto,
  LeadDetailDto,
  LeadImportHistoryItemDto,
  LeadListQueryDto,
  LeadScoreDto,
  LeadSummaryDto,
  ReviewChecklistAnswerDto,
  UpdateLeadDto
} from "./leads.types";

type LeadRecord = Omit<LeadDetailDto, "score" | "totalScore" | "scoreGrade">;
type LeadState = {
  nextLeadId: number;
  nextContactId: number;
  nextReviewAnswerId: number;
  leads: LeadRecord[];
};

type ImportCandidate = {
  campaignId: number;
  platform: string;
  handle?: string;
  displayName?: string;
  category?: string;
  followerCount?: number;
  postCount?: number;
  bio?: string;
  contactValue?: string;
};

type LeadImportHistoryState = {
  nextImportHistoryId: number;
  items: LeadImportHistoryItemDto[];
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
  private readonly importHistoryFilePath = resolve(
    process.cwd(),
    ".data",
    "lead-import-history.json"
  );
  private readonly databaseEnabled = isDatabaseStorageEnabled();
  private readonly devSeedEnabled = isDevSeedEnabled();
  private nextLeadId = 4;
  private nextContactId = 5;
  private nextReviewAnswerId = 8;
  private nextImportHistoryId = 1;
  private readonly leads: LeadRecord[] = createDefaultLeadSeeds();
  private readonly importHistory: LeadImportHistoryItemDto[] = [];
  private seedPromise: Promise<void> | null = null;
  private readonly allowedPlatforms = new Set(["INSTAGRAM", "TIKTOK", "YOUTUBE"]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService
  ) {
    if (!this.databaseEnabled) {
      this.loadState();
      this.loadImportHistoryState();
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
    const handle = payload.handle.trim();
    const displayName = payload.displayName.trim();

    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      await this.requireCampaign(payload.campaignId);
      await this.ensureLeadDoesNotExist(payload.campaignId, handle, contactValue);

      const lead = await this.prisma.lead.create({
        ...leadDetailArgs,
        data: {
          campaignId: BigInt(payload.campaignId),
          platform: payload.platform,
          handle,
          displayName,
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

    this.ensureStateLeadDoesNotExist(payload.campaignId, handle, contactValue);

    const record: LeadRecord = {
      id: this.nextLeadId++,
      campaignId: payload.campaignId,
      platform: payload.platform,
      handle,
      displayName,
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

  async addContact(id: number, payload: CreateLeadContactDto): Promise<LeadDetailDto> {
    const contactType = payload.contactType.trim().toUpperCase();
    const contactValue = payload.contactValue.trim();

    if (!contactType || !contactValue) {
      throw new ConflictException("contactType and contactValue are required.");
    }

    if (contactType === "EMAIL" && !this.isValidEmail(contactValue)) {
      throw new ConflictException("Primary email format is invalid.");
    }

    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      await this.prisma.contact.create({
        data: {
          leadId: BigInt(id),
          contactType,
          contactValue,
          isPrimary: payload.isPrimary ?? false
        }
      });

      const detail = this.toDetailFromDb(await this.requireLeadRecord(id));
      await this.auditLogService.log({
        entityType: "LEAD",
        entityId: id,
        actionType: "LEAD_CONTACT_ADDED",
        actor: payload.actor,
        summary: "Lead contact added",
        detail: `${contactType} contact was added to ${detail.displayName}.`
      });
      return detail;
    }

    const lead = this.requireLeadFromState(id);
    lead.contacts.push({
      id: this.nextContactId++,
      contactType,
      contactValue,
      isPrimary: payload.isPrimary ?? false
    });
    this.saveState();
    const detail = this.toDetailFromState(lead);
    await this.auditLogService.log({
      entityType: "LEAD",
      entityId: id,
      actionType: "LEAD_CONTACT_ADDED",
      actor: payload.actor,
      summary: "Lead contact added",
      detail: `${contactType} contact was added to ${detail.displayName}.`
    });
    return detail;
  }

  async removeContact(id: number, contactId: number, actor?: string): Promise<LeadDetailDto> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      await this.prisma.contact.delete({
        where: {
          id: BigInt(contactId)
        }
      });

      const detail = this.toDetailFromDb(await this.requireLeadRecord(id));
      await this.auditLogService.log({
        entityType: "LEAD",
        entityId: id,
        actionType: "LEAD_CONTACT_REMOVED",
        actor,
        summary: "Lead contact removed",
        detail: `A contact was removed from ${detail.displayName}.`
      });
      return detail;
    }

    const lead = this.requireLeadFromState(id);
    const contactIndex = lead.contacts.findIndex((contact) => contact.id === contactId);

    if (contactIndex < 0) {
      throw new NotFoundException(`Contact ${contactId} not found`);
    }

    lead.contacts.splice(contactIndex, 1);
    this.saveState();
    const detail = this.toDetailFromState(lead);
    await this.auditLogService.log({
      entityType: "LEAD",
      entityId: id,
      actionType: "LEAD_CONTACT_REMOVED",
      actor,
      summary: "Lead contact removed",
      detail: `A contact was removed from ${detail.displayName}.`
    });
    return detail;
  }

  async addPost(id: number, payload: CreateLeadPostDto): Promise<LeadDetailDto> {
    const postUrl = payload.postUrl.trim();

    if (!postUrl) {
      throw new ConflictException("postUrl is required.");
    }

    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      await this.prisma.leadPost.create({
        data: {
          leadId: BigInt(id),
          postUrl,
          caption: payload.caption?.trim() || null,
          postedAt: payload.postedAt ? new Date(payload.postedAt) : null,
          metadata: {}
        }
      });

      const detail = this.toDetailFromDb(await this.requireLeadRecord(id));
      await this.auditLogService.log({
        entityType: "LEAD",
        entityId: id,
        actionType: "LEAD_POST_ADDED",
        actor: payload.actor,
        summary: "Lead post added",
        detail: `${detail.displayName} received a new tracked post.`
      });
      return detail;
    }

    const lead = this.requireLeadFromState(id);
    lead.posts.push({
      id: Date.now(),
      postUrl,
      caption: payload.caption?.trim() ?? "",
      postedAt: payload.postedAt ?? new Date().toISOString()
    });
    if (!lead.postCount) {
      lead.postCount = 1;
    } else {
      lead.postCount += 1;
    }
    this.saveState();
    const detail = this.toDetailFromState(lead);
    await this.auditLogService.log({
      entityType: "LEAD",
      entityId: id,
      actionType: "LEAD_POST_ADDED",
      actor: payload.actor,
      summary: "Lead post added",
      detail: `${detail.displayName} received a new tracked post.`
    });
    return detail;
  }

  async update(id: number, payload: UpdateLeadDto): Promise<LeadDetailDto> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const currentLead = await this.requireLeadRecord(id);
      const currentEmailContact = currentLead.contacts.find(
        (contact) => contact.contactType === "EMAIL"
      );
      const nextCampaignId = payload.campaignId ?? this.toNumber(currentLead.campaignId);
      const nextHandle = payload.handle?.trim() ?? currentLead.handle;
      const nextContactValue =
        payload.contactValue !== undefined
          ? payload.contactValue.trim() || undefined
          : currentEmailContact?.contactValue ?? undefined;

      await this.requireCampaign(nextCampaignId);
      await this.ensureLeadDoesNotExistForUpdate(
        id,
        nextCampaignId,
        nextHandle,
        nextContactValue
      );

      const updatedLead = await this.prisma.lead.update({
        ...leadDetailArgs,
        where: {
          id: BigInt(id)
        },
        data: {
          campaignId: BigInt(nextCampaignId),
          platform: payload.platform ?? currentLead.platform,
          handle: nextHandle,
          displayName: payload.displayName?.trim() ?? currentLead.displayName,
          category: payload.category !== undefined ? payload.category || null : currentLead.category,
          followerCount:
            payload.followerCount !== undefined
              ? payload.followerCount
              : currentLead.followerCount,
          postCount:
            payload.postCount !== undefined ? payload.postCount : currentLead.postCount,
          bio: payload.bio !== undefined ? payload.bio || null : currentLead.bio,
          leadStatus: payload.leadStatus ?? currentLead.leadStatus,
          crmStage:
            payload.crmStage !== undefined ? payload.crmStage || null : currentLead.crmStage,
          reviewNotes:
            payload.reviewNotes !== undefined
              ? payload.reviewNotes || null
              : currentLead.reviewNotes
        }
      });

      if (payload.contactValue !== undefined) {
        if (nextContactValue) {
          if (currentEmailContact) {
            await this.prisma.contact.update({
              where: {
                id: currentEmailContact.id
              },
              data: {
                contactValue: nextContactValue,
                isPrimary: true
              }
            });
          } else {
            await this.prisma.contact.create({
              data: {
                leadId: BigInt(id),
                contactType: "EMAIL",
                contactValue: nextContactValue,
                isPrimary: true
              }
            });
          }
        } else if (currentEmailContact) {
          await this.prisma.contact.delete({
            where: {
              id: currentEmailContact.id
            }
          });
        }
      }

      const detail = this.toDetailFromDb(await this.requireLeadRecord(id));
      await this.auditLogService.log({
        entityType: "LEAD",
        entityId: id,
        actionType: "LEAD_UPDATED",
        actor: payload.actor,
        summary: "Lead updated",
        detail: `${detail.displayName} lead profile was updated.`,
        beforeData: this.toDetailFromDb(currentLead),
        afterData: detail
      });
      return detail;
    }

    const lead = this.requireLeadFromState(id);
    const currentEmailContact = lead.contacts.find((contact) => contact.contactType === "EMAIL");
    const nextCampaignId = payload.campaignId ?? lead.campaignId;
    const nextHandle = payload.handle?.trim() ?? lead.handle;
    const nextContactValue =
      payload.contactValue !== undefined
        ? payload.contactValue.trim() || undefined
        : currentEmailContact?.contactValue ?? undefined;

    this.ensureStateLeadDoesNotExistForUpdate(id, nextCampaignId, nextHandle, nextContactValue);
    const before = this.toDetailFromState(lead);

    lead.campaignId = nextCampaignId;
    lead.platform = payload.platform ?? lead.platform;
    lead.handle = nextHandle;
    lead.displayName = payload.displayName?.trim() ?? lead.displayName;
    lead.category = payload.category !== undefined ? payload.category || undefined : lead.category;
    lead.followerCount =
      payload.followerCount !== undefined ? payload.followerCount : lead.followerCount;
    lead.postCount = payload.postCount !== undefined ? payload.postCount : lead.postCount;
    lead.bio = payload.bio !== undefined ? payload.bio || undefined : lead.bio;
    lead.leadStatus = payload.leadStatus ?? lead.leadStatus;
    lead.crmStage = payload.crmStage !== undefined ? payload.crmStage || undefined : lead.crmStage;
    lead.reviewNotes =
      payload.reviewNotes !== undefined ? payload.reviewNotes || undefined : lead.reviewNotes;

    if (payload.contactValue !== undefined) {
      if (nextContactValue) {
        if (currentEmailContact) {
          currentEmailContact.contactValue = nextContactValue;
          currentEmailContact.isPrimary = true;
        } else {
          lead.contacts.unshift({
            id: this.nextContactId++,
            contactType: "EMAIL",
            contactValue: nextContactValue,
            isPrimary: true
          });
        }
      } else if (currentEmailContact) {
        lead.contacts.splice(lead.contacts.indexOf(currentEmailContact), 1);
      }
    }

    this.saveState();
    const detail = this.toDetailFromState(lead);
    await this.auditLogService.log({
      entityType: "LEAD",
      entityId: id,
      actionType: "LEAD_UPDATED",
      actor: payload.actor,
      summary: "Lead updated",
      detail: `${detail.displayName} lead profile was updated.`,
      beforeData: before,
      afterData: detail
    });
    return detail;
  }

  async listImportHistory(limit = 20): Promise<LeadImportHistoryItemDto[]> {
    if (this.databaseEnabled) {
      const logs = await this.prisma.auditLog.findMany({
        where: {
          actionType: "LEAD_IMPORT_COMPLETED"
        },
        orderBy: {
          createdAt: "desc"
        },
        take: limit
      });

      return logs.map((log) => {
        const afterData = this.toJsonObject(log.afterData);
        return {
          id: Number(log.id),
          fileName: this.readJsonString(afterData, "fileName"),
          templateName: this.readJsonString(afterData, "templateName"),
          campaignId: this.readJsonNumber(afterData, "campaignId"),
          platform: this.readJsonString(afterData, "platform"),
          importedCount: this.readJsonNumber(afterData, "importedCount") ?? 0,
          skippedCount: this.readJsonNumber(afterData, "skippedCount") ?? 0,
          overwriteCount: this.readJsonNumber(afterData, "overwriteCount") ?? 0,
          mergeCount: this.readJsonNumber(afterData, "mergeCount") ?? 0,
          createdAt: log.createdAt.toISOString()
        };
      });
    }

    return [...this.importHistory]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }

  async importCsv(payload: ImportLeadsCsvDto): Promise<ImportLeadsCsvResultDto> {
    const rows = this.parseCsvRows(payload.csvText);
    const imported: LeadDetailDto[] = [];
    const skipped: ImportLeadsCsvResultDto["skipped"] = [];
    const seenHandles = new Set<string>();
    const seenContacts = new Set<string>();
    let overwriteCount = 0;
    let mergeCount = 0;

    for (const [index, row] of rows.entries()) {
      const candidate = this.buildImportCandidate(row, payload);
      const reason = await this.findImportSkipReason(candidate, seenHandles, seenContacts);
      const requestedAction = this.getRequestedImportAction(payload, index + 2);

      if (reason) {
        if (requestedAction === "OVERWRITE" && this.canOverwriteReason(reason)) {
          imported.push(await this.overwriteImportedLead(candidate));
          overwriteCount += 1;
          continue;
        }

        if (requestedAction === "MERGE" && this.canMergeReason(reason)) {
          imported.push(await this.mergeImportedLead(candidate));
          mergeCount += 1;
          continue;
        }

        skipped.push({
          rowNumber: index + 2,
          reason,
          handle: candidate.handle,
          contactValue: candidate.contactValue
        });
        continue;
      }

      try {
        imported.push(
          await this.create({
            campaignId: candidate.campaignId,
            platform: candidate.platform,
            handle: candidate.handle!,
            displayName: candidate.displayName!,
            category: candidate.category,
            followerCount: candidate.followerCount,
            postCount: candidate.postCount,
            bio: candidate.bio,
            contactValue: candidate.contactValue
          })
        );
      } catch (error) {
        skipped.push({
          rowNumber: index + 2,
          reason: error instanceof Error ? error.message : "Failed to import row.",
          handle: candidate.handle,
          contactValue: candidate.contactValue
        });
      }
    }

    await this.recordImportHistory(payload, {
      importedCount: imported.length,
      skippedCount: skipped.length,
      overwriteCount,
      mergeCount
    });

    return {
      imported,
      skipped
    };
  }

  async previewImportCsv(
    payload: ImportLeadsCsvDto
  ): Promise<ImportLeadsCsvPreviewResultDto> {
    const rows = this.parseCsvRows(payload.csvText);
    const previewRows: ImportLeadsCsvPreviewResultDto["rows"] = [];
    const seenHandles = new Set<string>();
    const seenContacts = new Set<string>();

    for (const [index, row] of rows.entries()) {
      const candidate = this.buildImportCandidate(row, payload);
      const reason = await this.findImportSkipReason(candidate, seenHandles, seenContacts);
      const requestedAction = this.getRequestedImportAction(payload, index + 2);
      const canOverwrite = reason ? this.canOverwriteReason(reason) : false;
      const canMerge = reason ? this.canMergeReason(reason) : false;

      previewRows.push({
        rowNumber: index + 2,
        campaignId: candidate.campaignId,
        platform: candidate.platform,
        handle: candidate.handle,
        displayName: candidate.displayName,
        category: candidate.category,
        followerCount: candidate.followerCount,
        postCount: candidate.postCount,
        bio: candidate.bio,
        contactValue: candidate.contactValue,
        status:
          reason &&
          !(
            (requestedAction === "OVERWRITE" && canOverwrite) ||
            (requestedAction === "MERGE" && canMerge)
          )
            ? "SKIP"
            : "READY",
        reason:
          requestedAction === "OVERWRITE" && canOverwrite
            ? "Will overwrite existing lead."
            : requestedAction === "MERGE" && canMerge
              ? "Will merge into existing lead."
              : reason ?? undefined
      });
    }

    return {
      rows: previewRows,
      readyCount: previewRows.filter((row) => row.status === "READY").length,
      skipCount: previewRows.filter((row) => row.status === "SKIP").length
    };
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
    if (!this.databaseEnabled || !this.devSeedEnabled) {
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

  private parseCsvRows(csvText: string) {
    const rows = this.parseCsv(csvText.trim()).filter((row) =>
      row.some((value) => value.trim().length > 0)
    );

    if (rows.length < 2) {
      return [];
    }

    const headers = rows[0].map((value) => this.normalizeHeader(value));

    return rows.slice(1).map((row) => {
      const record = new Map<string, string>();

      headers.forEach((header, index) => {
        if (!header) {
          return;
        }

        record.set(header, row[index]?.trim() ?? "");
      });

      return record;
    });
  }

  private buildImportCandidate(
    row: Map<string, string>,
    payload: ImportLeadsCsvDto
  ): ImportCandidate {
    return {
      campaignId: this.readInteger(row, "campaignid") ?? payload.campaignId ?? 1,
      platform: (this.readString(row, "platform") ?? payload.platform ?? "INSTAGRAM").toUpperCase(),
      handle: this.readString(row, "handle"),
      displayName:
        this.readString(row, "displayname") ??
        this.readString(row, "name") ??
        this.readString(row, "sellername"),
      category: this.readString(row, "category"),
      followerCount: this.readInteger(row, "followercount"),
      postCount: this.readInteger(row, "postcount"),
      bio: this.readString(row, "bio"),
      contactValue:
        this.readString(row, "contactvalue") ??
        this.readString(row, "email") ??
        this.readString(row, "contact")
    };
  }

  private async findImportSkipReason(
    candidate: ImportCandidate,
    seenHandles: Set<string>,
    seenContacts: Set<string>
  ) {
    const validationReason = this.validateImportCandidate(candidate);

    if (validationReason) {
      return validationReason;
    }

    const handleKey = this.toImportKey(candidate.campaignId, candidate.handle!);
    if (seenHandles.has(handleKey)) {
      return `Duplicate handle in upload: ${candidate.handle}`;
    }

    const contactKey = candidate.contactValue
      ? this.toImportKey(candidate.campaignId, candidate.contactValue)
      : null;

    if (contactKey && seenContacts.has(contactKey)) {
      return `Duplicate contactValue in upload: ${candidate.contactValue}`;
    }

    try {
      if (this.databaseEnabled) {
        await this.ensureDatabaseSeed();
        await this.ensureLeadDoesNotExist(
          candidate.campaignId,
          candidate.handle!,
          candidate.contactValue
        );
      } else {
        this.ensureStateLeadDoesNotExist(
          candidate.campaignId,
          candidate.handle!,
          candidate.contactValue
        );
      }
    } catch (error) {
      return error instanceof Error ? error.message : "Duplicate or invalid row.";
    }

    seenHandles.add(handleKey);
    if (contactKey) {
      seenContacts.add(contactKey);
    }

    return null;
  }

  private validateImportCandidate(candidate: ImportCandidate) {
    if (!candidate.handle || !candidate.displayName) {
      return "Missing required handle or displayName.";
    }

    if (candidate.campaignId < 1) {
      return "campaignId must be a positive number.";
    }

    if (!this.allowedPlatforms.has(candidate.platform)) {
      return `Unsupported platform: ${candidate.platform}.`;
    }

    if (
      candidate.followerCount !== undefined &&
      (candidate.followerCount < 0 || candidate.followerCount > 50_000_000)
    ) {
      return "followerCount is outside the allowed range.";
    }

    if (
      candidate.postCount !== undefined &&
      (candidate.postCount < 0 || candidate.postCount > 1_000_000)
    ) {
      return "postCount is outside the allowed range.";
    }

    if (candidate.contactValue && !this.isValidEmail(candidate.contactValue)) {
      return `Invalid email format: ${candidate.contactValue}`;
    }

    return null;
  }

  private parseCsv(csvText: string) {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentValue = "";
    let insideQuotes = false;

    for (let index = 0; index < csvText.length; index += 1) {
      const character = csvText[index];
      const nextCharacter = csvText[index + 1];

      if (character === '"') {
        if (insideQuotes && nextCharacter === '"') {
          currentValue += '"';
          index += 1;
        } else {
          insideQuotes = !insideQuotes;
        }

        continue;
      }

      if (!insideQuotes && character === ",") {
        currentRow.push(currentValue);
        currentValue = "";
        continue;
      }

      if (!insideQuotes && (character === "\n" || character === "\r")) {
        if (character === "\r" && nextCharacter === "\n") {
          index += 1;
        }

        currentRow.push(currentValue);
        rows.push(currentRow);
        currentRow = [];
        currentValue = "";
        continue;
      }

      currentValue += character;
    }

    if (currentValue.length > 0 || currentRow.length > 0) {
      currentRow.push(currentValue);
      rows.push(currentRow);
    }

    return rows;
  }

  private normalizeHeader(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  private toImportKey(campaignId: number, value: string) {
    return `${campaignId}:${value.trim().toLowerCase()}`;
  }

  private readString(row: Map<string, string>, key: string) {
    const value = row.get(key)?.trim();
    return value ? value : undefined;
  }

  private readInteger(row: Map<string, string>, key: string) {
    const value = row.get(key)?.trim();

    if (!value) {
      return undefined;
    }

    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private getRequestedImportAction(payload: ImportLeadsCsvDto, rowNumber: number) {
    return payload.actions?.find((item) => item.rowNumber === rowNumber)?.action ?? "SKIP";
  }

  private canOverwriteReason(reason: string) {
    return (
      reason.startsWith("Duplicate handle:") || reason.startsWith("Duplicate contactValue:")
    );
  }

  private canMergeReason(reason: string) {
    return this.canOverwriteReason(reason);
  }

  private async overwriteImportedLead(candidate: ImportCandidate) {
    if (!candidate.handle || !candidate.displayName) {
      throw new ConflictException("Cannot overwrite without handle and displayName.");
    }

    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const existing = await this.findDatabaseDuplicateLead(
        candidate.campaignId,
        candidate.handle,
        candidate.contactValue
      );

      if (!existing) {
        throw new NotFoundException("No duplicate lead found for overwrite.");
      }

      await this.prisma.lead.update({
        where: {
          id: existing.id
        },
        data: {
          platform: candidate.platform,
          handle: candidate.handle,
          displayName: candidate.displayName,
          category: candidate.category,
          followerCount: candidate.followerCount,
          postCount: candidate.postCount,
          bio: candidate.bio
        }
      });

      if (candidate.contactValue) {
        const existingContact = await this.prisma.contact.findFirst({
          where: {
            leadId: existing.id,
            contactType: "EMAIL"
          },
          orderBy: {
            id: "asc"
          }
        });

        if (existingContact) {
          await this.prisma.contact.update({
            where: {
              id: existingContact.id
            },
            data: {
              contactValue: candidate.contactValue,
              isPrimary: true
            }
          });
        } else {
          await this.prisma.contact.create({
            data: {
              leadId: existing.id,
              contactType: "EMAIL",
              contactValue: candidate.contactValue,
              isPrimary: true
            }
          });
        }
      }

      return this.toDetailFromDb(await this.requireLeadRecord(Number(existing.id)));
    }

    const existing = this.findStateDuplicateLead(
      candidate.campaignId,
      candidate.handle,
      candidate.contactValue
    );

    if (!existing) {
      throw new NotFoundException("No duplicate lead found for overwrite.");
    }

    existing.platform = candidate.platform;
    existing.handle = candidate.handle;
    existing.displayName = candidate.displayName;
    existing.category = candidate.category;
    existing.followerCount = candidate.followerCount;
    existing.postCount = candidate.postCount;
    existing.bio = candidate.bio;

    if (candidate.contactValue) {
      const existingContact = existing.contacts.find((contact) => contact.contactType === "EMAIL");

      if (existingContact) {
        existingContact.contactValue = candidate.contactValue;
        existingContact.isPrimary = true;
      } else {
        existing.contacts.unshift({
          id: this.nextContactId++,
          contactType: "EMAIL",
          contactValue: candidate.contactValue,
          isPrimary: true
        });
      }
    }

    this.saveState();
    return this.toDetailFromState(existing);
  }

  private async mergeImportedLead(candidate: ImportCandidate) {
    if (!candidate.handle || !candidate.displayName) {
      throw new ConflictException("Cannot merge without handle and displayName.");
    }

    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const existing = await this.findDatabaseDuplicateLead(
        candidate.campaignId,
        candidate.handle,
        candidate.contactValue
      );

      if (!existing) {
        throw new NotFoundException("No duplicate lead found for merge.");
      }

      const existingLead = await this.requireLeadRecord(Number(existing.id));
      const mergedLead = this.buildMergedLeadData(existingLead, candidate);

      await this.prisma.lead.update({
        where: {
          id: existing.id
        },
        data: mergedLead
      });

      if (candidate.contactValue) {
        const existingContact = await this.prisma.contact.findFirst({
          where: {
            leadId: existing.id,
            contactType: "EMAIL"
          },
          orderBy: {
            id: "asc"
          }
        });

        if (!existingContact) {
          await this.prisma.contact.create({
            data: {
              leadId: existing.id,
              contactType: "EMAIL",
              contactValue: candidate.contactValue,
              isPrimary: true
            }
          });
        }
      }

      return this.toDetailFromDb(await this.requireLeadRecord(Number(existing.id)));
    }

    const existing = this.findStateDuplicateLead(
      candidate.campaignId,
      candidate.handle,
      candidate.contactValue
    );

    if (!existing) {
      throw new NotFoundException("No duplicate lead found for merge.");
    }

    existing.platform = existing.platform || candidate.platform;
    existing.handle = existing.handle || candidate.handle;
    existing.displayName = existing.displayName || candidate.displayName;
    existing.category = existing.category || candidate.category;
    existing.followerCount = existing.followerCount ?? candidate.followerCount;
    existing.postCount = existing.postCount ?? candidate.postCount;
    existing.bio = existing.bio || candidate.bio;

    if (candidate.contactValue) {
      const existingContact = existing.contacts.find((contact) => contact.contactType === "EMAIL");

      if (!existingContact) {
        existing.contacts.unshift({
          id: this.nextContactId++,
          contactType: "EMAIL",
          contactValue: candidate.contactValue,
          isPrimary: true
        });
      }
    }

    this.saveState();
    return this.toDetailFromState(existing);
  }

  private async findDatabaseDuplicateLead(
    campaignId: number,
    handle: string,
    contactValue?: string
  ) {
    const existingByHandle = await this.prisma.lead.findFirst({
      where: {
        campaignId: BigInt(campaignId),
        handle: {
          equals: handle,
          mode: "insensitive"
        }
      }
    });

    if (existingByHandle) {
      return existingByHandle;
    }

    if (!contactValue) {
      return null;
    }

    return this.prisma.lead.findFirst({
      where: {
        campaignId: BigInt(campaignId),
        contacts: {
          some: {
            contactValue: {
              equals: contactValue,
              mode: "insensitive"
            }
          }
        }
      }
    });
  }

  private findStateDuplicateLead(
    campaignId: number,
    handle: string,
    contactValue?: string
  ) {
    const normalizedHandle = handle.trim().toLowerCase();
    const existingByHandle = this.leads.find(
      (lead) =>
        lead.campaignId === campaignId && lead.handle.trim().toLowerCase() === normalizedHandle
    );

    if (existingByHandle) {
      return existingByHandle;
    }

    if (!contactValue) {
      return null;
    }

    const normalizedContact = contactValue.trim().toLowerCase();
    return this.leads.find(
      (lead) =>
        lead.campaignId === campaignId &&
        lead.contacts.some(
          (contact) => contact.contactValue.trim().toLowerCase() === normalizedContact
        )
    );
  }

  private buildMergedLeadData(lead: LeadDbRecord, candidate: ImportCandidate) {
    return {
      platform: lead.platform || candidate.platform,
      handle: lead.handle || candidate.handle,
      displayName: lead.displayName || candidate.displayName,
      category: lead.category ?? candidate.category,
      followerCount: lead.followerCount ?? candidate.followerCount,
      postCount: lead.postCount ?? candidate.postCount,
      bio: lead.bio ?? candidate.bio
    };
  }

  private async ensureLeadDoesNotExist(
    campaignId: number,
    handle: string,
    contactValue?: string
  ) {
    const existingByHandle = await this.prisma.lead.findFirst({
      where: {
        campaignId: BigInt(campaignId),
        handle: {
          equals: handle,
          mode: "insensitive"
        }
      }
    });

    if (existingByHandle) {
      throw new ConflictException(`Duplicate handle: ${handle}`);
    }

    if (!contactValue) {
      return;
    }

    const existingByContact = await this.prisma.lead.findFirst({
      where: {
        campaignId: BigInt(campaignId),
        contacts: {
          some: {
            contactValue: {
              equals: contactValue,
              mode: "insensitive"
            }
          }
        }
      }
    });

    if (existingByContact) {
      throw new ConflictException(`Duplicate contactValue: ${contactValue}`);
    }
  }

  private async ensureLeadDoesNotExistForUpdate(
    id: number,
    campaignId: number,
    handle: string,
    contactValue?: string
  ) {
    const existingByHandle = await this.prisma.lead.findFirst({
      where: {
        id: {
          not: BigInt(id)
        },
        campaignId: BigInt(campaignId),
        handle: {
          equals: handle,
          mode: "insensitive"
        }
      }
    });

    if (existingByHandle) {
      throw new ConflictException(`Duplicate handle: ${handle}`);
    }

    if (!contactValue) {
      return;
    }

    const existingByContact = await this.prisma.lead.findFirst({
      where: {
        id: {
          not: BigInt(id)
        },
        campaignId: BigInt(campaignId),
        contacts: {
          some: {
            contactValue: {
              equals: contactValue,
              mode: "insensitive"
            }
          }
        }
      }
    });

    if (existingByContact) {
      throw new ConflictException(`Duplicate contactValue: ${contactValue}`);
    }
  }

  private ensureStateLeadDoesNotExist(
    campaignId: number,
    handle: string,
    contactValue?: string
  ) {
    const normalizedHandle = handle.trim().toLowerCase();
    const normalizedContact = contactValue?.trim().toLowerCase();

    const existingByHandle = this.leads.find(
      (lead) =>
        lead.campaignId === campaignId && lead.handle.trim().toLowerCase() === normalizedHandle
    );

    if (existingByHandle) {
      throw new ConflictException(`Duplicate handle: ${handle}`);
    }

    if (!normalizedContact) {
      return;
    }

    const existingByContact = this.leads.find(
      (lead) =>
        lead.campaignId === campaignId &&
        lead.contacts.some(
          (contact) => contact.contactValue.trim().toLowerCase() === normalizedContact
        )
    );

    if (existingByContact) {
      throw new ConflictException(`Duplicate contactValue: ${contactValue}`);
    }
  }

  private ensureStateLeadDoesNotExistForUpdate(
    id: number,
    campaignId: number,
    handle: string,
    contactValue?: string
  ) {
    const normalizedHandle = handle.trim().toLowerCase();
    const normalizedContact = contactValue?.trim().toLowerCase();

    const existingByHandle = this.leads.find(
      (lead) =>
        lead.id !== id &&
        lead.campaignId === campaignId &&
        lead.handle.trim().toLowerCase() === normalizedHandle
    );

    if (existingByHandle) {
      throw new ConflictException(`Duplicate handle: ${handle}`);
    }

    if (!normalizedContact) {
      return;
    }

    const existingByContact = this.leads.find(
      (lead) =>
        lead.id !== id &&
        lead.campaignId === campaignId &&
        lead.contacts.some(
          (contact) => contact.contactValue.trim().toLowerCase() === normalizedContact
        )
    );

    if (existingByContact) {
      throw new ConflictException(`Duplicate contactValue: ${contactValue}`);
    }
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

  private async recordImportHistory(
    payload: ImportLeadsCsvDto,
    summary: {
      importedCount: number;
      skippedCount: number;
      overwriteCount: number;
      mergeCount: number;
    }
  ) {
    const historyItem: Omit<LeadImportHistoryItemDto, "id"> = {
      fileName: payload.fileName,
      templateName: payload.templateName,
      campaignId: payload.campaignId,
      platform: payload.platform,
      importedCount: summary.importedCount,
      skippedCount: summary.skippedCount,
      overwriteCount: summary.overwriteCount,
      mergeCount: summary.mergeCount,
      createdAt: new Date().toISOString()
    };

    if (!this.databaseEnabled) {
      this.importHistory.unshift({
        id: this.nextImportHistoryId++,
        ...historyItem
      });
      this.saveImportHistoryState();
    }

    await this.auditLogService.log({
      entityType: "LEAD_IMPORT",
      entityId: payload.campaignId ?? 0,
      actionType: "LEAD_IMPORT_COMPLETED",
      actor: payload.actor,
      summary: "Lead import completed",
      detail: `Imported ${summary.importedCount} rows and skipped ${summary.skippedCount} rows.`,
      afterData: historyItem
    });
  }

  private toJsonObject(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, Prisma.JsonValue>;
  }

  private readJsonString(
    value: Record<string, Prisma.JsonValue> | null,
    key: string
  ): string | undefined {
    if (!value) {
      return undefined;
    }

    const nextValue = Reflect.get(value, key);
    return typeof nextValue === "string" ? nextValue : undefined;
  }

  private readJsonNumber(
    value: Record<string, Prisma.JsonValue> | null,
    key: string
  ): number | undefined {
    if (!value) {
      return undefined;
    }

    const nextValue = Reflect.get(value, key);
    return typeof nextValue === "number" ? nextValue : undefined;
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

  private loadImportHistoryState() {
    const state = readJsonFile<LeadImportHistoryState | null>(
      this.importHistoryFilePath,
      null
    );

    if (!state) {
      return;
    }

    this.nextImportHistoryId = state.nextImportHistoryId;
    this.importHistory.splice(0, this.importHistory.length, ...state.items);
  }

  private saveState() {
    writeJsonFile<LeadState>(this.stateFilePath, {
      nextLeadId: this.nextLeadId,
      nextContactId: this.nextContactId,
      nextReviewAnswerId: this.nextReviewAnswerId,
      leads: this.leads
    });
  }

  private saveImportHistoryState() {
    writeJsonFile<LeadImportHistoryState>(this.importHistoryFilePath, {
      nextImportHistoryId: this.nextImportHistoryId,
      items: this.importHistory
    });
  }
}
