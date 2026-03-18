import { Module } from "@nestjs/common";
import { LeadsModule } from "../leads/leads.module";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";

@Module({
  imports: [LeadsModule],
  controllers: [ReviewController],
  providers: [ReviewService]
})
export class ReviewModule {}
