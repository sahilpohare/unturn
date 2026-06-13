import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // bodyParser: false required by better-auth to access raw request body
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // All NestJS API routes under /api
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Unturn API')
    .setDescription('Flow engine, conversation, and tenant management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Serve React static assets
  const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
  app.useStaticAssets(frontendDist);

  // SPA fallback: serve index.html for all non-/api requests
  const indexHtml = join(frontendDist, 'index.html');
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(indexHtml);
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
