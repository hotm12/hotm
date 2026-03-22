import { Injectable } from "@nestjs/common";
import { resolve } from "node:path";
import { readJsonFile, writeJsonFile } from "../../common/json-file-store";
import { isDatabaseStorageEnabled, isDevSeedEnabled } from "../../common/runtime-flags";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { LeadsService } from "../leads/leads.service";
import {
  ActivityDto,
  CreateActivityDto,
  CreateReplyDto,
  CrmBoardCardDto,
  CrmBoardColumnDto,
  MoveCrmStageDto,
  ReplyDto
} from "./crm.types";

type CrmState = {
  nextReplyId: number;
  nextActivityId: number;
  replies: ReplyDto[];
  activities: ActivityDto[];
};

@Injectable()
export class CrmService {
  private readonly stateFilePath = resolve(process.cwd(), ".data", "crm.json");
  private readonly databaseEnabled = isDatabaseStorageEnabled();
  private readonly devSeedEnabled = isDevSeedEnabled();
  private nextReplyId = 2;
  private nextActivityId = 3;
  private seedPromise: Promise<void> | null = null;

  private readonly stageOrder = [
    "CONTACTED",
    "REPLIED",
    "INTERESTED",
    "MEETING_BOOKED",
    "ONBOARDING"
  ];

  private readonly replies: ReplyDto[] = [
    {
      id: 1,
      leadId: 3,
      channel: "EMAIL",
      replyType: "POSITIVE",
      messageBody: "This looks interesting. Please send more details about onboarding.",
      receivedAt: "2026-03-18T02:00:00Z"
    }
  ];

  private readonly activities: ActivityDto[] = [
    {
      id: 1,
      leadId: 3,
      activityType: "OUTREACH_SENT",
      summary: "Outreach email sent",
      detail: "Sent Amazon marketplace proposal email.",
      occurredAt: "2026-03-18T01:40:00Z"
    },
    {
      id: 2,
      leadId: 3,
      activityType: "FOLLOW_UP_NOTE",
      summary: "Positive reply received",
      detail: "Preparing next-step details and product catalog request.",
      occurredAt: "2026-03-18T02:10:00Z"
    }
  ];

  constructor(
    private readonly leadsService: LeadsService,
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService
  ) {
    if (!this.databaseEnabled) {
      this.loadState();
    }
  }

  async getBoard(): Promise<CrmBoardColumnDto[]> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
    }

    const leads = await this.leadsService.listCrmLeads();
    const columns: CrmBoardColumnDto[] = [];

    for (const stage of this.stageOrder) {
      const items = await Promise.all(
        leads
          .filter((lead) => lead.crmStage === stage)
          .map((lead) =>
            this.toBoardCard(
              lead.id,
              lead.displayName,
              lead.handle,
              lead.platform,
              stage,
              lead.totalScore,
              lead.scoreGrade
            )
          )
      );

      columns.push({
        stage,
        items
      });
    }

    return columns;
  }

  async listReplies(leadId: number): Promise<ReplyDto[]> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const replies = await this.prisma.reply.findMany({
        where: {
          leadId: BigInt(leadId)
        },
        orderBy: {
          receivedAt: "desc"
        }
      });

      return replies.map((reply) => ({
        id: Number(reply.id),
        leadId: Number(reply.leadId),
        channel: reply.channel,
        replyType: reply.replyType ?? "",
        messageBody: reply.messageBody ?? "",
        receivedAt: reply.receivedAt.toISOString()
      }));
    }

    return this.replies
      .filter((item) => item.leadId === leadId)
      .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  }

  async listActivities(leadId: number): Promise<ActivityDto[]> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
      const activities = await this.prisma.activity.findMany({
        where: {
          leadId: BigInt(leadId)
        },
        orderBy: {
          occurredAt: "desc"
        }
      });

      return activities.map((activity) => ({
        id: Number(activity.id),
        leadId: Number(activity.leadId),
        activityType: activity.activityType,
        summary: activity.summary,
        detail: activity.detail ?? undefined,
        occurredAt: activity.occurredAt.toISOString()
      }));
    }

    return this.activities
      .filter((item) => item.leadId === leadId)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  }

  async addReply(payload: CreateReplyDto): Promise<ReplyDto> {
    if (this.databaseEnabled) {
      const latestMessage = await this.prisma.outreachMessage.findFirst({
        where: {
          leadId: BigInt(payload.leadId)
        },
        orderBy: [
          {
            sentAt: "desc"
          },
          {
            createdAt: "desc"
          }
        ]
      });

      const reply = await this.prisma.reply.create({
        data: {
          leadId: BigInt(payload.leadId),
          outreachMessageId: latestMessage?.id,
          channel: payload.channel,
          replyType: payload.replyType,
          messageBody: payload.messageBody,
          receivedAt: new Date()
        }
      });

      await this.leadsService.moveCrmStage(payload.leadId, "REPLIED");

      await this.auditLogService.log({
        entityType: "LEAD",
        entityId: payload.leadId,
        actionType: "CRM_REPLY_RECORDED",
        summary: `답장 등록: ${payload.replyType}`,
        detail: payload.messageBody
      });

      return {
        id: Number(reply.id),
        leadId: Number(reply.leadId),
        channel: reply.channel,
        replyType: reply.replyType ?? "",
        messageBody: reply.messageBody ?? "",
        receivedAt: reply.receivedAt.toISOString()
      };
    }

    const reply: ReplyDto = {
      id: this.nextReplyId++,
      leadId: payload.leadId,
      channel: payload.channel,
      replyType: payload.replyType,
      messageBody: payload.messageBody,
      receivedAt: new Date().toISOString()
    };

    this.replies.unshift(reply);
    await this.leadsService.moveCrmStage(payload.leadId, "REPLIED");
    await this.auditLogService.log({
      entityType: "LEAD",
      entityId: payload.leadId,
      actionType: "CRM_REPLY_RECORDED",
      summary: `답장 등록: ${payload.replyType}`,
      detail: payload.messageBody
    });
    this.saveState();
    return reply;
  }

  async moveStage(payload: MoveCrmStageDto) {
    const lead = await this.leadsService.moveCrmStage(payload.leadId, payload.nextStage);

    await this.auditLogService.log({
      entityType: "LEAD",
      entityId: payload.leadId,
      actionType: "CRM_STAGE_MOVED",
      summary: `CRM 단계 이동: ${payload.nextStage}`,
      detail: `${lead.displayName} 리드가 ${payload.nextStage} 단계로 이동했습니다.`
    });

    return lead;
  }

  async addActivity(payload: CreateActivityDto): Promise<ActivityDto> {
    if (this.databaseEnabled) {
      const activity = await this.prisma.activity.create({
        data: {
          leadId: BigInt(payload.leadId),
          activityType: payload.activityType,
          summary: payload.summary,
          detail: payload.detail,
          occurredAt: new Date()
        }
      });

      return {
        ...(await this.logActivity(payload)),
        id: Number(activity.id),
        leadId: Number(activity.leadId),
        activityType: activity.activityType,
        summary: activity.summary,
        detail: activity.detail ?? undefined,
        occurredAt: activity.occurredAt.toISOString()
      };
    }

    const activity: ActivityDto = {
      id: this.nextActivityId++,
      leadId: payload.leadId,
      activityType: payload.activityType,
      summary: payload.summary,
      detail: payload.detail,
      occurredAt: new Date().toISOString()
    };

    this.activities.unshift(activity);
    await this.logActivity(payload);
    this.saveState();
    return activity;
  }

  private async logActivity(payload: CreateActivityDto) {
    await this.auditLogService.log({
      entityType: "LEAD",
      entityId: payload.leadId,
      actionType: "CRM_ACTIVITY_RECORDED",
      summary: payload.summary,
      detail: payload.detail
    });

    return {};
  }

  private async toBoardCard(
    leadId: number,
    displayName: string,
    handle: string,
    platform: string,
    crmStage: string,
    totalScore: number,
    scoreGrade: string
  ): Promise<CrmBoardCardDto> {
    const [latestReply, latestActivity] = await Promise.all([
      this.listReplies(leadId),
      this.listActivities(leadId)
    ]);

    return {
      leadId,
      displayName,
      handle,
      platform,
      crmStage,
      totalScore,
      scoreGrade,
      latestReplyType: latestReply[0]?.replyType,
      latestActivitySummary: latestActivity[0]?.summary
    };
  }

  private async ensureDatabaseSeed() {
    if (!this.databaseEnabled || !this.devSeedEnabled) {
      return;
    }

    if (!this.seedPromise) {
      this.seedPromise = (async () => {
        await this.leadsService.listCrmLeads();

        const existingReplyCount = await this.prisma.reply.count();
        const existingActivityCount = await this.prisma.activity.count();

        if (existingReplyCount > 0 || existingActivityCount > 0) {
          return;
        }

        const lead = await this.prisma.lead.findFirst({
          where: {
            crmStage: "REPLIED"
          },
          orderBy: {
            id: "asc"
          }
        });

        if (!lead) {
          return;
        }

        await this.prisma.reply.create({
          data: {
            leadId: lead.id,
            channel: "EMAIL",
            replyType: "POSITIVE",
            messageBody: "This looks interesting. Please send more details about onboarding.",
            receivedAt: new Date("2026-03-18T02:00:00Z")
          }
        });

        await this.prisma.activity.createMany({
          data: [
            {
              leadId: lead.id,
              activityType: "OUTREACH_SENT",
              summary: "Outreach email sent",
              detail: "Sent Amazon marketplace proposal email.",
              occurredAt: new Date("2026-03-18T01:40:00Z")
            },
            {
              leadId: lead.id,
              activityType: "FOLLOW_UP_NOTE",
              summary: "Positive reply received",
              detail: "Preparing next-step details and product catalog request.",
              occurredAt: new Date("2026-03-18T02:10:00Z")
            }
          ]
        });
      })();
    }

    await this.seedPromise;
  }

  private loadState() {
    const state = readJsonFile<CrmState | null>(this.stateFilePath, null);

    if (!state) {
      return;
    }

    this.nextReplyId = state.nextReplyId;
    this.nextActivityId = state.nextActivityId;
    this.replies.splice(0, this.replies.length, ...state.replies);
    this.activities.splice(0, this.activities.length, ...state.activities);
  }

  private saveState() {
    writeJsonFile<CrmState>(this.stateFilePath, {
      nextReplyId: this.nextReplyId,
      nextActivityId: this.nextActivityId,
      replies: this.replies,
      activities: this.activities
    });
  }
}
