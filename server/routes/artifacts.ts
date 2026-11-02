import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import type { ArtifactRef } from '../../shared/artifacts';
import {
  AudioError,
  extractAudioCover,
  inspectAudio,
  looksLikeAudio,
} from '../lib/audio';
import { ImageError, createThumbnail, inspectImage } from '../lib/images';
import { inspectPdf, looksLikePdf } from '../lib/pdfs';
import { artifactDir, loadArtifact, saveArtifact } from '../lib/storage';

export const artifactsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 20,
  },
});

function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

artifactsRouter.get('/health', (_req, res) => {
  res.json({ ok: true, name: 'file-forge' });
});

artifactsRouter.post('/uploads', upload.array('files', 20), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: 'No files uploaded.' });
    return;
  }

  const requested = typeof req.query.kind === 'string' ? req.query.kind : 'auto';
  if (
    requested !== 'auto' &&
    requested !== 'image' &&
    requested !== 'pdf' &&
    requested !== 'audio'
  ) {
    res.status(400).json({ error: 'Upload kind must be image, pdf, audio or auto.' });
    return;
  }

  const artifacts: ArtifactRef[] = [];

  for (const file of files) {
    const isPdf =
      requested === 'pdf' ||
      (requested === 'auto' && looksLikePdf(file.buffer));
    const isAudio =
      !isPdf &&
      (requested === 'audio' ||
        (requested === 'auto' && looksLikeAudio(file.buffer)));

    if (requested === 'image' && looksLikePdf(file.buffer)) {
      throw new ImageError(
        'This is a PDF. Add it to a PDF Input node instead.',
      );
    }
    if (requested === 'image' && looksLikeAudio(file.buffer)) {
      throw new ImageError(
        'This is an audio file. Add it to an Audio Input node instead.',
      );
    }
    if (requested === 'audio' && !looksLikeAudio(file.buffer)) {
      throw new AudioError('This file is not a supported audio file.');
    }

    if (isPdf) {
      const info = await inspectPdf(file.buffer);
      artifacts.push(
        await saveArtifact({
          buffer: file.buffer,
          name: file.originalname,
          mime: 'application/pdf',
          kind: 'pdf',
          pages: info.pages,
        }),
      );
    } else if (isAudio) {
      const mimeType = file.mimetype.startsWith('audio/') ? file.mimetype : undefined;
      const info = await inspectAudio(file.buffer, file.originalname, mimeType);
      artifacts.push(
        await saveArtifact({
          buffer: file.buffer,
          name: file.originalname,
          mime: info.mime,
          kind: 'audio',
          duration: info.duration,
        }),
      );
    } else {
      const info = await inspectImage(file.buffer);
      artifacts.push(
        await saveArtifact({
          buffer: file.buffer,
          name: file.originalname,
          mime: info.mime,
          kind: 'image',
          width: info.width,
          height: info.height,
        }),
      );
    }
  }

  res.status(201).json({ artifacts });
});

artifactsRouter.get('/artifacts/:id/download', async (req, res) => {
  const artifact = await loadArtifact(req.params.id);
  res.setHeader('Content-Type', artifact.mime);
  res.setHeader('Content-Disposition', contentDisposition(artifact.name));
  res.sendFile(artifact.filePath);
});

artifactsRouter.get('/artifacts/:id/thumb', async (req, res) => {
  const artifact = await loadArtifact(req.params.id);

  if (artifact.kind !== 'image' && artifact.kind !== 'audio') {
    res.status(415).json({ error: 'This artifact has no image thumbnail.' });
    return;
  }

  const thumbnailPath = path.join(artifactDir(artifact.id), 'thumb.png');

  try {
    await fs.access(thumbnailPath);
  } catch {
    const buffer = await fs.readFile(artifact.filePath);
    const cover =
      artifact.kind === 'audio'
        ? await extractAudioCover(buffer, artifact.mime)
        : { buffer, mime: artifact.mime };
    if (!cover) {
      res.status(415).json({ error: 'This audio file has no cover art.' });
      return;
    }
    const thumbnail = await createThumbnail(cover.buffer);
    await fs.writeFile(thumbnailPath, thumbnail);
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(thumbnailPath);
});
