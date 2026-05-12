import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { RegistrationsService, FileInput } from './registrations.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { UserAuthGuard } from '../auth/guards/user.guard';

interface MulterFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

const USER_DOWNLOAD_PREFIX = '/registrations/me/documents/{docId}/download';

function toFileInputs(files: MulterFile[] | undefined): FileInput[] {
  return (files || []).map((f) => ({
    originalName: f.originalname,
    mimeType: f.mimetype,
    buffer: f.buffer,
    size: f.size,
  }));
}

@Controller()
export class RegistrationsController {
  constructor(private readonly svc: RegistrationsService) {}

  @Post('registrations')
  @UseInterceptors(FilesInterceptor('documents', 10, { limits: { fileSize: 4 * 1024 * 1024 } }))
  async create(@Body() body: any, @UploadedFiles() files: MulterFile[]) {
    const dto: CreateRegistrationDto = {
      name_th: body.name_th,
      name_en: body.name_en,
      email: body.email,
      phone: body.phone,
      password: body.password,
      organization: body.organization,
      dietary: body.dietary,
      tshirt_size: body.tshirt_size,
      notes: body.notes,
    };
    const { validate } = await import('class-validator');
    const { plainToInstance } = await import('class-transformer');
    const instance = plainToInstance(CreateRegistrationDto, dto);
    const errors = await validate(instance, { whitelist: true });
    if (errors.length) {
      const messages = errors.flatMap((e) => Object.values(e.constraints || {}));
      throw new BadRequestException(messages.length ? messages : 'Invalid registration');
    }
    return this.svc.create(instance, toFileInputs(files));
  }

  @Get('registrations/me')
  @UseGuards(UserAuthGuard)
  me(@Req() req: any) {
    return this.svc.getById(req.user.sub, USER_DOWNLOAD_PREFIX);
  }

  @Patch('registrations/me')
  @UseGuards(UserAuthGuard)
  async patchMe(@Req() req: any, @Body() body: UpdateRegistrationDto) {
    await this.svc.update(req.user.sub, body);
    return this.svc.getById(req.user.sub, USER_DOWNLOAD_PREFIX);
  }

  @Post('registrations/me/documents')
  @UseGuards(UserAuthGuard)
  @UseInterceptors(FilesInterceptor('documents', 10, { limits: { fileSize: 4 * 1024 * 1024 } }))
  async addDocs(@Req() req: any, @UploadedFiles() files: MulterFile[]) {
    if (!files?.length) throw new BadRequestException('No files');
    await this.svc.addFiles(req.user.sub, toFileInputs(files));
    return this.svc.getById(req.user.sub, USER_DOWNLOAD_PREFIX);
  }

  @Delete('registrations/me/documents/:id')
  @UseGuards(UserAuthGuard)
  async removeDoc(@Req() req: any, @Param('id') id: string) {
    await this.svc.removeDocument(req.user.sub, id);
    return this.svc.getById(req.user.sub, USER_DOWNLOAD_PREFIX);
  }

  @Get('registrations/me/documents/:id/download')
  @UseGuards(UserAuthGuard)
  async download(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const { doc, bytes } = await this.svc.readDocument(id, req.user.sub);
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.filename.replace(/"/g, '')}"`,
    );
    res.end(bytes);
  }
}
