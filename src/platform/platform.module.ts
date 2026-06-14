import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthInfraModule } from './auth/auth-infra.module';
import { TenantService } from './tenant/tenant.service';
import { TenantController } from './tenant/tenant.controller';
import { UserController } from './user/user.controller';
import { TenantEntity } from './tenant/tenant.entity';

@Module({
  imports: [AuthInfraModule, TypeOrmModule.forFeature([TenantEntity])],
  providers: [TenantService],
  controllers: [TenantController, UserController],
  exports: [AuthInfraModule], // so other modules can use session guards
})
export class PlatformModule {}
