import { Module } from "@nestjs/common";
import { LeadsModule } from "../leads/leads.module";
import { OutreachController } from "./outreach.controller";
import { OutreachService } from "./outreach.service";

@Module({
  imports: [LeadsModule],
  controllers: [OutreachController],
  providers: [OutreachService],
  exports: [OutreachService]
})
export class OutreachModule {}
