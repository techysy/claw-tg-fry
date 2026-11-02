import type { ResolvedPanelSettings } from '../config/panel-config';
/** 峰段窗口预置（北京时间）。 */
const PEAK_WINDOWS: Record<string, Array<{ days?: number[]; start: string; end: string }>> = {
  deepseek: [
    { days: [1, 2, 3, 4, 5], start: '09:00', end: '12:00' },
    { days: [1, 2, 3, 4, 5], start: '14:00', end: '18:00' },
  ],
  'workday-918': [{ days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' }],
  'everyday-day': [{ start: '08:00', end: '22:00' }],
};

/**
 * 把 peakValley 配置展开为等价的别名条目
 * （`timeAliases` 命中时用 peakName，兜底用 valleyName）。
 */
export function expandPeakValley(pv: {
  match?: unknown;
  peakName?: unknown;
  valleyName?: unknown;
  schedule?: unknown;
}): { name?: string; timeAliases?: Array<{ days?: number[]; start: string; end: string; name: string }> } | undefined {
  if (!pv || typeof pv !== 'object') return undefined;
  if (typeof pv.match !== 'string' || !pv.match) return undefined;
  if (typeof pv.peakName !== 'string' || !pv.peakName) return undefined;
  if (pv.schedule === 'custom') return undefined;
  if (pv.schedule === 'always-peak') return { name: pv.peakName };

  const windows: Array<{ days?: number[]; start: string; end: string }> = PEAK_WINDOWS[String(pv.schedule)] ?? [];

  return {
    name: typeof pv.valleyName === 'string' && pv.valleyName ? pv.valleyName : pv.peakName,
    timeAliases: windows.map((w) => ({ ...w, name: String(pv.peakName ?? '') })),
  };
}

/**
 * 合并 peakValley 时段别名与 modelAliases。
 * peakValley 先入表，modelAliases 后写入（同名 key 以 modelAliases 为准）。
 */
export function buildAliasTable(panel?: ResolvedPanelSettings): Record<string, unknown> {
  const table: Record<string, unknown> = {};
  for (const pv of panel?.peakValley ?? []) {
    const entry = expandPeakValley(pv);
    if (entry && typeof pv.match === 'string') table[pv.match] = entry;
  }
  Object.assign(table, panel?.modelAliases ?? {});
  return table;
}

/** 从 state cache 的 panel 配置重建别名表（回调路径用）。 */
export function aliasTableFromState(panel?: ResolvedPanelSettings): Record<string, unknown> {
  return buildAliasTable(panel);
}

