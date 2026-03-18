import { Controller, Get, Query } from "@nestjs/common";
import { AuditLogService } from "./audit-log.service";

@Controller("audit-log")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findRecent(@Query("limit") limit?: string) {
    return {
      data: await this.auditLogService.listRecent(limit ? Number(limit) : 20)
    };
  }
}
