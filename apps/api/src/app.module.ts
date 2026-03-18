import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { CampaignsModule } from "./modules/campaigns/campaigns.module";
import { LeadsModule } from "./modules/leads/leads.module";
import { ReviewModule } from "./modules/review/review.module";
import { OutreachModule } from "./modules/outreach/outreach.module";
import { CrmModule } from "./modules/crm/crm.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { AuditLogModule } from "./modules/audit-log/audit-log.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    CampaignsModule,
    LeadsModule,
    ReviewModule,
    OutreachModule,
    CrmModule,
    OnboardingModule,
    DashboardModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
