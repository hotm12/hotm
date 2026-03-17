import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { CampaignsModule } from "./modules/campaigns/campaigns.module";
import { LeadsModule } from "./modules/leads/leads.module";
import { ReviewModule } from "./modules/review/review.module";
import { OutreachModule } from "./modules/outreach/outreach.module";
import { CrmModule } from "./modules/crm/crm.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";

@Module({
  imports: [
    CampaignsModule,
    LeadsModule,
    ReviewModule,
    OutreachModule,
    CrmModule,
    OnboardingModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
