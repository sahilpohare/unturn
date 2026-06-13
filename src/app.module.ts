import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MastraModule } from '@mastra/nestjs';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RlsModule } from './platform/rls/rls.module';
import { TenantContextMiddleware } from './platform/rls/tenant-context.middleware';
import { PlatformModule } from './platform/platform.module';
import { MastraInfraModule } from './mastra/mastra-infra.module';
import { MASTRA_INSTANCE } from './mastra/mastra.tokens';
import { ConversationModule } from './conversation/conversation.module';
import { FlowModule } from './flow/flow.module';
import { TemporalModule } from './temporal/temporal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // TypeORM first — pool shared with RlsPool instances
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
      }),
    }),

    RlsModule,          // @Global — TenantContextService available everywhere
    PlatformModule,     // better-auth + AuthGuard (global) + org/tenant routes
    MastraInfraModule,
    ConversationModule,
    FlowModule,
    TemporalModule,

    // MastraModule LAST — catch-all controller
    MastraModule.registerAsync({
      imports: [MastraInfraModule],
      inject: [MASTRA_INSTANCE],
      useFactory: (mastra: any) => ({ mastra, prefix: '/api/mastra' }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Populate TenantContext for all tenant-scoped routes
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: 'tenants/:tenantId/*path', method: RequestMethod.ALL });
  }
}
