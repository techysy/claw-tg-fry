import type { ContextDisplayMode } from '../segments/format';

/** 面板可显示字段池（顺序无关，成员即允许的段）。 */
export const PANEL_FIELD_POOL = [
  'model',
  'reasoning',
  'tools',
  'context',
  'cache',
  'output',
  'speed',
  'elapsed',
] as const;

export type PanelField = (typeof PANEL_FIELD_POOL)[number];

/** 缺省字段顺序：未配置 `panel.fields` 时使用（数据缺失的段仍自动省略）。 */
export const DEFAULT_PANEL_FIELDS: PanelField[] = [...PANEL_FIELD_POOL];

const PANEL_FIELD_SET = new Set<string>(PANEL_FIELD_POOL);

export interface ModelAliasRule {
  name?: string;
  days?: number[] | string;
  start?: string;
  end?: string;
}

export type ModelAliasEntry = string | { name?: string; timeAliases?: ModelAliasRule[] };

export interface RawPanelSettings {
  unifiedPanelMinDuration?: number;
  contextDisplayMode?: string;
  expanded?: boolean;
  truncateModelName?: boolean;
  modelAliasesEnabled?: boolean;
  modelAliases?: Record<string, unknown>;
  peakValley?: unknown;
  fields?: unknown;
}

export interface ResolvedPanelSettings {
  unifiedPanelMinDurationMs?: number;
  contextDisplayMode?: ContextDisplayMode;
  expanded?: boolean;
  truncateModelName?: boolean;
  modelAliasesEnabled?: boolean;
  modelAliases?: Record<string, unknown>;
  peakValley?: Array<{
    match?: string;
    peakName?: string;
    valleyName?: string;
    schedule?: string;
  }>;
  fields?: PanelField[];
}

/** 缺省面板门槛：耗时 ≥ 5s 或有思考/工具调用时才出面板。 */
export const DEFAULT_PANEL_MIN_DURATION_MS = 5000;

/** CN 时区偏移（UTC+8），用于峰谷时段别名判定。 */
export const CN_TZ_OFFSET_MS = 480 * 60 * 1000;

function normalizeFields(raw: unknown): PanelField[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const fields: PanelField[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !PANEL_FIELD_SET.has(item)) continue;
    const field = item as PanelField;
    if (!fields.includes(field)) fields.push(field);
  }
  return fields;
}

/** 归一化 raw panel 配置（未识别字段静默丢弃）。 */
export function readPanelSettings(raw: unknown): ResolvedPanelSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as RawPanelSettings;
  const out: ResolvedPanelSettings = {};

  if (typeof p.unifiedPanelMinDuration === 'number') {
    out.unifiedPanelMinDurationMs = p.unifiedPanelMinDuration * 1000;
  }
  if (p.contextDisplayMode === 'text' || p.contextDisplayMode === 'bar' || p.contextDisplayMode === 'text_bar') {
    out.contextDisplayMode = p.contextDisplayMode;
  }
  if (typeof p.expanded === 'boolean') out.expanded = p.expanded;
  if (typeof p.truncateModelName === 'boolean') out.truncateModelName = p.truncateModelName;
  if (typeof p.modelAliasesEnabled === 'boolean') out.modelAliasesEnabled = p.modelAliasesEnabled;
  if (p.modelAliases && typeof p.modelAliases === 'object') out.modelAliases = p.modelAliases;
  if (Array.isArray(p.peakValley)) {
    out.peakValley = p.peakValley as Array<Record<string, unknown> & { match?: string }>;
  } else if (p.peakValley && typeof p.peakValley === 'object') {
    out.peakValley = Object.entries(p.peakValley as Record<string, unknown>).map(([match, v]) => ({
      ...(v as Record<string, unknown>),
      match,
    }));
  }
  const fields = normalizeFields(p.fields);
  if (fields) out.fields = fields;

  return Object.keys(out).length > 0 ? out : undefined;
}

/** 读插件级 panel（plugins.entries.<id>.config.panel）。 */
export function readPluginPanel(raw: unknown, pluginId: string): unknown {
  if (!raw || typeof raw !== 'object') return undefined;
  const entry = (raw as { plugins?: { entries?: Record<string, unknown> } }).plugins?.entries?.[pluginId];
  if (!entry || typeof entry !== 'object') return undefined;
  return (entry as { config?: { panel?: unknown } }).config?.panel;
}

/** 读通道级 panel（channels.telegram.panel）。 */
export function readChannelPanel(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return undefined;
  return (raw as { channels?: { telegram?: { panel?: unknown } } }).channels?.telegram?.panel;
}

/** 读通道级 panel（channels.telegram.accounts.*.panel，多账号形态）。 */
export function readChannelAccountPanel(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return undefined;
  const accounts = (raw as { channels?: { telegram?: { accounts?: Record<string, unknown> } } }).channels?.telegram
    ?.accounts;
  if (!accounts || typeof accounts !== 'object') return undefined;
  const first = Object.values(accounts)[0] as { panel?: unknown } | undefined;
  return first?.panel;
}

/**
 * 解析生效的 panel 配置：插件级优先，其次通道级。
 */
export function resolvePanelSettings(rawCfg: unknown, pluginId: string): ResolvedPanelSettings | undefined {
  return (
    readPanelSettings(readPluginPanel(rawCfg, pluginId)) ??
    readPanelSettings(readChannelPanel(rawCfg)) ??
    readPanelSettings(readChannelAccountPanel(rawCfg))
  );
}

/** HH:MM 是否在 [start,end) 内（支持跨午夜）。 */
export function inTimeRange(hhmm: string, start: string, end: string): boolean {
  if (!start || !end) return true;
  if (start === end) return true;
  if (start < end) return hhmm >= start && hhmm < end;
  return hhmm >= start || hhmm < end;
}

/** 星期是否命中规格：数组 [1,2,3]（0=周日，可多选）或字符串 "1-5"、"0,6"、"1-5,0"；省略 = 每天。 */
export function dayMatches(day: number, spec?: number[] | string | null): boolean {
  if (spec == null) return true;
  if (Array.isArray(spec)) return spec.includes(day);
  for (const part of String(spec).split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = trimmed.split('-');
    if (range.length === 2) {
      const start = Number(range[0]);
      const end = Number(range[1]);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        if (start <= end ? day >= start && day <= end : day >= start || day <= end) return true;
      }
    } else if (Number.isFinite(Number(trimmed)) && Number(trimmed) === day) {
      return true;
    }
  }
  return false;
}

/** 峰谷别名：按 CN 时区当前时间匹配时段规则，未命中回落静态 name。 */
export function resolveModelAlias(entry?: ModelAliasEntry | null, now: Date = new Date()): string | undefined {
  if (entry == null) return undefined;
  if (typeof entry === 'string') return entry;
  if (typeof entry !== 'object') return undefined;
  const shifted = new Date(now.getTime() + CN_TZ_OFFSET_MS);
  const hhmm = `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
  for (const rule of entry.timeAliases ?? []) {
    if (!rule?.name) continue;
    if (!dayMatches(shifted.getUTCDay(), rule.days)) continue;
    if (!inTimeRange(hhmm, rule.start ?? '00:00', rule.end ?? '23:59')) continue;
    return rule.name;
  }
  return entry.name;
}

/** 模型名截断：or/lc/LongCat-2.0 → ⇲LongCat-2.0（取最后一段）。无斜杠时原样返回。 */
export function truncateModelId(modelId: string): string {
  const last = modelId.split('/').pop();
  if (!last || last === modelId) return modelId;
  return `⇲${last}`;
}

/**
 * 面板模型名解析（hermes-fry-cards 同款语义）：
 * 1. 别名 key 对完整模型名做大小写不敏感子串匹配，插入序第一条命中即返回（支持时段人设对象）；
 * 2. 未命中且 truncateModelName !== false 时回落 ⇲ 截断。
 */
export function resolvePanelModelName(
  table: Record<string, unknown>,
  modelId: string,
  opts: { truncateModelName?: boolean; modelAliasesEnabled?: boolean } = {},
): string {
  if (opts.modelAliasesEnabled !== false) {
    const lowered = modelId.toLowerCase();
    for (const [key, entry] of Object.entries(table)) {
      if (key && lowered.includes(key.toLowerCase())) return resolveModelAlias(entry as ModelAliasEntry) ?? modelId;
    }
  }
  if (opts.truncateModelName === false) return modelId;
  return truncateModelId(modelId);
}
