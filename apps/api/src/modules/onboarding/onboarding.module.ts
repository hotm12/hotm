import { Module } from "@nestjs/common";
import { LeadsModule } from "../leads/leads.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [LeadsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService]
})
export class OnboardingModule {}
