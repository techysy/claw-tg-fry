/**
 * Escape special characters for Telegram HTML mode.
 * Safe characters: & -> &amp;, < -> &lt;, > -> &gt;
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape special characters for Telegram MarkdownV2 mode.
 * MarkdownV2 requires escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Format expandable quote for Telegram.
 * Telegram Bot API 7.3+ supports expandable blockquotes via HTML `<blockquote expandable>...</blockquote>`
 * or MarkdownV2 `**> quote`.
 */
export function renderExpandableQuote(content: string, format: 'HTML' | 'MarkdownV2' = 'HTML'): string {
  if (!content.trim()) return '';

  if (format === 'HTML') {
    return `<blockquote expandable>${escapeHtml(content)}</blockquote>`;
  } else {
    const lines = content.split('\n');
    return lines.map((l) => `**>${escapeMarkdownV2(l)}`).join('\n');
  }
}
