import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { CrmService } from "./crm.service";
import { CreateActivityDto, CreateReplyDto, MoveCrmStageDto } from "./crm.types";

@Controller("crm")
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get("board")
  async getBoard() {
    return {
      data: await this.crmService.getBoard()
    };
  }

  @Get(":leadId/replies")
  async getReplies(@Param("leadId", ParseIntPipe) leadId: number) {
    return {
      data: await this.crmService.listReplies(leadId)
    };
  }

  @Get(":leadId/activities")
  async getActivities(@Param("leadId", ParseIntPipe) leadId: number) {
    return {
      data: await this.crmService.listActivities(leadId)
    };
  }

  @Post("replies")
  async addReply(@Body() payload: CreateReplyDto) {
    return {
      data: await this.crmService.addReply(payload)
    };
  }

  @Post("move-stage")
  async moveStage(@Body() payload: MoveCrmStageDto) {
    return {
      data: await this.crmService.moveStage(payload)
    };
  }

  @Post("activities")
  async addActivity(@Body() payload: CreateActivityDto) {
    return {
      data: await this.crmService.addActivity(payload)
    };
  }
}
