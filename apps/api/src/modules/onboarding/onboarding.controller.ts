import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post
} from "@nestjs/common";
import { OnboardingService } from "./onboarding.service";
import { StartOnboardingDto, UpdateOnboardingDto } from "./onboarding.types";

@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get()
  async findAll() {
    return {
      data: await this.onboardingService.findAll()
    };
  }

  @Get(":leadId")
  async getDetail(@Param("leadId", ParseIntPipe) leadId: number) {
    return {
      data: await this.onboardingService.findOne(leadId)
    };
  }

  @Post("start")
  async start(@Body() payload: StartOnboardingDto) {
    return {
      data: await this.onboardingService.start(payload)
    };
  }

  @Patch(":leadId")
  async update(
    @Param("leadId", ParseIntPipe) leadId: number,
    @Body() payload: UpdateOnboardingDto
  ) {
    return {
      data: await this.onboardingService.update(leadId, payload)
    };
  }
}
