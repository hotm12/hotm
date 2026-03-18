import { Injectable } from "@nestjs/common";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import { LeadsService } from "../leads/leads.service";
import { OnboardingService } from "../onboarding/onboarding.service";
import { OutreachService } from "../outreach/outreach.service";
import { DashboardCountDto, DashboardDto, DashboardMetricDto } from "./dashboard.types";

@Injectable()
export class DashboardService {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly leadsService: LeadsService,
    private readonly outreachService: OutreachService,
    private readonly onboardingService: OnboardingService,
    private readonly auditLogService: AuditLogService
  ) {}

  async getDashboard(): Promise<DashboardDto> {
    const [campaigns, leads, reviewQueue, outreachQueue, onboardingItems, recentActivity] =
      await Promise.all([
        this.campaignsService.findAll(),
        this.leadsService.findAll({}),
        this.leadsService.listReviewQueue(),
        this.outreachService.findQueue(),
        this.onboardingService.findAll(),
        this.auditLogService.listRecent(6)
      ]);

    const approvedCount = leads.filter((lead) => lead.leadStatus === "APPROVED").length;
    const repliedCount = leads.filter((lead) =>
      ["REPLIED", "INTERESTED", "MEETING_BOOKED", "ONBOARDING"].includes(lead.crmStage ?? "")
    ).length;

    const metrics: DashboardMetricDto[] = [
      {
        label: "캠페인",
        value: campaigns.length,
        description: "현재 운영 중인 탐색 캠페인 수"
      },
      {
        label: "전체 리드",
        value: leads.length,
        description: "저장된 셀러 후보 수"
      },
      {
        label: "검수 대기",
        value: reviewQueue.length,
        description: "사람 검토가 필요한 리드 수"
      },
      {
        label: "아웃리치 큐",
        value: outreachQueue.length,
        description: "승인 후 발송 가능한 메시지 수"
      },
      {
        label: "답장 진행",
        value: repliedCount,
        description: "CRM 후속 관리가 필요한 리드 수"
      },
      {
        label: "온보딩",
        value: onboardingItems.length,
        description: "온보딩 단계로 넘어간 리드 수"
      },
      {
        label: "승인 리드",
        value: approvedCount,
        description: "아웃리치 가능한 승인 리드 수"
      }
    ];

    return {
      metrics,
      leadStatusCounts: this.countByLabel(
        leads.map((lead) => lead.leadStatus),
        ["NEW", "REVIEW_READY", "ON_HOLD", "APPROVED", "REJECTED", "DO_NOT_CONTACT"]
      ),
      crmStageCounts: this.countByLabel(
        leads.map((lead) => lead.crmStage ?? "UNASSIGNED"),
        ["CONTACTED", "REPLIED", "INTERESTED", "MEETING_BOOKED", "ONBOARDING"]
      ),
      onboardingItems: onboardingItems.slice(0, 5).map((item) => ({
        leadId: item.leadId,
        displayName: item.displayName,
        onboardingStatus: item.onboardingStatus,
        nextAction: item.nextAction,
        updatedAt: item.updatedAt
      })),
      recentActivity
    };
  }

  private countByLabel(items: string[], order: string[]): DashboardCountDto[] {
    const counts = new Map<string, number>();

    for (const item of items) {
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }

    return order
      .map((label) => ({
        label,
        value: counts.get(label) ?? 0
      }))
      .filter((item) => item.value > 0);
  }
}
