import { Module } from "@nestjs/common";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { LeadsModule } from "../leads/leads.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { OutreachModule } from "../outreach/outreach.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [CampaignsModule, LeadsModule, OutreachModule, OnboardingModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
