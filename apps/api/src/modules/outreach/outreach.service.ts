import { Injectable } from "@nestjs/common";
import { resolve } from "node:path";
import { Prisma } from "@prisma/client";
import { readJsonFile, writeJsonFile } from "../../common/json-file-store";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { LeadsService } from "../leads/leads.service";
import {
  ApproveOutreachDto,
  OutreachPreviewDto,
  OutreachQueueItemDto,
  QueueDmDto,
  SendEmailDto
} from "./outreach.types";

type OutreachMessageRecord = {
  id: number;
  leadId: number;
  channel: string;
  subject?: string;
  body: string;
  deliveryStatus: string;
  approvedAt?: string;
  sentAt?: string;
};

type OutreachState = {
  nextMessageId: number;
  messages: OutreachMessageRecord[];
};

@Injectable()
export class OutreachService {
  private readonly stateFilePath = resolve(process.cwd(), ".data", "outreach.json");
  private readonly databaseEnabled = Boolean(process.env.DATABASE_URL?.trim());
  private nextMessageId = 3;
  private seedPromise: Promise<void> | null = null;

  private readonly messages: OutreachMessageRecord[] = [
    {
      id: 1,
      leadId: 3,
      channel: "EMAIL",
      subject: "Amazon partnership proposal",
      body: "KGlow Finds, we believe your catalog is a strong fit for Amazon marketplace expansion.",
      deliveryStatus: "APPROVED",
      approvedAt: "2026-03-18T00:10:00Z"
    },
    {
      id: 2,
      leadId: 1,
      channel: "EMAIL",
      subject: "Amazon expansion proposal",
      body: "KBeauty Store Lab, we reviewed your public store activity and would like to discuss Amazon expansion.",
      deliveryStatus: "DRAFT"
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

  async findQueue(): Promise<OutreachQueueItemDto[]> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
    }

    const candidates = await this.leadsService.listOutreachCandidates();

    return Promise.all(
      candidates.map(async (lead) => {
        const message = await this.findOrCreateMessage(lead.id);

        return {
          leadId: lead.id,
          displayName: lead.displayName,
          handle: lead.handle,
          platform: lead.platform,
          channel: message.channel,
          deliveryStatus: message.deliveryStatus,
          subject: message.subject,
          previewText: message.body.slice(0, 80),
          approvedAt: message.approvedAt,
          sentAt: message.sentAt
        };
      })
    );
  }

  async getPreview(leadId: number): Promise<OutreachPreviewDto> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();
    }

    const lead = await this.leadsService.findOne(leadId);
    const message = await this.findOrCreateMessage(leadId);

    return {
      leadId,
      displayName: lead.displayName,
      channel: message.channel,
      subject: message.subject,
      body: message.body,
      deliveryStatus: message.deliveryStatus,
      recommendedAction:
        message.channel === "EMAIL"
          ? "Approve the email draft and send it"
          : "Queue the DM for manual sending"
    };
  }

  async approve(
    leadId: number,
    payload?: ApproveOutreachDto
  ): Promise<OutreachPreviewDto> {
    const message = await this.findOrCreateMessage(leadId);

    if (this.databaseEnabled) {
      await this.prisma.outreachMessage.update({
        where: {
          id: BigInt(message.id)
        },
        data: {
          channel: payload?.channel ?? message.channel,
          deliveryStatus: "APPROVED",
          approvedAt: new Date()
        }
      });
    } else {
      message.channel = payload?.channel ?? message.channel;
      message.deliveryStatus = "APPROVED";
      message.approvedAt = new Date().toISOString();
      this.saveState();
    }

    await this.auditLogService.log({
      entityType: "OUTREACH_MESSAGE",
      entityId: leadId,
      actionType: "OUTREACH_APPROVED",
      summary: "아웃리치 초안 승인",
      detail: `채널: ${payload?.channel ?? message.channel}`
    });

    return this.getPreview(leadId);
  }

  async sendEmail(
    leadId: number,
    payload?: SendEmailDto
  ): Promise<OutreachPreviewDto> {
    const message = await this.findOrCreateMessage(leadId);

    if (this.databaseEnabled) {
      await this.prisma.outreachMessage.update({
        where: {
          id: BigInt(message.id)
        },
        data: {
          channel: "EMAIL",
          subject: payload?.subject ?? message.subject,
          body: payload?.body ?? message.body,
          deliveryStatus: "SENT",
          approvedAt: message.approvedAt ? new Date(message.approvedAt) : new Date(),
          sentAt: new Date()
        }
      });
    } else {
      message.channel = "EMAIL";
      message.subject = payload?.subject ?? message.subject;
      message.body = payload?.body ?? message.body;
      message.deliveryStatus = "SENT";
      message.sentAt = new Date().toISOString();
      if (!message.approvedAt) {
        message.approvedAt = new Date().toISOString();
      }
      this.saveState();
    }

    await this.auditLogService.log({
      entityType: "OUTREACH_MESSAGE",
      entityId: leadId,
      actionType: "OUTREACH_SENT",
      summary: "이메일 발송 처리",
      detail: payload?.subject ?? message.subject
    });

    return this.getPreview(leadId);
  }

  async queueDm(
    leadId: number,
    payload?: QueueDmDto
  ): Promise<OutreachPreviewDto> {
    const message = await this.findOrCreateMessage(leadId, "DM");

    if (this.databaseEnabled) {
      await this.prisma.outreachMessage.update({
        where: {
          id: BigInt(message.id)
        },
        data: {
          channel: "DM",
          body: payload?.body ?? message.body,
          deliveryStatus: "QUEUED",
          approvedAt: message.approvedAt ? new Date(message.approvedAt) : new Date()
        }
      });
    } else {
      message.channel = "DM";
      message.body = payload?.body ?? message.body;
      message.deliveryStatus = "QUEUED";
      if (!message.approvedAt) {
        message.approvedAt = new Date().toISOString();
      }
      this.saveState();
    }

    await this.auditLogService.log({
      entityType: "OUTREACH_MESSAGE",
      entityId: leadId,
      actionType: "OUTREACH_DM_QUEUED",
      summary: "DM 큐 등록",
      detail: "수동 발송 대기 상태로 이동했습니다."
    });

    return this.getPreview(leadId);
  }

  private async findOrCreateMessage(
    leadId: number,
    preferredChannel = "EMAIL"
  ): Promise<OutreachMessageRecord> {
    if (this.databaseEnabled) {
      await this.ensureDatabaseSeed();

      const existing = await this.prisma.outreachMessage.findFirst({
        where: {
          leadId: BigInt(leadId)
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      if (existing) {
        return this.toRecord(existing);
      }

      const lead = await this.leadsService.findOne(leadId);
      const primaryContact = lead.contacts.find((item) => item.contactType === "EMAIL");
      const channel = primaryContact ? "EMAIL" : preferredChannel;
      const created = await this.prisma.outreachMessage.create({
        data: {
          leadId: BigInt(leadId),
          channel,
          subject: channel === "EMAIL" ? "Amazon partnership proposal" : null,
          body: this.buildMessageBody(lead.displayName, lead.category, lead.platform),
          deliveryStatus: "DRAFT"
        }
      });

      return this.toRecord(created);
    }

    const existing = this.messages.find((item) => item.leadId === leadId);
    if (existing) {
      return existing;
    }

    const lead = await this.leadsService.findOne(leadId);
    const primaryContact = lead.contacts.find((item) => item.contactType === "EMAIL");
    const channel = primaryContact ? "EMAIL" : preferredChannel;
    const message: OutreachMessageRecord = {
      id: this.nextMessageId++,
      leadId,
      channel,
      subject: channel === "EMAIL" ? "Amazon partnership proposal" : undefined,
      body: this.buildMessageBody(lead.displayName, lead.category, lead.platform),
      deliveryStatus: "DRAFT"
    };

    this.messages.push(message);
    this.saveState();
    return message;
  }

  private toRecord(message: {
    id: bigint;
    leadId: bigint;
    channel: string;
    subject: string | null;
    body: string;
    deliveryStatus: string;
    approvedAt: Date | null;
    sentAt: Date | null;
  }): OutreachMessageRecord {
    return {
      id: Number(message.id),
      leadId: Number(message.leadId),
      channel: message.channel,
      subject: message.subject ?? undefined,
      body: message.body,
      deliveryStatus: message.deliveryStatus,
      approvedAt: message.approvedAt?.toISOString(),
      sentAt: message.sentAt?.toISOString()
    };
  }

  private buildMessageBody(
    displayName: string,
    category: string | undefined,
    platform: string
  ): string {
    return `Hello ${displayName}, we reviewed your ${platform} presence in ${category ?? "beauty"} and think there may be a strong Amazon marketplace fit. If you are open to it, we would love to discuss a lightweight partnership opportunity.`;
  }

  private loadState() {
    const state = readJsonFile<OutreachState | null>(this.stateFilePath, null);

    if (!state) {
      return;
    }

    this.nextMessageId = state.nextMessageId;
    this.messages.splice(0, this.messages.length, ...state.messages);
  }

  private saveState() {
    writeJsonFile<OutreachState>(this.stateFilePath, {
      nextMessageId: this.nextMessageId,
      messages: this.messages
    });
  }

  private async ensureDatabaseSeed() {
    if (!this.databaseEnabled) {
      return;
    }

    if (!this.seedPromise) {
      this.seedPromise = (async () => {
        await this.leadsService.findAll({});

        const messageCount = await this.prisma.outreachMessage.count();

        if (messageCount > 0) {
          return;
        }

        const leads = await this.prisma.lead.findMany({
          where: {
            handle: {
              in: ["@kglow_finds", "@kbeauty_store_lab"]
            }
          }
        });

        const leadByHandle = new Map(leads.map((lead) => [lead.handle, lead]));
        const seededMessages = this.messages
          .map((message) => {
            const handle =
              message.leadId === 3 ? "@kglow_finds" : message.leadId === 1 ? "@kbeauty_store_lab" : null;

            if (!handle) {
              return null;
            }

            const lead = leadByHandle.get(handle);

            if (!lead) {
              return null;
            }

            return {
              leadId: lead.id,
              channel: message.channel,
              subject: message.subject ?? null,
              body: message.body,
              deliveryStatus: message.deliveryStatus,
              approvedAt: message.approvedAt ? new Date(message.approvedAt) : null,
              sentAt: message.sentAt ? new Date(message.sentAt) : null
            };
          })
          .filter(
            (
              message
            ): message is {
              leadId: bigint;
              channel: string;
              subject: string | null;
              body: string;
              deliveryStatus: string;
              approvedAt: Date | null;
              sentAt: Date | null;
            } => Boolean(message)
          );

        if (seededMessages.length === 0) {
          return;
        }

        await this.prisma.outreachMessage.createMany({
          data: seededMessages
        });
      })();
    }

    await this.seedPromise;
  }
}
