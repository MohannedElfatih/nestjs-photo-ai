import { ClassSerializerInterceptor, MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CatsModule } from './cats/cats.module.js';
import { logger } from './common/middleware/logger.middleware.js';
import { CatsController } from './cats/cats.controller.js';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module.js';
import { PhotoModule } from './photo/photo.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthenticationModule } from '@nestjs/authentication';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiModule } from './ai/ai.module.js';
import { ChatModule } from './chat/chat.module.js';
import { DevModule } from './dev/dev.module.js';
import { SqlLogger } from './common/logging/sql-logger.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'nestjs-learn',
    }),
    // Loads .env into ConfigService; isGlobal means no per-module imports.
    ConfigModule.forRoot({ isGlobal: true }),
    CatsModule,
    UserModule,
    PhotoModule,
    ScheduleModule.forRoot(),
    // forRootAsync lets the options be built from ConfigService instead of process.env.
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        // Defaults match the docker container from the setup; tests override DB_NAME.
        host: config.get('DB_HOST', 'localhost'),
        port: Number(config.get('DB_PORT', 5432)),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'nestlearn'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') !== 'production',
        // Prints every SQL statement (without parameter values) to the terminal. Off in production.
        logging: config.get('NODE_ENV') !== 'production',
        logger: new SqlLogger(),
      }),
    }),
    // Registers a global guard: every route needs a signed-in user unless marked @Public().
    AuthenticationModule.forRoot({
      session: {
        absoluteTtl: '14d', // signed out after 14 days, however active
        idleTtl: '3d', // or after 3 days without a request
      },
    }),
    AuthModule,
    AiModule,
    ChatModule,
    DevModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global providers via injection tokens: Nest applies these to every route.
    // Unlike app.useGlobal*() in main.ts, they go through dependency injection.
    // Required by the auth package; whitelist drops properties the DTO doesn't declare.
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, transform: true }) },
    // Applies @Exclude()/@Expose() to every response.
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(logger)
      .forRoutes(CatsController);
  }
}
