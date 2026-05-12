/**
 * Bootstraps a Nest app for use inside a serverless function (Vercel).
 * The Express adapter is wrapped with @vendia/serverless-express by callers.
 *
 * IMPORTANT: this module is imported from Next.js. Do NOT call app.listen().
 */
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { AppModule } from './app.module';

let cached: express.Express | null = null;

export async function getExpressApp(): Promise<express.Express> {
  if (cached) return cached;
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: true,
    logger: ['error', 'warn'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  cached = server;
  return server;
}
