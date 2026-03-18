import { Injectable } from "@nestjs/common";
import { AuditLogService } from "../audit-log/audit-log.service";
import { LeadsService } from "../leads/leads.service";
import { ReviewQueueItemDto, SubmitReviewDto } from "./review.types";

@Injectable()
export class ReviewService {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly auditLogService: AuditLogService
  ) {}

  async findQueue(): Promise<ReviewQueueItemDto[]> {
    return (await this.leadsService.listReviewQueue()).map((lead) => {
      const completedCount = lead.reviewChecklistAnswers.filter(
        (item) => item.passed !== null
      ).length;

      return {
        leadId: lead.id,
        displayName: lead.displayName,
        handle: lead.handle,
        platform: lead.platform,
        leadStatus: lead.leadStatus,
        totalScore: lead.totalScore,
        scoreGrade: lead.scoreGrade,
        riskFlags: lead.riskFlags,
        checklistProgress: `${completedCount}/${lead.reviewChecklistAnswers.length}`
      };
    });
  }

  async findOne(id: number) {
    return this.leadsService.findOne(id);
  }

  async submit(id: number, payload: SubmitReviewDto) {
    const lead = await this.leadsService.submitReview(id, payload);

    await this.auditLogService.log({
      entityType: "LEAD",
      entityId: id,
      actionType: "REVIEW_SUBMITTED",
      summary: `검수 결정: ${payload.decisionStatus}`,
      detail: payload.reviewNotes
    });

    return lead;
  }
}
