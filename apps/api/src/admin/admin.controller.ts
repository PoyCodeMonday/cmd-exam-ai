import { Controller, Get, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthGuard } from '../auth/guards/admin.guard';
import { RegistrationsService } from '../registrations/registrations.service';
import { buildNametagPdf } from '../pdf/nametag';

const ADMIN_DOWNLOAD_PREFIX = '/admin/registrations/{regId}/documents/{docId}/download';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly svc: RegistrationsService) {}

  @Get('registrations')
  list() {
    return this.svc.listAll(ADMIN_DOWNLOAD_PREFIX);
  }

  @Get('registrations/:id')
  get(@Param('id') id: string) {
    return this.svc.getById(id, ADMIN_DOWNLOAD_PREFIX);
  }

  @Get('registrations/:id/nametag.pdf')
  async tag(@Param('id') id: string, @Res() res: Response) {
    const reg = await this.svc.getById(id, ADMIN_DOWNLOAD_PREFIX);
    if (!reg) throw new NotFoundException();
    const publicUrl = (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
    const bytes = await buildNametagPdf({
      name_th: reg.name_th || reg.name,
      name_en: reg.name_en,
      organization: reg.organization,
      reference_code: reg.reference_code,
      eventName: process.env.EVENT_NAME || "CMD Exam '26",
      qrUrl: `${publicUrl}/admin/${reg.id}`,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="nametag-${reg.reference_code}.pdf"`);
    res.end(Buffer.from(bytes));
  }

  @Get('registrations/:regId/documents/:docId/download')
  async download(@Param('regId') regId: string, @Param('docId') docId: string, @Res() res: Response) {
    const { doc, bytes } = await this.svc.readDocument(docId, regId);
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.filename.replace(/"/g, '')}"`,
    );
    res.end(bytes);
  }
}
