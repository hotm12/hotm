import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query
} from "@nestjs/common";
import { LeadsService } from "./leads.service";
import { CreateLeadDto, LeadListQueryDto } from "./leads.types";

@Controller("leads")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(@Query() query: LeadListQueryDto) {
    return {
      data: this.leadsService.findAll(query)
    };
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return {
      data: this.leadsService.findOne(id)
    };
  }

  @Get(":id/score")
  getScore(@Param("id", ParseIntPipe) id: number) {
    return {
      data: this.leadsService.recalculateScore(id)
    };
  }

  @Post()
  create(@Body() payload: CreateLeadDto) {
    return {
      data: this.leadsService.create(payload)
    };
  }

  @Post(":id/recalculate-score")
  recalculateScore(@Param("id", ParseIntPipe) id: number) {
    return {
      data: this.leadsService.recalculateScore(id)
    };
  }
}
