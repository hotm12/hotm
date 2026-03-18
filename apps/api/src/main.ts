import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const originSetting = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  const allowedOrigins = originSetting
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true
  });
  app.setGlobalPrefix("api");
  await app.listen(Number(process.env.PORT ?? 3001));
}

bootstrap();
