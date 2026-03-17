import { Controller, Get } from "@nestjs/common";

@Controller("outreach-queue")
export class OutreachController {
  @Get()
  findQueue() {
    return {
      data: [],
      message: "아웃리치 큐 자리입니다."
    };
  }
}
