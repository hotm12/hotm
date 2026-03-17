import { Controller, Get } from "@nestjs/common";

@Controller("crm")
export class CrmController {
  @Get("board")
  getBoard() {
    return {
      data: [],
      message: "CRM 보드 자리입니다."
    };
  }
}
