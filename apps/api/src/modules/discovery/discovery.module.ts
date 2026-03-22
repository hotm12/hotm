import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { LeadsModule } from "../leads/leads.module";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryIngestionService } from "./discovery-ingestion.service";
import { DiscoveryService } from "./discovery.service";
import { InstagramDiscoveryCollector } from "./instagram-discovery.collector";
import { InstagramDiscoveryNormalizer } from "./instagram-discovery.normalizer";

@Module({
  imports: [CampaignsModule, LeadsModule, AuditLogModule],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    DiscoveryIngestionService,
    InstagramDiscoveryCollector,
    InstagramDiscoveryNormalizer
  ],
  exports: [DiscoveryService]
})
export class DiscoveryModule {}
