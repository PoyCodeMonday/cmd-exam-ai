import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { put as blobPut, del as blobDel } from '@vercel/blob';

export interface RegistrationRow {
  id: string;
  reference_code: string;
  password_hash: string;
  name: string;
  name_th: string;
  name_en: string | null;
  email: string;
  phone: string;
  organization: string | null;
  dietary: string | null;
  tshirt_size: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrationDocumentRow {
  id: string;
  registration_id: string;
  filename: string;
  storage_path: string; // Vercel Blob URL
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
}

export interface StorageUpload {
  buffer: Buffer;
  contentType: string;
}

/**
 * Persistent storage backed by Postgres (rows) and Vercel Blob (files).
 *
 * Designed to run inside a Vercel serverless function: each cold start
 * creates a new pool, but `pg` keeps the connection alive within a warm
 * invocation. The pool is small (max=1) because each function instance
 * handles one request at a time.
 *
 * `getInstance()` returns the singleton bound to the current env. Tests
 * can override the pool by injecting via Nest's `useValue`.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private pool!: Pool;
  private blobToken!: string;
  private bootstrapped = false;
  private readonly logger = new Logger(StorageService.name);

  async onModuleInit() {
    const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!conn) {
      this.logger.warn('POSTGRES_URL not set — DB calls will fail at runtime.');
      return;
    }
    this.pool = new Pool({
      connectionString: conn,
      max: 1,
      ssl: /sslmode=require|vercel|neon/i.test(conn) ? { rejectUnauthorized: false } : false,
    });
    this.blobToken = process.env.BLOB_READ_WRITE_TOKEN || '';
    await this.bootstrapSchema();
  }

  /** Test seam: swap out the pool. */
  setPool(pool: Pool) {
    this.pool = pool;
    this.bootstrapped = false;
  }

  /** Ensure schema exists. Safe to call repeatedly. */
  async bootstrapSchema() {
    if (this.bootstrapped) return;
    await this.pool.query(`
      create table if not exists registrations (
        id text primary key,
        reference_code text unique not null,
        password_hash text not null,
        name text not null,
        name_th text,
        name_en text,
        email text not null,
        phone text not null,
        organization text,
        dietary text,
        tshirt_size text,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create table if not exists registration_documents (
        id text primary key,
        registration_id text not null references registrations(id) on delete cascade,
        filename text not null,
        storage_path text not null,
        mime_type text,
        size_bytes integer,
        uploaded_at timestamptz not null default now()
      );
      create index if not exists registration_documents_reg_idx
        on registration_documents(registration_id);
    `);
    // Idempotent backfill for old schemas
    await this.pool.query(
      `update registrations set name_th = coalesce(name_th, name) where name_th is null or name_th = ''`,
    );
    this.bootstrapped = true;
  }

  // ---------- registrations ----------

  async insertRegistration(
    row: Omit<RegistrationRow, 'created_at' | 'updated_at'>,
  ): Promise<RegistrationRow> {
    try {
      const r = await this.pool.query(
        `insert into registrations
           (id, reference_code, password_hash, name, name_th, name_en,
            email, phone, organization, dietary, tshirt_size, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         returning *,
           to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
           to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at`,
        [
          row.id, row.reference_code, row.password_hash,
          row.name, row.name_th, row.name_en,
          row.email, row.phone, row.organization,
          row.dietary, row.tshirt_size, row.notes,
        ],
      );
      return r.rows[0];
    } catch (e: any) {
      if (e?.code === '23505') {
        const err: any = new Error('duplicate reference_code');
        err.code = '23505';
        throw err;
      }
      throw e;
    }
  }

  async findByReferenceCode(code: string): Promise<RegistrationRow | null> {
    const r = await this.pool.query(
      `select *,
        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
        to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
       from registrations where reference_code = $1`,
      [code],
    );
    return r.rows[0] || null;
  }

  async findById(id: string): Promise<RegistrationRow | null> {
    const r = await this.pool.query(
      `select *,
        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
        to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
       from registrations where id = $1`,
      [id],
    );
    return r.rows[0] || null;
  }

  async updateRegistration(
    id: string,
    patch: Partial<RegistrationRow>,
  ): Promise<RegistrationRow> {
    const allowed: (keyof RegistrationRow)[] = [
      'name', 'name_th', 'name_en', 'email', 'phone',
      'organization', 'dietary', 'tshirt_size', 'notes',
    ];
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const k of allowed) {
      if (k in patch) {
        sets.push(`${k} = $${idx++}`);
        params.push((patch as any)[k]);
      }
    }
    if (!sets.length) return (await this.findById(id))!;
    sets.push(`updated_at = now()`);
    params.push(id);
    await this.pool.query(
      `update registrations set ${sets.join(', ')} where id = $${idx}`,
      params,
    );
    return (await this.findById(id))!;
  }

  async listAllRegistrations(): Promise<RegistrationRow[]> {
    const r = await this.pool.query(
      `select *,
        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
        to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
       from registrations order by created_at desc`,
    );
    return r.rows;
  }

  // ---------- documents ----------

  async listDocuments(registrationId: string): Promise<RegistrationDocumentRow[]> {
    const r = await this.pool.query(
      `select *,
        to_char(uploaded_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as uploaded_at
       from registration_documents where registration_id = $1
       order by uploaded_at asc`,
      [registrationId],
    );
    return r.rows;
  }

  async findDocument(id: string): Promise<RegistrationDocumentRow | null> {
    const r = await this.pool.query(
      `select *,
        to_char(uploaded_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as uploaded_at
       from registration_documents where id = $1`,
      [id],
    );
    return r.rows[0] || null;
  }

  async insertDocument(
    row: Omit<RegistrationDocumentRow, 'uploaded_at'>,
  ): Promise<RegistrationDocumentRow> {
    const r = await this.pool.query(
      `insert into registration_documents
         (id, registration_id, filename, storage_path, mime_type, size_bytes)
       values ($1,$2,$3,$4,$5,$6)
       returning *,
        to_char(uploaded_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as uploaded_at`,
      [row.id, row.registration_id, row.filename, row.storage_path, row.mime_type, row.size_bytes],
    );
    return r.rows[0];
  }

  async deleteDocument(id: string, registrationId: string): Promise<RegistrationDocumentRow | null> {
    const r = await this.pool.query(
      `delete from registration_documents
       where id = $1 and registration_id = $2
       returning *,
        to_char(uploaded_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as uploaded_at`,
      [id, registrationId],
    );
    return r.rows[0] || null;
  }

  // ---------- file blobs ----------

  /**
   * Upload bytes to Vercel Blob. Returns the public-but-unguessable URL,
   * which we persist in `registration_documents.storage_path`.
   */
  async uploadFile(pathHint: string, upload: StorageUpload): Promise<string> {
    if (this.blobToken) {
      const result = await blobPut(pathHint, upload.buffer, {
        access: 'public',
        contentType: upload.contentType,
        token: this.blobToken,
        addRandomSuffix: true, // makes the URL unguessable
      });
      return result.url;
    }
    // No Blob configured (e.g. in tests) — use a data: URL fallback so reads still work.
    const b64 = upload.buffer.toString('base64');
    return `data:${upload.contentType};base64,${b64}`;
  }

  async removeFile(url: string): Promise<void> {
    if (url.startsWith('data:')) return;
    if (!this.blobToken) return;
    try {
      await blobDel(url, { token: this.blobToken });
    } catch (e) {
      this.logger.warn(`Failed to delete blob ${url}: ${(e as Error).message}`);
    }
  }

  async readFile(url: string): Promise<Buffer> {
    if (url.startsWith('data:')) {
      const i = url.indexOf(',');
      return Buffer.from(url.slice(i + 1), 'base64');
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
