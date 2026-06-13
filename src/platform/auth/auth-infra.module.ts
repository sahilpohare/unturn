import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createAuth, Auth } from './auth.instance';
import { RlsPool } from '../rls/rls-pool';
import { TenantContextService } from '../rls/tenant-context.service';

export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

@Module({
  imports: [
    AuthModule.forRootAsync({
      inject: [getDataSourceToken(), TenantContextService],
      useFactory: (dataSource: DataSource, tenantCtx: TenantContextService) => {
        const basePool = (dataSource.driver as any).master;
        const rlsPool = new RlsPool({ ...basePool.options }, tenantCtx);
        return { auth: createAuth(rlsPool) };
      },
    }),
  ],
  providers: [
    {
      provide: AUTH_INSTANCE,
      inject: [getDataSourceToken(), TenantContextService],
      useFactory: (dataSource: DataSource, tenantCtx: TenantContextService): Auth => {
        const basePool = (dataSource.driver as any).master;
        const rlsPool = new RlsPool({ ...basePool.options }, tenantCtx);
        return createAuth(rlsPool);
      },
    },
  ],
  exports: [AUTH_INSTANCE, AuthModule],
})
export class AuthInfraModule {}
