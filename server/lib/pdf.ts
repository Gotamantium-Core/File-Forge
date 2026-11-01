import { PDFDocument, rgb } from 'pdf-lib';
import type { RGB } from 'pdf-lib';
import sharp from 'sharp';
import { normalizeImage } from './images';
import type { NormalizedImage } from './images';

export interface ImageToPdfOptions {
  pageSize: 'fit' | 'a4' | 'letter';
  orientation: 'auto' | 'portrait' | 'landscape';
  fit: 'contain' | 'cover' | 'stretch';
  marginMm: number;
  background: string;
}

export interface PageLayout {
  pageWidth: number;
  pageHeight: number;
  drawWidth: number;
  drawHeight: number;
  x: number;
  y: number;
  cropAspect?: number;
}

const PT_PER_MM = 72 / 25.4;
const PX_TO_PT = 72 / 96;
const A4 = { width: 595.28, height: 841.89 };
const LETTER = { width: 612, height: 792 };

function parseHexColor(value: string): RGB {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return rgb(1, 1, 1);
  const int = Number.parseInt(match[1], 16);
  return rgb(
    ((int >> 16) & 0xff) / 255,
    ((int >> 8) & 0xff) / 255,
    (int & 0xff) / 255,
  );
}

export function computePageLayout(
  imageWidth: number,
  imageHeight: number,
  options: ImageToPdfOptions,
): PageLayout {
  const margin = Math.max(0, options.marginMm) * PT_PER_MM;

  if (options.pageSize === 'fit') {
    const width = imageWidth * PX_TO_PT;
    const height = imageHeight * PX_TO_PT;
    return {
      pageWidth: width + margin * 2,
      pageHeight: height + margin * 2,
      drawWidth: width,
      drawHeight: height,
      x: margin,
      y: margin,
    };
  }

  const base = options.pageSize === 'a4' ? A4 : LETTER;
  const landscape =
    options.orientation === 'landscape' ||
    (options.orientation === 'auto' && imageWidth > imageHeight);

  const pageWidth = landscape ? base.height : base.width;
  const pageHeight = landscape ? base.width : base.height;
  const availableWidth = Math.max(1, pageWidth - margin * 2);
  const availableHeight = Math.max(1, pageHeight - margin * 2);

  if (options.fit === 'stretch') {
    return {
      pageWidth,
      pageHeight,
      drawWidth: availableWidth,
      drawHeight: availableHeight,
      x: margin,
      y: margin,
    };
  }

  if (options.fit === 'cover') {
    return {
      pageWidth,
      pageHeight,
      drawWidth: availableWidth,
      drawHeight: availableHeight,
      x: margin,
      y: margin,
      cropAspect: availableWidth / availableHeight,
    };
  }

  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;

  return {
    pageWidth,
    pageHeight,
    drawWidth,
    drawHeight,
    x: margin + (availableWidth - drawWidth) / 2,
    y: margin + (availableHeight - drawHeight) / 2,
  };
}

async function cropToAspect(image: NormalizedImage, aspect: number): Promise<Buffer> {
  const sourceAspect = image.width / image.height;
  let cropWidth = image.width;
  let cropHeight = image.height;

  if (sourceAspect > aspect) {
    cropWidth = Math.max(1, Math.round(image.height * aspect));
  } else if (sourceAspect < aspect) {
    cropHeight = Math.max(1, Math.round(image.width / aspect));
  }

  const left = Math.max(0, Math.floor((image.width - cropWidth) / 2));
  const top = Math.max(0, Math.floor((image.height - cropHeight) / 2));
  const width = Math.min(cropWidth, image.width - left);
  const height = Math.min(cropHeight, image.height - top);

  const pipeline = sharp(image.buffer).extract({ left, top, width, height });
  return image.format === 'png'
    ? pipeline.png({ compressionLevel: 9 }).toBuffer()
    : pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

export async function buildPdfFromImages(
  images: Array<{ buffer: Buffer }>,
  options: ImageToPdfOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const background = parseHexColor(options.background);

  for (const image of images) {
    const normalized = await normalizeImage(image.buffer);
    const layout = computePageLayout(normalized.width, normalized.height, options);

    const drawBuffer = layout.cropAspect
      ? await cropToAspect(normalized, layout.cropAspect)
      : normalized.buffer;

    const embedded =
      normalized.format === 'png'
        ? await doc.embedPng(drawBuffer)
        : await doc.embedJpg(drawBuffer);

    const page = doc.addPage([layout.pageWidth, layout.pageHeight]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: layout.pageWidth,
      height: layout.pageHeight,
      color: background,
    });
    page.drawImage(embedded, {
      x: layout.x,
      y: layout.y,
      width: layout.drawWidth,
      height: layout.drawHeight,
    });
  }

  doc.setProducer('File Forge');
  doc.setCreator('File Forge');
  return doc.save();
}
