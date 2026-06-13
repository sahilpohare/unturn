import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FlowService } from './flow.service';
import type { CreateFlowDto, UpdateFlowDto, UpsertStepDto } from './flow.service';

@ApiTags('Flows')
@ApiBearerAuth()
@Controller('tenants/:tenantId/flows')
export class FlowController {
  constructor(private readonly flowService: FlowService) {}

  // ── Flow CRUD ──────────────────────────────────────────────────────────────

  @Post()
  createFlow(@Body() dto: CreateFlowDto) {
    return this.flowService.createFlow(dto);
  }

  @Get()
  listFlows() {
    return this.flowService.listFlows();
  }

  @Get(':id')
  findFlow(@Param('id') id: string) {
    return this.flowService.findFlow(id);
  }

  @Patch(':id')
  updateFlow(@Param('id') id: string, @Body() dto: UpdateFlowDto) {
    return this.flowService.updateFlow(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteFlow(@Param('id') id: string) {
    return this.flowService.deleteFlow(id);
  }

  // ── Steps ──────────────────────────────────────────────────────────────────

  @Put(':id/steps')
  upsertSteps(@Param('id') id: string, @Body() steps: UpsertStepDto[]) {
    return this.flowService.upsertSteps(id, steps);
  }

  @Delete(':id/steps/:stepId')
  @HttpCode(204)
  deleteStep(@Param('id') id: string, @Param('stepId') stepId: string) {
    return this.flowService.deleteStep(id, stepId);
  }

  // ── Builtin tools catalogue ────────────────────────────────────────────────

  @Get('builtins')
  listBuiltins() {
    return this.flowService.listBuiltins();
  }

  // ── Executions (Temporal as source of truth) ───────────────────────────────

  @Post(':id/execute')
  execute(@Param('id') id: string, @Body() input: Record<string, unknown>) {
    return this.flowService.execute(id, input);
  }

  @Get(':id/executions')
  listExecutions(@Param('id') id: string) {
    return this.flowService.listExecutions(id);
  }

  @Get(':id/executions/:workflowId')
  getExecution(@Param('workflowId') workflowId: string) {
    return this.flowService.getExecution(workflowId);
  }

  @Delete(':id/executions/:workflowId')
  @HttpCode(204)
  cancelExecution(@Param('workflowId') workflowId: string) {
    return this.flowService.cancelExecution(workflowId);
  }
}
