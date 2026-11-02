import type { TelegramAccountConfig } from './config-schema';

export interface TelegramAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  name?: string;
  config?: TelegramAccountConfig;
}

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
