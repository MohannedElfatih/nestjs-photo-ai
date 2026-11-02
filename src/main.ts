import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    routeConflictPolicy: { duplicate: 'error', shadow: 'warn' },
  });
  // Interactive API docs at /api, disabled in production.
  const configService = app.get(ConfigService);
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NestJS Learn')
      .setDescription('Learning project API')
      .setVersion('0.0.1')
      .build();
    SwaggerModule.setup('api', app, () => SwaggerModule.createDocument(app, config));
  }
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
