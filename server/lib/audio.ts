import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { parseBuffer, selectCover } from 'music-metadata';

export type AudioFormat = 'mp3' | 'flac' | 'wav' | 'ogg' | 'm4a';

export interface AudioInfo {
  mime: string;
  extension: string;
  duration?: number;
}

export interface ConvertedAudio extends AudioInfo {
  buffer: Buffer;
}

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: string;
  genre?: string;
  track?: string;
  comment?: string;
}

export interface ArtworkInput {
  buffer: Buffer;
  mime: string;
}

const FORMAT_INFO: Record<AudioFormat, { mime: string; extension: string; lossless: boolean }> = {
  mp3: { mime: 'audio/mpeg', extension: 'mp3', lossless: false },
  flac: { mime: 'audio/flac', extension: 'flac', lossless: true },
  wav: { mime: 'audio/wav', extension: 'wav', lossless: true },
  ogg: { mime: 'audio/ogg', extension: 'ogg', lossless: false },
  m4a: { mime: 'audio/mp4', extension: 'm4a', lossless: false },
};

const EXTENSION_INFO: Record<string, { mime: string; extension: string }> = {
  mp3: { mime: 'audio/mpeg', extension: 'mp3' },
  flac: { mime: 'audio/flac', extension: 'flac' },
  wav: { mime: 'audio/wav', extension: 'wav' },
  wave: { mime: 'audio/wav', extension: 'wav' },
  ogg: { mime: 'audio/ogg', extension: 'ogg' },
  oga: { mime: 'audio/ogg', extension: 'ogg' },
  opus: { mime: 'audio/opus', extension: 'opus' },
  m4a: { mime: 'audio/mp4', extension: 'm4a' },
  aac: { mime: 'audio/aac', extension: 'aac' },
  aiff: { mime: 'audio/aiff', extension: 'aiff' },
  aif: { mime: 'audio/aiff', extension: 'aiff' },
  wma: { mime: 'audio/x-ms-wma', extension: 'wma' },
};

const MIME_EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/aiff': 'aiff',
  'audio/x-aiff': 'aiff',
  'audio/x-ms-wma': 'wma',
};

const COVER_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
};

const COVER_FORMATS = new Set(['mp3', 'flac', 'm4a']);

export class AudioError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AudioError';
    this.status = status;
  }
}

export function audioFormatInfo(format: AudioFormat): { mime: string; extension: string; lossless: boolean } {
  return FORMAT_INFO[format];
}

export function looksLikeAudio(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  if (buffer.subarray(0, 3).toString('latin1') === 'ID3') return true;
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;
  if (buffer.subarray(0, 4).toString('latin1') === 'fLaC') return true;
  if (buffer.subarray(0, 4).toString('latin1') === 'OggS') return true;
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
    return true;
  }
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WAVE'
  ) {
    return true;
  }
  if (
    buffer.subarray(0, 4).toString('latin1') === 'FORM' &&
    ['AIFF', 'AIFC'].includes(buffer.subarray(8, 12).toString('latin1'))
  ) {
    return true;
  }
  return buffer[0] === 0x30 && buffer[1] === 0x26 && buffer[2] === 0xb2 && buffer[3] === 0x75;
}

function extensionFromName(name?: string): string | undefined {
  if (!name) return undefined;
  const extension = path.extname(name).replace(/^\./, '').toLowerCase();
  return EXTENSION_INFO[extension] ? extension : undefined;
}

function normalizeInfo(name?: string, mimeType?: string): { mime: string; extension: string } {
  const extension = extensionFromName(name);
  if (extension) return EXTENSION_INFO[extension];

  const fromMime = mimeType ? MIME_EXTENSIONS[mimeType.toLowerCase()] : undefined;
  if (fromMime) return EXTENSION_INFO[fromMime];

  return { mime: mimeType || 'application/octet-stream', extension: extension ?? 'audio' };
}

function durationOf(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export async function inspectAudio(
  buffer: Buffer,
  name?: string,
  mimeType?: string,
): Promise<AudioInfo> {
  let metadata;
  try {
    metadata = await parseBuffer(
      buffer,
      { mimeType, size: buffer.length },
      { duration: true },
    );
  } catch {
    throw new AudioError('The file could not be read as audio.');
  }

  const info = normalizeInfo(name, mimeType);
  const container = metadata.format.container?.toLowerCase() ?? '';
  const codec = metadata.format.codec?.toLowerCase() ?? '';
  const known =
    info.extension !== 'audio' ||
    container.includes('mpeg') ||
    container.includes('flac') ||
    container.includes('wave') ||
    container.includes('ogg') ||
    container.includes('mp4') ||
    container.includes('aiff') ||
    container.includes('asf') ||
    codec.includes('pcm') ||
    codec.includes('vorbis') ||
    codec.includes('opus');

  if (!known) {
    throw new AudioError('Unsupported audio format.');
  }

  return {
    ...info,
    duration: durationOf(metadata.format.duration),
  };
}

export async function extractAudioCover(
  buffer: Buffer,
  mimeType?: string,
): Promise<{ buffer: Buffer; mime: string } | undefined> {
  try {
    const metadata = await parseBuffer(
      buffer,
      { mimeType, size: buffer.length },
      { duration: false },
    );
    const picture = selectCover(metadata.common.picture);
    if (!picture) return undefined;
    return { buffer: Buffer.from(picture.data), mime: picture.format };
  } catch {
    return undefined;
  }
}

function metadataArgs(metadata: AudioMetadata): string[] {
  const fields: Array<[string, string | undefined]> = [
    ['title', metadata.title],
    ['artist', metadata.artist],
    ['album', metadata.album],
    ['album_artist', metadata.albumArtist],
    ['date', metadata.year],
    ['genre', metadata.genre],
    ['track', metadata.track],
    ['comment', metadata.comment],
  ];

  const args: string[] = [];
  for (const [key, value] of fields) {
    const trimmed = value?.trim();
    if (trimmed) args.push('-metadata', `${key}=${trimmed}`);
  }
  return args;
}

function codecArgs(format: AudioFormat, bitrate: string): string[] {
  switch (format) {
    case 'mp3':
      return ['-vn', '-c:a', 'libmp3lame', '-b:a', bitrate];
    case 'flac':
      return ['-vn', '-c:a', 'flac'];
    case 'wav':
      return ['-vn', '-c:a', 'pcm_s16le'];
    case 'ogg':
      return ['-vn', '-c:a', 'libvorbis', '-b:a', bitrate];
    case 'm4a':
      return ['-vn', '-c:a', 'aac', '-b:a', bitrate, '-movflags', '+faststart'];
  }
}

async function runFfmpeg(args: string[]): Promise<void> {
  const binary = ffmpegPath;
  if (!binary) {
    throw new AudioError('FFmpeg is not available on this platform.', 500);
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-8000);
    });
    child.on('error', () => {
      reject(new AudioError('Could not start FFmpeg. Is the binary installed?', 500));
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const lastLine = stderr.trim().split('\n').pop() ?? 'Unknown FFmpeg error.';
      reject(new AudioError(`Audio processing failed: ${lastLine}`, 422));
    });
  });
}

async function withTempDir<T>(operation: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-forge-audio-'));
  try {
    return await operation(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function convertAudio(
  buffer: Buffer,
  format: AudioFormat,
  bitrate: string,
  name?: string,
  mimeType?: string,
): Promise<ConvertedAudio> {
  const info = FORMAT_INFO[format];
  const inputExtension =
    extensionFromName(name) ??
    (mimeType ? MIME_EXTENSIONS[mimeType.toLowerCase()] : undefined);

  return withTempDir(async (dir) => {
    const inputPath = path.join(dir, `input${inputExtension ? `.${inputExtension}` : ''}`);
    const outputPath = path.join(dir, `output.${info.extension}`);
    await fs.writeFile(inputPath, buffer);

    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      ...codecArgs(format, bitrate),
      outputPath,
    ]);

    const output = await fs.readFile(outputPath);
    let duration: number | undefined;
    try {
      duration = durationOf(
        (await parseBuffer(output, { mimeType: info.mime, size: output.length }, { duration: true }))
          .format.duration,
      );
    } catch {
      duration = undefined;
    }

    return {
      buffer: output,
      mime: info.mime,
      extension: info.extension,
      duration,
    };
  });
}

export async function writeAudioMetadata(
  buffer: Buffer,
  name: string,
  metadata: AudioMetadata,
  artwork?: ArtworkInput,
  mimeType?: string,
): Promise<ConvertedAudio> {
  const info = normalizeInfo(name, mimeType);
  if (info.extension === 'audio') {
    throw new AudioError('Unsupported audio format for metadata editing.');
  }
  const coverSupported = COVER_FORMATS.has(info.extension);

  return withTempDir(async (dir) => {
    const inputPath = path.join(dir, `input.${info.extension}`);
    const outputPath = path.join(dir, `output.${info.extension}`);
    await fs.writeFile(inputPath, buffer);

    const args = ['-y', '-i', inputPath];
    let coverPath: string | undefined;

    if (artwork && coverSupported) {
      const coverExtension = COVER_EXTENSIONS[artwork.mime.toLowerCase()] ?? 'jpg';
      coverPath = path.join(dir, `cover.${coverExtension}`);
      await fs.writeFile(coverPath, artwork.buffer);
      args.push('-i', coverPath, '-map', '0:a', '-map', '1:v');
    } else {
      args.push('-map', '0');
    }

    args.push('-map_metadata', '0');

    args.push('-c', 'copy');

    if (artwork && coverSupported) {
      if (info.extension === 'm4a') {
        args.push('-c:v', 'mjpeg', '-disposition:v', 'attached_pic');
      } else if (info.extension === 'mp3') {
        args.push(
          '-id3v2_version',
          '3',
          '-metadata:s:v',
          'title=Album cover',
          '-metadata:s:v',
          'comment=Cover (front)',
        );
      } else {
        args.push('-disposition:v', 'attached_pic');
      }
    }

    args.push(...metadataArgs(metadata), outputPath);

    await runFfmpeg(args);

    const output = await fs.readFile(outputPath);
    let duration: number | undefined;
    try {
      duration = durationOf(
        (await parseBuffer(output, { mimeType: info.mime, size: output.length }, { duration: true }))
          .format.duration,
      );
    } catch {
      duration = undefined;
    }

    return {
      buffer: output,
      mime: info.mime,
      extension: info.extension,
      duration,
    };
  });
}
