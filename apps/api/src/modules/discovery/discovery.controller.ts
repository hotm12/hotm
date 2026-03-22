import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query
} from "@nestjs/common";
import { DiscoveryService } from "./discovery.service";
import {
  DiscoveryRunListQueryDto,
  ImportDiscoveryCandidatesDto,
  RunInstagramDiscoveryDto
} from "./discovery.types";

@Controller("discovery")
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Post("instagram/campaigns/:id/run")
  async runInstagramDiscovery(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: RunInstagramDiscoveryDto
  ) {
    return {
      data: await this.discoveryService.runInstagramDiscovery(id, payload)
    };
  }

  @Get("runs")
  async listRuns(@Query() query: DiscoveryRunListQueryDto) {
    return {
      data: await this.discoveryService.listRuns(query)
    };
  }

  @Get("runs/:runId")
  async findRun(@Param("runId", ParseIntPipe) runId: number) {
    return {
      data: await this.discoveryService.findRun(runId)
    };
  }

  @Get("runs/:runId/candidates")
  async listCandidates(@Param("runId", ParseIntPipe) runId: number) {
    return {
      data: await this.discoveryService.listCandidates(runId)
    };
  }

  @Post("runs/:runId/import")
  async importCandidates(
    @Param("runId", ParseIntPipe) runId: number,
    @Body() payload: ImportDiscoveryCandidatesDto
  ) {
    return {
      data: await this.discoveryService.importCandidates(runId, payload)
    };
  }
}
