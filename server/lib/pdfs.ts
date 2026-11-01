import { PDFDocument, degrees } from 'pdf-lib';
import {
  chunkPageGroups,
  parsePageOrder,
  parsePageSelection,
  parsePageSplitGroups,
} from '../../shared/pdfs';

export class PdfError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PdfError';
    this.status = status;
  }
}

export interface PdfInput {
  buffer: Buffer;
  name: string;
}

export interface PdfOutput {
  bytes: Buffer;
  pages: number;
}

export function looksLikePdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 1024).toString('latin1').includes('%PDF-');
}

export async function inspectPdf(buffer: Buffer): Promise<{ pages: number }> {
  try {
    const document = await PDFDocument.load(buffer, {
      updateMetadata: false,
    });
    const pages = document.getPageCount();
    if (pages < 1) {
      throw new Error('No pages');
    }
    return { pages };
  } catch {
    throw new PdfError(
      'The file could not be read as a PDF. It may be encrypted, password-protected or damaged.',
    );
  }
}

async function openPdf(input: PdfInput): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(input.buffer, { updateMetadata: false });
  } catch {
    throw new PdfError(
      `"${input.name}" could not be read as a PDF. It may be encrypted or damaged.`,
    );
  }
}

function finalize(document: PDFDocument): void {
  document.setProducer('File Forge');
  document.setCreator('File Forge');
}

async function copyPages(
  source: PDFDocument,
  indices: number[],
): Promise<PdfOutput> {
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, indices);
  for (const page of pages) {
    output.addPage(page);
  }
  finalize(output);
  return {
    bytes: Buffer.from(await output.save()),
    pages: indices.length,
  };
}

export async function mergePdfDocuments(
  inputs: PdfInput[],
): Promise<PdfOutput> {
  if (inputs.length === 0) {
    throw new PdfError('Connect at least one PDF to merge.');
  }

  const output = await PDFDocument.create();
  let pages = 0;

  for (const input of inputs) {
    const source = await openPdf(input);
    const sourcePages = await output.copyPages(
      source,
      source.getPageIndices(),
    );
    for (const page of sourcePages) {
      output.addPage(page);
    }
    pages += sourcePages.length;
  }

  if (pages === 0) {
    throw new PdfError('The connected PDFs contain no pages.');
  }

  finalize(output);
  return {
    bytes: Buffer.from(await output.save()),
    pages,
  };
}

export async function splitPdfDocument(
  input: PdfInput,
  mode: 'chunks' | 'ranges',
  options: { chunkSize: number; ranges: string },
): Promise<PdfOutput[]> {
  const source = await openPdf(input);
  const pageCount = source.getPageCount();

  const groups =
    mode === 'chunks'
      ? chunkPageGroups(pageCount, options.chunkSize)
      : parsePageSplitGroups(options.ranges, pageCount);

  const outputs: PdfOutput[] = [];
  for (const group of groups) {
    outputs.push(await copyPages(source, group));
  }
  return outputs;
}

export async function rotatePdfDocument(
  input: PdfInput,
  angle: number,
  scope: 'all' | 'custom',
  pages: string,
): Promise<PdfOutput> {
  const document = await openPdf(input);
  const pageCount = document.getPageCount();
  const indices =
    scope === 'all'
      ? document.getPageIndices()
      : parsePageSelection(pages, pageCount);

  for (const index of indices) {
    const page = document.getPage(index);
    const current = page.getRotation().angle;
    page.setRotation(degrees((((current + angle) % 360) + 360) % 360));
  }

  finalize(document);
  return {
    bytes: Buffer.from(await document.save()),
    pages: pageCount,
  };
}

export async function extractPdfPages(
  input: PdfInput,
  pages: string,
): Promise<PdfOutput> {
  const source = await openPdf(input);
  const indices = parsePageSelection(pages, source.getPageCount());
  return copyPages(source, indices);
}

export async function deletePdfPages(
  input: PdfInput,
  pages: string,
): Promise<PdfOutput> {
  const source = await openPdf(input);
  const pageCount = source.getPageCount();
  const removed = new Set(parsePageSelection(pages, pageCount));
  const kept = source.getPageIndices().filter((index) => !removed.has(index));

  if (kept.length === 0) {
    throw new PdfError('At least one page must remain in the PDF.');
  }

  return copyPages(source, kept);
}

export async function reorderPdfPages(
  input: PdfInput,
  order: string,
): Promise<PdfOutput> {
  const source = await openPdf(input);
  const indices = parsePageOrder(order, source.getPageCount());
  return copyPages(source, indices);
}
