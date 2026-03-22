import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Post,
  Query
} from "@nestjs/common";
import { LeadsService } from "./leads.service";
import {
  CreateLeadDto,
  CreateLeadContactDto,
  CreateLeadPostDto,
  ImportLeadsCsvDto,
  LeadListQueryDto,
  UpdateLeadDto
} from "./leads.types";

@Controller("leads")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async findAll(@Query() query: LeadListQueryDto) {
    return {
      data: await this.leadsService.findAll(query)
    };
  }

  @Get("import-history")
  async importHistory(@Query("limit") limit?: string) {
    return {
      data: await this.leadsService.listImportHistory(limit ? Number(limit) : undefined)
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

  @Patch(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: UpdateLeadDto
  ) {
    return {
      data: await this.leadsService.update(id, payload)
    };
  }

  @Post(":id/contacts")
  async addContact(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: CreateLeadContactDto
  ) {
    return {
      data: await this.leadsService.addContact(id, payload)
    };
  }

  @Delete(":id/contacts/:contactId")
  async removeContact(
    @Param("id", ParseIntPipe) id: number,
    @Param("contactId", ParseIntPipe) contactId: number,
    @Query("actor") actor?: string
  ) {
    return {
      data: await this.leadsService.removeContact(id, contactId, actor)
    };
  }

  @Post(":id/posts")
  async addPost(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: CreateLeadPostDto
  ) {
    return {
      data: await this.leadsService.addPost(id, payload)
    };
  }

  @Post("import-csv")
  async importCsv(@Body() payload: ImportLeadsCsvDto) {
    return {
      data: await this.leadsService.importCsv(payload)
    };
  }

  @Post("preview-import-csv")
  async previewImportCsv(@Body() payload: ImportLeadsCsvDto) {
    return {
      data: await this.leadsService.previewImportCsv(payload)
    };
  }

  @Post(":id/recalculate-score")
  async recalculateScore(@Param("id", ParseIntPipe) id: number) {
    return {
      data: await this.leadsService.recalculateScore(id)
    };
  }
}
