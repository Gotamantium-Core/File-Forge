import sharp from 'sharp';
import type { Metadata } from 'sharp';

const SUPPORTED_FORMATS = new Set([
  'jpeg',
  'jpg',
  'png',
  'webp',
  'gif',
  'tiff',
  'avif',
  'bmp',
  'heif',
]);

export class ImageError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ImageError';
    this.status = status;
  }
}

export interface NormalizedImage {
  buffer: Buffer;
  format: 'png' | 'jpeg';
  width: number;
  height: number;
}

export async function inspectImage(buffer: Buffer): Promise<{
  format: string;
  mime: string;
  width: number;
  height: number;
}> {
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { failOn: 'none' }).metadata();
  } catch {
    throw new ImageError('The file could not be read as an image.');
  }

  const format = metadata.format;
  if (!format || !SUPPORTED_FORMATS.has(format)) {
    throw new ImageError('Unsupported image format. Use JPEG, PNG, WebP, GIF, TIFF or BMP.');
  }
  if (!metadata.width || !metadata.height) {
    throw new ImageError('The image has no readable dimensions.');
  }

  const mime = `image/${format}`;
  return { format, mime, width: metadata.width, height: metadata.height };
}

export async function normalizeImage(buffer: Buffer): Promise<NormalizedImage> {
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { failOn: 'none' }).metadata();
  } catch {
    throw new ImageError('The file could not be read as an image.');
  }

  const hasAlpha = Boolean(metadata.hasAlpha);
  const pipeline = sharp(buffer, { failOn: 'none' }).rotate();
  const encoded = hasAlpha
    ? pipeline.png({ compressionLevel: 9 })
    : pipeline.jpeg({ quality: 92, mozjpeg: true });

  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    format: hasAlpha ? 'png' : 'jpeg',
    width: info.width,
    height: info.height,
  };
}

export interface ConvertedImage {
  buffer: Buffer;
  format: 'png' | 'jpeg' | 'webp';
  width: number;
  height: number;
  mime: string;
  extension: string;
}

export async function convertImage(
  buffer: Buffer,
  format: 'png' | 'jpeg' | 'webp',
  quality: number,
): Promise<ConvertedImage> {
  const pipeline = sharp(buffer, { failOn: 'none' }).rotate();

  let encoded;
  if (format === 'png') {
    encoded = pipeline.png({ compressionLevel: 9 });
  } else if (format === 'webp') {
    encoded = pipeline.webp({ quality });
  } else {
    encoded = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true });
  }

  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    format,
    width: info.width,
    height: info.height,
    mime: `image/${format}`,
    extension: format === 'jpeg' ? 'jpg' : format,
  };
}

export async function createThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(360, 360, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
