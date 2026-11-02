import { DEFAULT_PANEL_FIELDS, PANEL_FIELD_POOL, type PanelField } from '../config/panel-config';
import { compactNumber, computeCacheHitRate, formatContextSegment, formatElapsed, formatTokensPerSecond, type ContextDisplayMode } from './format';
import type { FooterRuntimeMetrics } from './footer';

export interface PanelSegmentsParams {
  fields?: PanelField[];
  metrics?: FooterRuntimeMetrics;
  modelName?: string;
  hasReasoning?: boolean;
  toolCount?: number;
  elapsedMs?: number;
  contextDisplayMode?: ContextDisplayMode;
}

/**
 * 计算面板标题段（`🍤` 前缀 + 按 `fields` 顺序拼接的段值）。
 *
 * - `fields` 是**有序数组**，数组顺序即显示顺序；未列出的段不显示。
 * - 未配置 `fields` 时用 {@link DEFAULT_PANEL_FIELDS}。
 * - 数据缺失的段自动省略（不出空占位）。
 */
export function formatPanelSegments(params: PanelSegmentsParams): string[] {
  const { fields, metrics, modelName, hasReasoning, toolCount, elapsedMs, contextDisplayMode } = params;

  const ctxWindow =
    typeof metrics?.contextTokens === 'number' && metrics.contextTokens > 0 ? metrics.contextTokens : undefined;
  const ctxUsedIn =
    typeof metrics?.inputTokens === 'number' && metrics.inputTokens > 0 ? metrics.inputTokens : undefined;

  const outShown =
    typeof metrics?.outputTokensTotal === 'number'
      ? metrics.outputTokensTotal
      : typeof metrics?.outputTokens === 'number'
        ? metrics.outputTokens
        : undefined;

  const tps = metrics?.tokensPerSecond;
  const cacheHitRate = computeCacheHitRate(metrics ?? {});

  const values: Record<PanelField, string | undefined> = {
    model: modelName,
    reasoning: `💭${hasReasoning ? 1 : 0}`,
    tools: `🔧${toolCount ?? 0}`,
    context:
      ctxWindow != null && ctxUsedIn != null
        ? (formatContextSegment(ctxUsedIn, ctxWindow, contextDisplayMode ?? 'text_bar') ?? undefined)
        : undefined,
    cache: cacheHitRate != null ? `💾 ${cacheHitRate}%` : undefined,
    output: outShown != null && outShown > 0 ? `🎫 ${compactNumber(outShown)}` : undefined,
    speed:
      typeof tps === 'number' && Number.isFinite(tps) && tps > 0
        ? `⚡ ${formatTokensPerSecond(tps)} tok/s`
        : undefined,
    elapsed: elapsedMs != null && elapsedMs > 0 ? `⏱️ ${formatElapsed(elapsedMs)}` : undefined,
  };

  const activeFields = fields ?? DEFAULT_PANEL_FIELDS;
  const parts: string[] = ['🍤'];
  for (const field of activeFields) {
    if (!PANEL_FIELD_POOL.includes(field)) continue;
    const value = values[field];
    if (value) parts.push(value);
  }
  return parts;
}
