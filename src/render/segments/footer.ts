import type { FooterConfig } from '../config/footer-config';
import { compactNumber, computeCacheHitRate, formatContextSegment, formatElapsed } from './format';
import { escapeHtml } from '../escape';

export interface FooterRuntimeMetrics {
  inputTokens?: number;
  outputTokens?: number;
  outputTokensTotal?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  contextTokens?: number;
  tokensPerSecond?: number;
  model?: string;
  provider?: string;
}

export interface FooterSegmentsParams {
  footer: FooterConfig;
  metrics?: FooterRuntimeMetrics;
  elapsedMs?: number;
  isError?: boolean;
  isAborted?: boolean;
}

export interface FooterSegments {
  /** 主行（状态 / 耗时 / 模型 / 供应商） */
  primary: string[];
  /** 详情行（tokens / cache / context） */
  detail: string[];
}

/**
 * 计算 footer 的主行与详情行（与 hermes-fry-cards 同款语义）。
 * 关闭的项不产出任何文本；数据缺失的段静默省略。
 */
export function formatFooterRuntimeSegments(params: FooterSegmentsParams): FooterSegments {
  const { footer, metrics, elapsedMs, isError, isAborted } = params;
  const primary: string[] = [];
  const detail: string[] = [];

  if (footer.status) {
    if (isError) primary.push('出错');
    else if (isAborted) primary.push('已停止');
    else primary.push('已完成');
  }

  if (footer.elapsed && elapsedMs != null) {
    primary.push(`耗时 ${formatElapsed(elapsedMs)}`);
  }

  if (footer.model && metrics?.model) {
    const model = metrics.model.trim();
    if (model) primary.push(model);
  }

  if (footer.provider && metrics?.provider) {
    const provider = metrics.provider.trim();
    if (provider) primary.push(provider);
  }

  if (footer.tokens && metrics) {
    const inTokens = typeof metrics.inputTokens === 'number' ? Math.max(0, metrics.inputTokens) : undefined;
    const outTokens = typeof metrics.outputTokens === 'number' ? Math.max(0, metrics.outputTokens) : undefined;
    if (inTokens != null && outTokens != null) {
      detail.push(`↑ ${compactNumber(inTokens)} ↓ ${compactNumber(outTokens)}`);
    }
  }

  if (footer.cache && metrics) {
    const hitRate = computeCacheHitRate(metrics);
    const read = typeof metrics.cacheRead === 'number' ? Math.max(0, metrics.cacheRead) : undefined;
    const write = typeof metrics.cacheWrite === 'number' ? Math.max(0, metrics.cacheWrite) : undefined;
    if (hitRate != null && read != null && write != null) {
      detail.push(`缓存 ${compactNumber(read)}/${compactNumber(write)} (${hitRate}%)`);
    }
  }

  if (footer.context && metrics) {
    const used =
      typeof metrics.inputTokens === 'number' && metrics.inputTokens > 0
        ? metrics.inputTokens
        : typeof metrics.totalTokens === 'number'
          ? metrics.totalTokens
          : undefined;
    const ctx = typeof metrics.contextTokens === 'number' ? Math.max(0, metrics.contextTokens) : undefined;
    if (used != null && ctx != null) {
      const segment = formatContextSegment(used, ctx, 'text');
      if (segment) detail.push(`上下文 ${segment}`);
    }
  }

  return { primary, detail };
}

/** 兼容旧调用：按固定顺序拼接所有存在字段（🍤 前缀）。 */
export interface MetricFooterData {
  elapsedMs?: number;
  tokens?: number;
  tokensPerSec?: number;
  contextUsage?: string;
  modelName?: string;
  peakValleySchedule?: string;
}

/**
 * 在正文后追加配置驱动的 footer（主行 + 详情行）。
 * 返回值带 `\n\n` 前缀；footer 为空时原样返回正文。
 */
export function appendFooterSections(
  body: string,
  footer: FooterConfig,
  metrics: FooterRuntimeMetrics | undefined,
  opts: { elapsedMs?: number; isError?: boolean; isAborted?: boolean } = {},
  format: 'HTML' | 'MarkdownV2' = 'HTML',
): string {
  const segments = formatFooterRuntimeSegments({
    footer,
    metrics,
    elapsedMs: opts.elapsedMs,
    isError: opts.isError,
    isAborted: opts.isAborted,
  });
  const lines: string[] = [];
  if (segments.primary.length > 0) lines.push(segments.primary.join(' · '));
  if (segments.detail.length > 0) lines.push(segments.detail.join(' · '));
  const text = lines.join('\n');
  if (!text) return body;

  if (format === 'HTML') return `${body}\n\n<code>${escapeHtml(text)}</code>`;
  return `${body}\n\n\`${text}\``;
}

export function formatMetricFooter(data: MetricFooterData): string {
  const parts: string[] = ['🍤'];

  if (data.elapsedMs !== undefined) parts.push(`⏱ ${(data.elapsedMs / 1000).toFixed(1)}s`);
  if (data.tokens !== undefined && data.tokens > 0) parts.push(`⚡️ ${data.tokens.toLocaleString()} tok`);
  if (data.tokensPerSec !== undefined && data.tokensPerSec > 0) parts.push(`${Math.round(data.tokensPerSec)} t/s`);
  if (data.contextUsage) parts.push(`🌊 ${data.contextUsage}`);
  if (data.modelName) parts.push(data.modelName);

  return parts.join(' · ');
}

/** 保留旧签名：直接追加已格式化的 footer 文本。 */
export function appendMetricFooter(
  body: string,
  data: MetricFooterData,
  format: 'HTML' | 'MarkdownV2' = 'HTML',
): string {
  const footerText = formatMetricFooter(data);
  if (!footerText) return body;
  if (format === 'HTML') return `${body}\n\n<code>${escapeHtml(footerText)}</code>`;
  return `${body}\n\n\`${footerText}\``;
}
