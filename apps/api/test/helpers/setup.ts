import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { newDb } from 'pg-mem';
import { AppModule } from '../../src/app.module';
import { StorageService } from '../../src/storage/storage.service';

export interface TestCtx {
  app: INestApplication;
  storage: StorageService;
  forceCodes: string[];
}

export async function buildApp(): Promise<TestCtx> {
  process.env.JWT_SECRET = 'test-secret';
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'pw-admin';
  process.env.EVENT_NAME = 'CMD AI Adoption Exam 2026';
  process.env.PUBLIC_URL = 'http://localhost:3000';
  // Force the storage to use the data: URL fallback path (no blob token).
  delete process.env.BLOB_READ_WRITE_TOKEN;

  // In-memory Postgres
  const db = newDb({ autoCreateForeignKeyIndices: true });
  // pg-mem doesn't implement to_char by default; register a minimal one.
  db.public.registerFunction({
    name: 'to_char',
    args: ['timestamp with time zone' as any, 'text' as any],
    returns: 'text' as any,
    implementation: (d: any) => (d instanceof Date ? d.toISOString() : String(d)),
  });
  db.public.registerFunction({
    name: 'to_char',
    args: ['timestamp' as any, 'text' as any],
    returns: 'text' as any,
    implementation: (d: any) => (d instanceof Date ? d.toISOString() : String(d)),
  });
  // gen_random_uuid isn't used because we generate IDs in app code.
  const { Pool } = db.adapters.createPg();
  const pool = new Pool() as any;

  // We don't want the real onModuleInit to try to read POSTGRES_URL.
  process.env.POSTGRES_URL = '';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const storage = app.get(StorageService);
  storage.setPool(pool);
  await storage.bootstrapSchema();

  const ctx: TestCtx = { app, storage, forceCodes: [] };

  // Wrap insertRegistration so tests can force a code (collision tests).
  const original = storage.insertRegistration.bind(storage);
  storage.insertRegistration = async (row) => {
    const next = ctx.forceCodes.shift();
    if (next) row = { ...row, reference_code: next };
    return original(row);
  };

  return ctx;
}

export async function tearDown(ctx: TestCtx) {
  await ctx.app.close();
}
