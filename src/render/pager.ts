/**
 * Telegram single text message character limit (4096 UTF-16 code units).
 */
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

/**
 * Split text safely into chunks that fit within Telegram's 4096 limit,
 * respecting paragraphs, newlines, sentences, and block boundaries.
 */
export function splitMessageSmart(text: string, maxLength: number = TELEGRAM_MAX_MESSAGE_LENGTH): string[] {
  if (!text) return [''];
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = -1;

    // 1. Try splitting at markdown code fence boundary (```\n or \n```)
    const codeFenceBoundary = remaining.lastIndexOf('\n```', maxLength);
    if (codeFenceBoundary > maxLength * 0.6) {
      splitIndex = codeFenceBoundary + 4;
    }

    // 2. Try splitting at double newline (paragraph boundary)
    if (splitIndex === -1) {
      const paragraphBoundary = remaining.lastIndexOf('\n\n', maxLength);
      if (paragraphBoundary > maxLength * 0.5) {
        splitIndex = paragraphBoundary + 2;
      }
    }

    // 3. Try splitting at single newline
    if (splitIndex === -1) {
      const lineBoundary = remaining.lastIndexOf('\n', maxLength);
      if (lineBoundary > maxLength * 0.3) {
        splitIndex = lineBoundary + 1;
      }
    }

    // 4. Try splitting at sentence punctuation (. ! ? 。 ！？) followed by space/newline
    if (splitIndex === -1) {
      const match = remaining.slice(0, maxLength).match(/.*([。！？!?\.]\s*)/);
      if (match && match[0].length > maxLength * 0.3) {
        splitIndex = match[0].length;
      }
    }

    // 5. Fallback: hard cut at maxLength
    if (splitIndex <= 0 || splitIndex > maxLength) {
      splitIndex = maxLength;
    }

    const chunk = remaining.slice(0, splitIndex).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}
