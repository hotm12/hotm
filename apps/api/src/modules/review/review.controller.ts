import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { ReviewService } from "./review.service";
import { SubmitReviewDto } from "./review.types";

@Controller("review-queue")
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  async findQueue() {
    return {
      data: await this.reviewService.findQueue()
    };
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return {
      data: await this.reviewService.findOne(id)
    };
  }

  @Post(":id/submit")
  async submit(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: SubmitReviewDto
  ) {
    return {
      data: await this.reviewService.submit(id, payload)
    };
  }
}
