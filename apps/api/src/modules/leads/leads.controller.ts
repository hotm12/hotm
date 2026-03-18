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
  async findAll(@Query() query: LeadListQueryDto) {
    return {
      data: await this.leadsService.findAll(query)
    };
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return {
      data: await this.leadsService.findOne(id)
    };
  }

  @Get(":id/score")
  async getScore(@Param("id", ParseIntPipe) id: number) {
    return {
      data: await this.leadsService.recalculateScore(id)
    };
  }

  @Post()
  async create(@Body() payload: CreateLeadDto) {
    return {
      data: await this.leadsService.create(payload)
    };
  }

  @Post(":id/recalculate-score")
  async recalculateScore(@Param("id", ParseIntPipe) id: number) {
    return {
      data: await this.leadsService.recalculateScore(id)
    };
  }
}
