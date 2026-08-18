import {
  MAX_INLINE_TOKENS,
  MAX_LINK_LENGTH,
  MAX_MARKDOWN_BLOCKS,
  MAX_MARKDOWN_INPUT_LENGTH,
  boundUntrustedMarkdown,
  isSafeHttpUrl,
  parseSafeInline,
  parseSafeMarkdown,
} from './safeMarkdownParser';

describe('safe markdown parsing', () => {
  it('preserves the supported chat formatting contract', () => {
    const blocks = parseSafeMarkdown(`# Heading

Paragraph with **bold**, *emphasis*, \`code\`, and [Delta](https://delta.health).

- first item
- second item

> private context

| Metric | Value |
| --- | --- |
| Sleep | 8h |

\`\`\`text
bounded code
\`\`\``);

    expect(blocks.map(block => block.type)).toEqual([
      'heading',
      'paragraph',
      'list',
      'quote',
      'table',
      'code',
    ]);
    expect(blocks[1]).toMatchObject({
      type: 'paragraph',
      content: expect.arrayContaining([
        { type: 'strong', text: 'bold' },
        { type: 'emphasis', text: 'emphasis' },
        { type: 'code', text: 'code' },
        { type: 'link', text: 'Delta', url: 'https://delta.health' },
      ]),
    });
  });

  it('treats non-http destinations as text instead of actionable links', () => {
    const tokens = parseSafeInline(
      '[script](javascript:alert(1)) [file](file:///private/data) [data](data:text/plain,test)'
    );

    expect(tokens.some(token => token.type === 'link')).toBe(false);
    expect(isSafeHttpUrl('https://delta.health/path')).toBe(true);
    expect(isSafeHttpUrl(`https://delta.health/${'a'.repeat(MAX_LINK_LENGTH)}`)).toBe(false);
  });

  it('bounds oversized model output before parsing', () => {
    const pathological = `${'a'.repeat(MAX_MARKDOWN_INPUT_LENGTH * 2)}\n# ignored`;
    const bounded = boundUntrustedMarkdown(pathological);
    const blocks = parseSafeMarkdown(pathological);

    expect(bounded).toHaveLength(MAX_MARKDOWN_INPUT_LENGTH);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
  });

  it('handles pathological incomplete links and emphasis with bounded output', () => {
    const pathological = `${'['.repeat(4_000)}${'*'.repeat(4_000)}${'http://'.repeat(1_000)}`;
    const tokens = parseSafeInline(boundUntrustedMarkdown(pathological));

    expect(tokens.length).toBeLessThanOrEqual(MAX_INLINE_TOKENS);
    expect(tokens.some(token => token.type === 'link')).toBe(false);
  });

  it('caps adversarial block expansion', () => {
    const input = Array.from({ length: MAX_MARKDOWN_BLOCKS * 3 }, (_, index) => `# heading ${index}`)
      .join('\n\n');

    expect(parseSafeMarkdown(input).length).toBeLessThanOrEqual(MAX_MARKDOWN_BLOCKS);
  });
});
