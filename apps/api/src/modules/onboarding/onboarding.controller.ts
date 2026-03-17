import { Controller, Get, Param } from "@nestjs/common";

@Controller("onboarding")
export class OnboardingController {
  @Get(":leadId")
  getDetail(@Param("leadId") leadId: string) {
    return {
      data: {
        leadId
      },
      message: "온보딩 상세 자리입니다."
    };
  }
}
