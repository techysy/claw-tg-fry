import type { MetricFooterData } from '../core/types';
import { escapeHtml } from './escape';

export function formatMetricFooter(data: MetricFooterData): string {
  const parts: string[] = ['🍤'];

  if (data.elapsedMs !== undefined) {
    const sec = (data.elapsedMs / 1000).toFixed(1);
    parts.push(`⏱ ${sec}s`);
  }

  if (data.tokens !== undefined && data.tokens > 0) {
    parts.push(`⚡️ ${data.tokens.toLocaleString()} tok`);
  }

  if (data.tokensPerSec !== undefined && data.tokensPerSec > 0) {
    parts.push(`${Math.round(data.tokensPerSec)} t/s`);
  }

  if (data.contextUsage) {
    parts.push(`🌊 ${data.contextUsage}`);
  }

  if (data.modelName) {
    parts.push(data.modelName);
  }

  return parts.join(' · ');
}

export function appendMetricFooter(body: string, data: MetricFooterData, format: 'HTML' | 'MarkdownV2' = 'HTML'): string {
  const footerText = formatMetricFooter(data);
  if (!footerText) return body;

  if (format === 'HTML') {
    return `${body}\n\n<code>${escapeHtml(footerText)}</code>`;
  }
  return `${body}\n\n\`${footerText}\``;
}
