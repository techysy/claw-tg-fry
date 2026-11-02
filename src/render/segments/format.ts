/**
 * 数值 / 时长格式化（移植自 hermes-fry-cards，语义一致）。
 */

/** 耗时：< 60s 用 `12.3s`，否则 `1m 05s`。 */
export function formatElapsed(ms: number): string {
  const seconds = ms / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

/** 大数缩写：1234 → `1.2k`，2_300_000 → `2.3m`，≥100 的档位取整。 */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) {
    const m = value / 1e6;
    return m >= 100 ? `${Math.round(m)}m` : `${m.toFixed(1)}m`;
  }
  if (abs >= 1e3) {
    const k = value / 1e3;
    return k >= 100 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }
  return String(value);
}

/** ⚡ 速度：≥100 取整（135 tok/s），否则保留 1 位小数（38.5 tok/s）。 */
export function formatTokensPerSecond(v: number): string {
  return v >= 100 ? String(Math.round(v)) : v.toFixed(1);
}

/** fry 风格上下文进度条（渐变密度 █▓▒░）。 */
export function contextProgressBar(used: number, total: number, width = 8): string {
  if (total <= 0) return '';
  const n = (Math.min((used / total) * 100, 100) / 100) * width;
  const cells: string[] = [];
  for (let i = 0; i < width; i++) {
    const pos = i + 0.5;
    if (pos <= n) {
      if (n - pos >= 0.5) cells.push('█');
      else if (n - pos >= 0.25) cells.push('▓');
      else cells.push('▒');
    } else if (pos - 1 <= n) {
      const frac = n - (pos - 1);
      if (frac > 0.66) cells.push('▓');
      else if (frac > 0.33) cells.push('▒');
      else cells.push('░');
    } else {
      cells.push('░');
    }
  }
  return cells.join('');
}

export function contextTotalLabel(total: number): string {
  if (total >= 1e6) return `${(total / 1e6).toFixed(1)}m`;
  if (total >= 1e3) return `${(total / 1e3).toFixed(1)}k`;
  return String(total);
}

export function contextUsedLabel(used: number, total: number): string {
  if (total >= 1e6 && used < 1e6) return `${(used / 1e3).toFixed(1)}k`;
  if (total >= 1e6) return `${(used / 1e6).toFixed(1)}m`;
  if (total >= 1e3) return `${(used / 1e3).toFixed(1)}k`;
  return String(used);
}

export type ContextDisplayMode = 'text' | 'bar' | 'text_bar';

export function formatContextSegment(
  used: number,
  total: number,
  mode: ContextDisplayMode = 'text_bar',
): string | null {
  if (total <= 0 || used == null) return null;
  const pct = Math.min(100, Math.round((used / total) * 100));
  if (mode === 'bar') return `[${contextProgressBar(used, total)}] ${pct}%`;
  const text = `${contextUsedLabel(used, total)}/${contextTotalLabel(total)}`;
  if (mode === 'text') return `${text} (${pct}%)`;
  return `${text} [${contextProgressBar(used, total)}] ${pct}%`;
}

/** 💾 缓存命中率 = cacheRead / (input + cacheRead + cacheWrite)。 */
export function computeCacheHitRate(metrics: {
  cacheRead?: number;
  cacheWrite?: number;
  inputTokens?: number;
}): number | undefined {
  if (!metrics) return undefined;
  const read = typeof metrics.cacheRead === 'number' && metrics.cacheRead > 0 ? metrics.cacheRead : undefined;
  const inputVal = typeof metrics.inputTokens === 'number' && metrics.inputTokens >= 0 ? metrics.inputTokens : undefined;
  if (read == null || inputVal == null) return undefined;
  const write = typeof metrics.cacheWrite === 'number' && metrics.cacheWrite >= 0 ? metrics.cacheWrite : 0;
  const total = inputVal + read + write;
  if (total <= 0) return undefined;
  return Math.round((read / total) * 100);
}

/** 文本截断（省略号占位）。 */
export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
