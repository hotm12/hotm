import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { OutreachService } from "./outreach.service";
import { ApproveOutreachDto, QueueDmDto, SendEmailDto } from "./outreach.types";

@Controller("outreach-queue")
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Get()
  async findQueue() {
    return {
      data: await this.outreachService.findQueue()
    };
  }

  @Get(":leadId")
  async getPreview(@Param("leadId", ParseIntPipe) leadId: number) {
    return {
      data: await this.outreachService.getPreview(leadId)
    };
  }

  @Post(":leadId/approve")
  async approve(
    @Param("leadId", ParseIntPipe) leadId: number,
    @Body() payload: ApproveOutreachDto
  ) {
    return {
      data: await this.outreachService.approve(leadId, payload)
    };
  }

  @Post(":leadId/send-email")
  async sendEmail(
    @Param("leadId", ParseIntPipe) leadId: number,
    @Body() payload: SendEmailDto
  ) {
    return {
      data: await this.outreachService.sendEmail(leadId, payload)
    };
  }

  @Post(":leadId/queue-dm")
  async queueDm(
    @Param("leadId", ParseIntPipe) leadId: number,
    @Body() payload: QueueDmDto
  ) {
    return {
      data: await this.outreachService.queueDm(leadId, payload)
    };
  }
}
