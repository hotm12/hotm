import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put
} from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import {
  CreateCampaignDto,
  CreateCampaignFilterDto,
  CreateCampaignSourceDto,
  UpdateCampaignDto,
  UpsertReviewChecklistTemplateDto,
  UpsertScoringRuleSetDto
} from "./campaigns.types";

@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  async findAll() {
    return {
      data: await this.campaignsService.findAll()
    };
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return {
      data: await this.campaignsService.findOne(id)
    };
  }

  @Post()
  async create(@Body() payload: CreateCampaignDto) {
    return {
      data: await this.campaignsService.create(payload)
    };
  }

  @Patch(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: UpdateCampaignDto
  ) {
    return {
      data: await this.campaignsService.update(id, payload)
    };
  }

  @Get(":id/sources")
  async listSources(@Param("id", ParseIntPipe) id: number) {
    return {
      data: await this.campaignsService.listSources(id)
    };
  }

  @Post(":id/sources")
  async addSource(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: CreateCampaignSourceDto
  ) {
    return {
      data: await this.campaignsService.addSource(id, payload)
    };
  }

  @Get(":id/filters")
  async listFilters(@Param("id", ParseIntPipe) id: number) {
    return {
      data: await this.campaignsService.listFilters(id)
    };
  }

  @Post(":id/filters")
  async addFilter(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: CreateCampaignFilterDto
  ) {
    return {
      data: await this.campaignsService.addFilter(id, payload)
    };
  }

  @Get(":id/scoring-rule-set")
  async getScoringRuleSet(@Param("id", ParseIntPipe) id: number) {
    return {
      data: await this.campaignsService.getScoringRuleSet(id)
    };
  }

  @Put(":id/scoring-rule-set")
  async upsertScoringRuleSet(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: UpsertScoringRuleSetDto
  ) {
    return {
      data: await this.campaignsService.upsertScoringRuleSet(id, payload)
    };
  }

  @Get(":id/review-checklist-template")
  async getReviewChecklistTemplate(@Param("id", ParseIntPipe) id: number) {
    return {
      data: await this.campaignsService.getReviewChecklistTemplate(id)
    };
  }

  @Put(":id/review-checklist-template")
  async upsertReviewChecklistTemplate(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: UpsertReviewChecklistTemplateDto
  ) {
    return {
      data: await this.campaignsService.upsertReviewChecklistTemplate(id, payload)
    };
  }
}
