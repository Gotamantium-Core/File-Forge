export class PageSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageSelectionError';
  }
}

function ensurePageCount(pageCount: number): void {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new PageSelectionError('The PDF has no readable pages.');
  }
}

function tokenize(expression: string): string[] {
  const text = typeof expression === 'string' ? expression.trim() : '';
  if (!text) {
    throw new PageSelectionError(
      'Enter at least one page number or range, such as 1, 3-5.',
    );
  }

  const tokens = text
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new PageSelectionError(
      'Enter at least one page number or range, such as 1, 3-5.',
    );
  }

  return tokens;
}

function expandToken(token: string, pageCount: number): number[] {
  const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
  if (!match) {
    throw new PageSelectionError(
      `"${token}" is not a valid page or range. Use numbers like 2 or 3-5.`,
    );
  }

  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);

  if (start < 1 || end < 1) {
    throw new PageSelectionError('Page numbers start at 1.');
  }
  if (end < start) {
    throw new PageSelectionError(`The range "${token}" runs backwards.`);
  }
  if (start > pageCount || end > pageCount) {
    throw new PageSelectionError(
      `Page ${Math.max(start, end)} is out of range. This PDF has ${pageCount} page${
        pageCount === 1 ? '' : 's'
      }.`,
    );
  }

  const pages: number[] = [];
  for (let page = start; page <= end; page += 1) {
    pages.push(page - 1);
  }
  return pages;
}

export function parsePageSelection(
  expression: string,
  pageCount: number,
): number[] {
  ensurePageCount(pageCount);

  const seen = new Set<number>();
  const pages: number[] = [];

  for (const token of tokenize(expression)) {
    for (const index of expandToken(token, pageCount)) {
      if (seen.has(index)) continue;
      seen.add(index);
      pages.push(index);
    }
  }

  return pages;
}

export function parsePageOrder(
  expression: string,
  pageCount: number,
): number[] {
  ensurePageCount(pageCount);

  const order: number[] = [];
  const seen = new Set<number>();

  for (const token of tokenize(expression)) {
    for (const index of expandToken(token, pageCount)) {
      if (seen.has(index)) {
        throw new PageSelectionError(
          `Page ${index + 1} appears more than once in the order.`,
        );
      }
      seen.add(index);
      order.push(index);
    }
  }

  if (order.length !== pageCount) {
    throw new PageSelectionError(
      `List all ${pageCount} pages exactly once to reorder this PDF.`,
    );
  }

  return order;
}

export function parsePageSplitGroups(
  expression: string,
  pageCount: number,
): number[][] {
  ensurePageCount(pageCount);

  const groups = tokenize(expression).map((token) =>
    expandToken(token, pageCount),
  );
  const assigned = new Map<number, number>();

  groups.forEach((group, groupIndex) => {
    for (const index of group) {
      if (assigned.has(index)) {
        throw new PageSelectionError(
          `Page ${index + 1} is used in more than one part.`,
        );
      }
      assigned.set(index, groupIndex);
    }
  });

  return groups;
}

export function chunkPageGroups(
  pageCount: number,
  chunkSize: number,
): number[][] {
  ensurePageCount(pageCount);

  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new PageSelectionError('Chunk size must be at least 1 page.');
  }

  const groups: number[][] = [];
  for (let start = 0; start < pageCount; start += chunkSize) {
    const group: number[] = [];
    for (
      let index = start;
      index < Math.min(start + chunkSize, pageCount);
      index += 1
    ) {
      group.push(index);
    }
    groups.push(group);
  }
  return groups;
}
