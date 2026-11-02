import type { SessionMetrics } from './metrics';
import type { TelegramAccountConfig } from './config-schema';
import type { FooterConfig } from '../render/config/footer-config';
import type { ResolvedPanelSettings } from '../render/config/panel-config';

/** 通道账号。 */
export interface TelegramAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  name?: string;
  config?: TelegramAccountConfig;
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

export interface TelegramRenderOptions {
  expandableQuote?: boolean;
  format?: 'HTML' | 'MarkdownV2';
}

export interface InlineButtonAction {
  text: string;
  callbackData?: string;
  url?: string;
}

export interface TerminalCardRenderParams {
  /** 终版耗时（毫秒）。 */
  elapsedMs: number;
  /** 本轮指标（footer / 面板共用）。 */
  metrics?: SessionMetrics;
  /** 配置驱动的 footer（默认全关）。 */
  footer: FooterConfig;
  /** 面板配置。 */
  panel?: ResolvedPanelSettings;
  /** 模型别名表（peakValley + modelAliases 合并）。 */
  aliasTable: Record<string, unknown>;
}
