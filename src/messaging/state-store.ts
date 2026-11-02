import type { SessionMetrics } from '../core/metrics';
import type { FooterConfig } from '../render/config/footer-config';
import type { ResolvedPanelSettings } from '../render/config/panel-config';

export interface MessageStateCache {
  chatId: number | string;
  messageId: number;
  mainText: string;
  reasoningText?: string;
  reasoningExpanded: boolean;
  elapsedMs?: number;
  /** 本轮完整指标（footer / 运行指标弹窗共用）。 */
  metrics?: SessionMetrics;
  footer?: FooterConfig;
  panel?: ResolvedPanelSettings;
  /** 兼容旧字段（弹窗展示用）。 */
  tokens?: number;
  tokensPerSec?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  contextUsage?: string;
  modelName?: string;
}

class MessageStateStore {
  private cache = new Map<string, MessageStateCache>();

  private getKey(chatId: number | string, messageId: number): string {
    return `${chatId}:${messageId}`;
  }

  public set(state: MessageStateCache): void {
    if (this.cache.size > 500) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(this.getKey(state.chatId, state.messageId), state);
  }

  public get(chatId: number | string, messageId: number): MessageStateCache | undefined {
    return this.cache.get(this.getKey(chatId, messageId));
  }
}

export const messageStateStore = new MessageStateStore();
