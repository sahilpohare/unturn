import {
  Controller,
  Post,
  Param,
  Req,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { FlowService } from './flow.service';

/**
 * Public webhook endpoint — no session required.
 * Auth is done via HMAC-SHA256 signature (X-Hub-Signature-256 header).
 *
 * Route: POST /api/webhooks/:tenantId/flows/:flowId
 *
 * This controller sits outside the /tenants/:tenantId/** path so
 * TenantContextMiddleware is NOT applied and better-auth guard is bypassed
 * via @AllowAnonymous.
 */
@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly flowService: FlowService) {}

  @Post(':tenantId/flows/:flowId')
  @AllowAnonymous()
  @ApiOperation({ summary: 'Receive a webhook and trigger a flow' })
  async receive(
    @Param('tenantId') tenantId: string,
    @Param('flowId') flowId: string,
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ) {
    // Collect raw body chunks — bodyParser is disabled globally (main.ts)
    const rawBody = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });

    let payload: Record<string, unknown> = {};
    if (rawBody.length > 0) {
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch {
        throw new BadRequestException('Invalid JSON body');
      }
    }

    return this.flowService.webhookTrigger(tenantId, flowId, rawBody, signature, payload);
  }
}
