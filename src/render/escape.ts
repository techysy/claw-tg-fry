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
 * Telegram HTML entity references (&#NNNN; / &#xHHHH;) are valid **only** when
 * terminated with `;`. Bare `&NNN` / `&xHH` are rejected by the Bot API.
 * This pass neutralises those so plain text like `?a=1&x2=2` stays sendable.
 */
export function escapeBareHtmlEntities(text: string): string {
  return text.replace(/&(?!(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)/g, '&amp;');
}

/**
 * Convert standard Markdown syntax to Telegram-safe HTML format.
 *
 * Handles:
 * - ```code blocks``` -> <pre><code>...</code></pre>
 * - `inline code` -> <code>...</code>
 * - **bold** / __bold__ -> <b>...</b>
 * - *italic* / _italic_ -> <i>...</i>
 * - ~~strikethrough~~ -> <s>...</s>
 * - [text](url) -> <a href="url">text</a>
 *
 * Raw text is HTML-escaped before emphasis is re-applied, so `**加粗**`
 * renders bold instead of being mangled.
 */
export function markdownToTelegramHtml(markdown: string): string {
  if (!markdown) return '';

  const placeholders: string[] = [];
  const pushPlaceholder = (rawHtml: string): string => {
    const key = `\x00PH_${placeholders.length}\x00`;
    placeholders.push(rawHtml);
    return key;
  };

  let text = markdown;

  // 1. Code blocks ```lang\ncode\n```
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    return pushPlaceholder(`<pre><code${langAttr}>${escapeHtml(code)}</code></pre>`);
  });

  // 2. Inline code `code`
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    return pushPlaceholder(`<code>${escapeHtml(code)}</code>`);
  });

  // 3. Escape raw HTML entities and tags in the remaining text
  //    (bare &NNN / &xHH are rejected by the Bot API; markdown emphasis below re-applies real markup)
  text = escapeBareHtmlEntities(text).replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 4. Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  text = text.replace(/__(.+?)__/g, '<b>$1</b>');

  // 5. Italic: *text* or _text_
  text = text.replace(/(?<![a-zA-Z0-9])\*([^*\n]+)\*(?![a-zA-Z0-9])/g, '<i>$1</i>');
  text = text.replace(/(?<![a-zA-Z0-9])_([^_\n]+)_(?![a-zA-Z0-9])/g, '<i>$1</i>');

  // 6. Strikethrough: ~~text~~
  text = text.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // 7. Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  // 8. Restore placeholders
  for (let i = placeholders.length - 1; i >= 0; i--) {
    text = text.replace(`\x00PH_${i}\x00`, placeholders[i]);
  }

  return text;
}

/**
 * Format expandable quote for Telegram.
 * Telegram Bot API 7.3+ supports expandable blockquotes via HTML `<blockquote expandable>...</blockquote>`
 */
export function renderExpandableQuote(content: string, header?: string): string {
  if (!content.trim()) return '';
  const headerPart = header ? `<b>${escapeHtml(header)}</b>\n` : '';
  return `<blockquote expandable>${headerPart}${escapeHtml(content)}</blockquote>`;
}

/**
 * Split a payload text into optional `reasoningText` and `answerText`.
 * Handles `<think>...</think>`, `<thinking>...</thinking>`, and `Reasoning:\n...`
 */
export function splitReasoningText(text?: string): {
  reasoningText?: string;
  answerText?: string;
} {
  if (typeof text !== 'string' || !text.trim()) return {};

  const trimmed = text.trim();

  if (trimmed.startsWith('Reasoning:\n') && trimmed.length > 11) {
    return { reasoningText: trimmed.slice(11).trim() };
  }

  const taggedReasoning = extractThinkingContent(text);
  const strippedAnswer = stripReasoningTags(text);
  if (!taggedReasoning && strippedAnswer === text) {
    return { answerText: text };
  }
  return {
    reasoningText: taggedReasoning || undefined,
    answerText: strippedAnswer || undefined,
  };
}

function extractThinkingContent(text: string): string {
  if (!text) return '';
  const scanRe = /<\s*(\/?)\s*(?:think(?:ing)?|thought|antthinking)\s*>/gi;
  let result = '';
  let lastIndex = 0;
  let inThinking = false;
  for (const match of text.matchAll(scanRe)) {
    const idx = match.index ?? 0;
    if (inThinking) {
      result += text.slice(lastIndex, idx);
    }
    inThinking = match[1] !== '/';
    lastIndex = idx + match[0].length;
  }
  if (inThinking) {
    result += text.slice(lastIndex);
  }
  return result.trim();
}

export function stripReasoningTags(text: string): string {
  let result = text.replace(
    /<\s*(?:think(?:ing)?|thought|antthinking)\s*>[\s\S]*?<\s*\/\s*(?:think(?:ing)?|thought|antthinking)\s*>/gi,
    '',
  );
  result = result.replace(/<\s*(?:think(?:ing)?|thought|antthinking)\s*>[\s\S]*$/gi, '');
  result = result.replace(/<\s*\/\s*(?:think(?:ing)?|thought|antthinking)\s*>/gi, '');
  return result.trim();
}
