import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as QRCode from 'qrcode';

export interface NametagInput {
  name_th: string;
  name_en?: string | null;
  organization?: string | null;
  reference_code: string;
  eventName: string;
  qrUrl: string;
}

// Find the fonts directory across deployment shapes:
//   * Local Nest standalone:  apps/api/dist/pdf  -> apps/api/dist/assets/fonts
//   * Local Nest via ts-node: apps/api/src/pdf   -> apps/api/assets/fonts
//   * Vercel serverless fn:   /var/task/api/assets/fonts (Next traces via fs.readFileSync)
function fontsDir(): string {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(__dirname, '../assets/fonts'),
    path.resolve(__dirname, '../../assets/fonts'),
    path.resolve(__dirname, '../../../api/assets/fonts'),
    path.resolve(__dirname, '../../../../api/assets/fonts'),
    path.resolve(__dirname, '../../../../../api/assets/fonts'),
    path.resolve(__dirname, '../../../../../../api/assets/fonts'),
    path.resolve(__dirname, '../../../../../../../api/assets/fonts'),
    path.resolve(cwd, 'apps/api/assets/fonts'),
    path.resolve(cwd, 'api/assets/fonts'),
    path.resolve(cwd, 'assets/fonts'),
    path.resolve(cwd, 'apps/web/fonts'),
    path.resolve(cwd, 'fonts'),
    '/var/task/api/assets/fonts',
    '/var/task/apps/api/assets/fonts',
    '/var/task/apps/web/fonts',
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  // Final attempt: walk up from __dirname looking for api/assets/fonts
  let cur = __dirname;
  for (let i = 0; i < 10; i++) {
    const guess = path.join(cur, 'api/assets/fonts');
    if (fs.existsSync(guess)) return guess;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  throw new Error(
    `Fonts directory not found. __dirname=${__dirname}, cwd=${cwd}. Tried: ${candidates.join(', ')}`,
  );
}

const TERRA  = rgb(0xC6 / 255, 0x74 / 255, 0x50 / 255);  // #C67450
const TERRA_DEEP = rgb(0x9C / 255, 0x55 / 255, 0x38 / 255);
const CREAM  = rgb(0xFB / 255, 0xF7 / 255, 0xF0 / 255);  // #FBF7F0
const INK    = rgb(0x22 / 255, 0x1C / 255, 0x14 / 255);
const INK_3  = rgb(0x8A / 255, 0x7E / 255, 0x6C / 255);

export async function buildNametagPdf(input: NametagInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const dir = fontsDir();
  const thaiBold    = await doc.embedFont(fs.readFileSync(path.join(dir, 'IBMPlexSansThai-Bold.ttf')), { subset: true });
  const thaiSemi    = await doc.embedFont(fs.readFileSync(path.join(dir, 'IBMPlexSansThai-SemiBold.ttf')), { subset: true });
  const thaiReg     = await doc.embedFont(fs.readFileSync(path.join(dir, 'IBMPlexSansThai-Regular.ttf')), { subset: true });
  const serifItalic = await doc.embedFont(fs.readFileSync(path.join(dir, 'IBMPlexSerif-Italic.ttf')), { subset: true });
  const mono        = await doc.embedFont(fs.readFileSync(path.join(dir, 'IBMPlexMono-Regular.ttf')), { subset: true });

  // Landscape badge — A6-ish landscape but bigger for print quality. 840 x 540 pt.
  const W = 840, H = 540;
  const page = doc.addPage([W, H]);

  // -------- Terra top band --------
  const bandH = Math.round(H * 0.34);
  page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: TERRA });

  // Lanyard slot (rounded pill) centered on the band's top edge
  const slotW = 84, slotH = 12;
  page.drawRectangle({
    x: (W - slotW) / 2,
    y: H - 26,
    width: slotW,
    height: slotH,
    color: CREAM,
    opacity: 0.55,
  });

  // -------- Title in band --------
  const titleSize = 28;
  page.drawText(input.eventName, {
    x: 44, y: H - bandH / 2 - titleSize / 3,
    size: titleSize, font: serifItalic, color: CREAM,
  });

  // -------- Ref code in band (top-right, mono) --------
  const refSize = 14;
  const refText = input.reference_code;
  const refWidth = mono.widthOfTextAtSize(refText, refSize);
  page.drawText(refText, {
    x: W - 44 - refWidth, y: H - bandH / 2 - refSize / 3,
    size: refSize, font: mono, color: CREAM,
  });

  // -------- Body region (below band) --------
  const bodyLeft = 44;
  const bodyTop = H - bandH - 36;

  // QR code (right side)
  const qrPng = await QRCode.toBuffer(input.qrUrl, {
    type: 'png',
    margin: 1,
    width: 320,
    errorCorrectionLevel: 'M',
    color: { dark: '#221C14', light: '#FBF7F0' },
  });
  const qrImg = await doc.embedPng(qrPng);
  const qrSize = 170;
  const qrX = W - 44 - qrSize;
  const qrY = bodyTop - qrSize + 8;
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // Ref code label under the QR (terracotta mono)
  const qrLabelSize = 12;
  const qrLabelWidth = mono.widthOfTextAtSize(refText, qrLabelSize);
  page.drawText(refText, {
    x: qrX + (qrSize - qrLabelWidth) / 2,
    y: qrY - 18,
    size: qrLabelSize, font: mono, color: TERRA_DEEP,
  });

  // CANDIDATE eyebrow
  const eyebrowSize = 11;
  page.drawText('CANDIDATE', {
    x: bodyLeft, y: bodyTop,
    size: eyebrowSize, font: thaiSemi, color: INK_3,
    // letter-spacing simulated by character spacing below — pdf-lib lacks it,
    // we live with default spacing.
  });

  // Thai name — auto-shrink to fit the available width
  const availableW = qrX - bodyLeft - 24;
  let nameSize = 48;
  while (thaiBold.widthOfTextAtSize(input.name_th, nameSize) > availableW && nameSize > 22) {
    nameSize -= 2;
  }
  page.drawText(input.name_th, {
    x: bodyLeft, y: bodyTop - 18 - nameSize,
    size: nameSize, font: thaiBold, color: INK,
  });

  // English transliteration (if provided)
  if (input.name_en && input.name_en.trim()) {
    const enSize = 18;
    page.drawText(input.name_en, {
      x: bodyLeft, y: bodyTop - 18 - nameSize - 28,
      size: enSize, font: thaiReg, color: INK_3,
    });
  }

  // ORGANIZATION eyebrow (bottom-left)
  page.drawText('ORGANIZATION', {
    x: bodyLeft, y: 64,
    size: eyebrowSize, font: thaiSemi, color: INK_3,
  });
  if (input.organization) {
    const orgSize = 18;
    page.drawText(input.organization, {
      x: bodyLeft, y: 36,
      size: orgSize, font: thaiBold, color: INK,
    });
  }

  return doc.save();
}
