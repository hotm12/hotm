import { Module } from "@nestjs/common";
import { OutreachController } from "./outreach.controller";

@Module({
  controllers: [OutreachController]
})
export class OutreachModule {}
