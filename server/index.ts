import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { ensureStorage } from './lib/storage';
import { artifactsRouter } from './routes/artifacts';
import { runsRouter } from './routes/runs';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.use('/api', artifactsRouter);
app.use('/api', runsRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

const distDir = path.resolve(process.cwd(), 'dist');
if (existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(distDir, 'index.html'));
      return;
    }
    next();
  });
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Each file must be 50 MB or smaller.' });
      return;
    }
    res.status(400).json({ error: `Upload rejected: ${error.message}` });
    return;
  }

  const status =
    typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
  const message =
    error instanceof Error ? error.message : 'Unexpected server error.';

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({ error: message });
};

app.use(errorHandler);

const port = Number(process.env.PORT ?? 3001);

await ensureStorage();

app.listen(port, '127.0.0.1', () => {
  console.log(`File Forge API listening on http://127.0.0.1:${port}`);
});
