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
  findAll() {
    return {
      data: this.campaignsService.findAll()
    };
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return {
      data: this.campaignsService.findOne(id)
    };
  }

  @Post()
  create(@Body() payload: CreateCampaignDto) {
    return {
      data: this.campaignsService.create(payload)
    };
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: UpdateCampaignDto
  ) {
    return {
      data: this.campaignsService.update(id, payload)
    };
  }

  @Get(":id/sources")
  listSources(@Param("id", ParseIntPipe) id: number) {
    return {
      data: this.campaignsService.listSources(id)
    };
  }

  @Post(":id/sources")
  addSource(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: CreateCampaignSourceDto
  ) {
    return {
      data: this.campaignsService.addSource(id, payload)
    };
  }

  @Get(":id/filters")
  listFilters(@Param("id", ParseIntPipe) id: number) {
    return {
      data: this.campaignsService.listFilters(id)
    };
  }

  @Post(":id/filters")
  addFilter(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: CreateCampaignFilterDto
  ) {
    return {
      data: this.campaignsService.addFilter(id, payload)
    };
  }

  @Get(":id/scoring-rule-set")
  getScoringRuleSet(@Param("id", ParseIntPipe) id: number) {
    return {
      data: this.campaignsService.getScoringRuleSet(id)
    };
  }

  @Put(":id/scoring-rule-set")
  upsertScoringRuleSet(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: UpsertScoringRuleSetDto
  ) {
    return {
      data: this.campaignsService.upsertScoringRuleSet(id, payload)
    };
  }

  @Get(":id/review-checklist-template")
  getReviewChecklistTemplate(@Param("id", ParseIntPipe) id: number) {
    return {
      data: this.campaignsService.getReviewChecklistTemplate(id)
    };
  }

  @Put(":id/review-checklist-template")
  upsertReviewChecklistTemplate(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: UpsertReviewChecklistTemplateDto
  ) {
    return {
      data: this.campaignsService.upsertReviewChecklistTemplate(id, payload)
    };
  }
}
