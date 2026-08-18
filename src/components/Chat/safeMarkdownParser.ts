export const MAX_MARKDOWN_INPUT_LENGTH = 12_000;
export const MAX_MARKDOWN_LINE_LENGTH = 2_000;
export const MAX_MARKDOWN_LINES = 400;
export const MAX_MARKDOWN_BLOCKS = 200;
export const MAX_INLINE_TOKENS = 256;
export const MAX_LINK_LENGTH = 2_048;
const MAX_INLINE_MARKER_SPAN = 1_000;

export type InlineToken =
  | { type: 'text' | 'strong' | 'emphasis' | 'code'; text: string }
  | { type: 'link'; text: string; url: string };

export type MarkdownBlock =
  | { type: 'paragraph'; content: InlineToken[] }
  | { type: 'heading'; level: 1 | 2 | 3; content: InlineToken[] }
  | { type: 'list'; ordered: boolean; items: InlineToken[][] }
  | { type: 'code'; content: string }
  | { type: 'quote'; content: InlineToken[] }
  | { type: 'table'; headers: InlineToken[][]; rows: InlineToken[][][] };

export function boundUntrustedMarkdown(input: string): string {
  return input
    .slice(0, MAX_MARKDOWN_INPUT_LENGTH)
    .replace(/\r\n?/g, '\n');
}

export function isSafeHttpUrl(url: string): boolean {
  if (url.length === 0 || url.length > MAX_LINK_LENGTH) return false;
  const lowerUrl = url.toLowerCase();
  if (!lowerUrl.startsWith('https://') && !lowerUrl.startsWith('http://')) return false;

  for (let index = 0; index < url.length; index += 1) {
    if (url.charCodeAt(index) <= 32) return false;
  }
  return true;
}

function findMarker(source: string, marker: string, from: number): number {
  const searchEnd = Math.min(source.length - marker.length, from + MAX_INLINE_MARKER_SPAN);
  for (let index = from; index <= searchEnd; index += 1) {
    if (source.startsWith(marker, index)) return index;
  }
  return -1;
}

export function parseSafeInline(source: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let index = 0;
  let plainTextStart = 0;

  const flushPlainText = (end: number) => {
    if (end > plainTextStart) tokens.push({ type: 'text', text: source.slice(plainTextStart, end) });
  };

  while (index < source.length && tokens.length < MAX_INLINE_TOKENS - 2) {
    if (source[index] === '`') {
      const end = findMarker(source, '`', index + 1);
      if (end > index + 1) {
        flushPlainText(index);
        tokens.push({ type: 'code', text: source.slice(index + 1, end) });
        index = end + 1;
        plainTextStart = index;
        continue;
      }
    }

    const strongMarker = source.startsWith('**', index)
      ? '**'
      : source.startsWith('__', index)
        ? '__'
        : null;
    if (strongMarker) {
      const end = findMarker(source, strongMarker, index + 2);
      if (end > index + 2) {
        flushPlainText(index);
        tokens.push({ type: 'strong', text: source.slice(index + 2, end) });
        index = end + 2;
        plainTextStart = index;
        continue;
      }
    }

    if (source[index] === '*' || source[index] === '_') {
      const marker = source[index];
      const end = findMarker(source, marker, index + 1);
      if (end > index + 1) {
        flushPlainText(index);
        tokens.push({ type: 'emphasis', text: source.slice(index + 1, end) });
        index = end + 1;
        plainTextStart = index;
        continue;
      }
    }

    if (source[index] === '[') {
      const labelEnd = findMarker(source, '](', index + 1);
      const destinationEnd = labelEnd >= 0 ? findMarker(source, ')', labelEnd + 2) : -1;
      if (labelEnd > index + 1 && destinationEnd > labelEnd + 2) {
        const url = source.slice(labelEnd + 2, destinationEnd).trim();
        if (isSafeHttpUrl(url)) {
          flushPlainText(index);
          tokens.push({
            type: 'link',
            text: source.slice(index + 1, labelEnd),
            url,
          });
          index = destinationEnd + 1;
          plainTextStart = index;
          continue;
        }
      }
    }

    index += 1;
  }

  flushPlainText(source.length);
  return tokens;
}

function boundedLines(input: string): string[] {
  return boundUntrustedMarkdown(input)
    .split('\n', MAX_MARKDOWN_LINES)
    .map(line => line.slice(0, MAX_MARKDOWN_LINE_LENGTH));
}

function headingFor(line: string): { level: 1 | 2 | 3; text: string } | null {
  if (line.startsWith('### ')) return { level: 3, text: line.slice(4) };
  if (line.startsWith('## ')) return { level: 2, text: line.slice(3) };
  if (line.startsWith('# ')) return { level: 1, text: line.slice(2) };
  return null;
}

function unorderedItem(line: string): string | null {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
    return trimmed.slice(2);
  }
  return null;
}

function orderedItem(line: string): string | null {
  const trimmed = line.trimStart();
  let index = 0;
  while (index < trimmed.length && index < 4 && trimmed[index] >= '0' && trimmed[index] <= '9') {
    index += 1;
  }
  if (index > 0 && trimmed.slice(index, index + 2) === '. ') return trimmed.slice(index + 2);
  return null;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|', 12).map(cell => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  if (cells.length < 2) return false;
  return cells.every(cell => {
    let hyphens = 0;
    for (const character of cell) {
      if (character === '-') hyphens += 1;
      else if (character !== ':' && character !== ' ') return false;
    }
    return hyphens >= 3;
  });
}

function startsBlock(lines: string[], index: number): boolean {
  const line = lines[index];
  if (!line || line.trim() === '') return true;
  if (line.trimStart().startsWith('```')) return true;
  if (headingFor(line) || unorderedItem(line) !== null || orderedItem(line) !== null) return true;
  if (line.trimStart().startsWith('> ')) return true;
  return line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1]);
}

export function parseSafeMarkdown(input: string): MarkdownBlock[] {
  const lines = boundedLines(input);
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length && blocks.length < MAX_MARKDOWN_BLOCKS) {
    const line = lines[index];
    if (line.trim() === '') {
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith('```')) {
      index += 1;
      const code: string[] = [];
      while (index < lines.length && !lines[index].trimStart().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', content: code.join('\n') });
      continue;
    }

    const heading = headingFor(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading.level, content: parseSafeInline(heading.text) });
      index += 1;
      continue;
    }

    const firstUnordered = unorderedItem(line);
    const firstOrdered = orderedItem(line);
    if (firstUnordered !== null || firstOrdered !== null) {
      const ordered = firstOrdered !== null;
      const items: InlineToken[][] = [];
      while (index < lines.length) {
        const item = ordered ? orderedItem(lines[index]) : unorderedItem(lines[index]);
        if (item === null) break;
        items.push(parseSafeInline(item));
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    if (line.trimStart().startsWith('> ')) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].trimStart().startsWith('> ')) {
        quote.push(lines[index].trimStart().slice(2));
        index += 1;
      }
      blocks.push({ type: 'quote', content: parseSafeInline(quote.join('\n')) });
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = splitTableRow(line).map(parseSafeInline);
      const rows: InlineToken[][][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
        rows.push(splitTableRow(lines[index]).map(parseSafeInline));
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && !startsBlock(lines, index)) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: 'paragraph', content: parseSafeInline(paragraph.join('\n')) });
  }

  return blocks;
}
