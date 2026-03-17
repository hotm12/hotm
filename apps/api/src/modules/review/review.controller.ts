import { Controller, Get } from "@nestjs/common";

@Controller("review-queue")
export class ReviewController {
  @Get()
  findQueue() {
    return {
      data: [],
      message: "검수 큐 자리입니다."
    };
  }
}
