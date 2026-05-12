import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { StorageService, RegistrationRow, RegistrationDocumentRow } from '../storage/storage.service';
import { generateReferenceCode } from './ref-code.util';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);
export const MAX_BYTES = 4 * 1024 * 1024; // 4 MB — under Vercel's 4.5 MB body cap

export interface FileInput {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
}

export interface RegistrationDocumentView {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  download_path: string;
}

export interface RegistrationView {
  id: string;
  reference_code: string;
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
  documents: RegistrationDocumentView[];
}

@Injectable()
export class RegistrationsService {
  constructor(private readonly storage: StorageService) {}

  private validateFiles(files: FileInput[]): void {
    for (const f of files) {
      if (f.size > MAX_BYTES) throw new BadRequestException(`File ${f.originalName} exceeds 4MB limit`);
      if (!ALLOWED_MIME.has(f.mimeType))
        throw new BadRequestException(`File ${f.originalName} has disallowed type ${f.mimeType}`);
    }
  }

  async create(dto: CreateRegistrationDto, files: FileInput[]): Promise<{ reference_code: string; id: string }> {
    this.validateFiles(files);
    const id = randomUUID();
    const password_hash = await bcrypt.hash(dto.password, 10);

    let inserted: RegistrationRow | null = null;
    let attempts = 0;
    while (!inserted && attempts < 5) {
      attempts++;
      const reference_code = generateReferenceCode();
      try {
        inserted = await this.storage.insertRegistration({
          id,
          reference_code,
          password_hash,
          name: dto.name_th,
          name_th: dto.name_th,
          name_en: dto.name_en ?? null,
          email: dto.email,
          phone: dto.phone,
          organization: dto.organization ?? null,
          dietary: dto.dietary ?? null,
          tshirt_size: dto.tshirt_size ?? null,
          notes: dto.notes ?? null,
        });
      } catch (e: any) {
        if (e?.code === '23505' || /duplicate/i.test(e?.message || '')) continue;
        throw e;
      }
    }
    if (!inserted) throw new ConflictException('Could not allocate reference code');

    for (const f of files) await this.attachFile(inserted.id, f);
    return { reference_code: inserted.reference_code, id: inserted.id };
  }

  async attachFile(registrationId: string, f: FileInput): Promise<RegistrationDocumentRow> {
    const docId = randomUUID();
    const safeName = f.originalName.replace(/[^A-Za-z0-9._-]/g, '_').slice(-100);
    const blobUrl = await this.storage.uploadFile(`${registrationId}/${docId}-${safeName}`, {
      buffer: f.buffer,
      contentType: f.mimeType,
    });
    return this.storage.insertDocument({
      id: docId,
      registration_id: registrationId,
      filename: f.originalName,
      storage_path: blobUrl,
      mime_type: f.mimeType,
      size_bytes: f.size,
    });
  }

  async addFiles(registrationId: string, files: FileInput[]): Promise<RegistrationDocumentRow[]> {
    this.validateFiles(files);
    const out: RegistrationDocumentRow[] = [];
    for (const f of files) out.push(await this.attachFile(registrationId, f));
    return out;
  }

  async removeDocument(registrationId: string, documentId: string): Promise<void> {
    const doc = await this.storage.findDocument(documentId);
    if (!doc || doc.registration_id !== registrationId) throw new NotFoundException('Document not found');
    await this.storage.removeFile(doc.storage_path);
    await this.storage.deleteDocument(documentId, registrationId);
  }

  async update(registrationId: string, dto: UpdateRegistrationDto): Promise<RegistrationRow> {
    const exists = await this.storage.findById(registrationId);
    if (!exists) throw new NotFoundException('Registration not found');
    return this.storage.updateRegistration(registrationId, dto as any);
  }

  async getById(id: string, downloadPrefix: string): Promise<RegistrationView> {
    const row = await this.storage.findById(id);
    if (!row) throw new NotFoundException('Registration not found');
    return this.toView(row, downloadPrefix);
  }

  async getByReferenceCode(code: string): Promise<RegistrationRow | null> {
    return this.storage.findByReferenceCode(code);
  }

  async listAll(downloadPrefix: string): Promise<RegistrationView[]> {
    const rows = await this.storage.listAllRegistrations();
    return Promise.all(rows.map((r) => this.toView(r, downloadPrefix)));
  }

  async readDocument(documentId: string, registrationId: string): Promise<{ doc: RegistrationDocumentRow; bytes: Buffer }> {
    const doc = await this.storage.findDocument(documentId);
    if (!doc || doc.registration_id !== registrationId) throw new NotFoundException('Document not found');
    const bytes = await this.storage.readFile(doc.storage_path);
    return { doc, bytes };
  }

  async readDocumentAdmin(documentId: string): Promise<{ doc: RegistrationDocumentRow; bytes: Buffer }> {
    const doc = await this.storage.findDocument(documentId);
    if (!doc) throw new NotFoundException('Document not found');
    const bytes = await this.storage.readFile(doc.storage_path);
    return { doc, bytes };
  }

  private async toView(row: RegistrationRow, downloadPrefix: string): Promise<RegistrationView> {
    const docs = await this.storage.listDocuments(row.id);
    return {
      id: row.id,
      reference_code: row.reference_code,
      name: row.name_th || row.name,
      name_th: row.name_th || row.name,
      name_en: row.name_en,
      email: row.email,
      phone: row.phone,
      organization: row.organization,
      dietary: row.dietary,
      tshirt_size: row.tshirt_size,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      documents: docs.map((d) => ({
        id: d.id,
        filename: d.filename,
        mime_type: d.mime_type,
        size_bytes: d.size_bytes,
        uploaded_at: d.uploaded_at,
        download_path: downloadPrefix.replace('{docId}', d.id).replace('{regId}', row.id),
      })),
    };
  }
}
