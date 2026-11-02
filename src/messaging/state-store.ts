export interface MessageStateCache {
  chatId: number | string;
  messageId: number;
  mainText: string;
  reasoningText?: string;
  reasoningExpanded: boolean;
  elapsedMs?: number;
  tokens?: number;
  tokensPerSec?: number;
  contextUsage?: string;
  modelName?: string;
}

class MessageStateStore {
  private cache = new Map<string, MessageStateCache>();

  private getKey(chatId: number | string, messageId: number): string {
    return `${chatId}:${messageId}`;
  }

  public set(state: MessageStateCache): void {
    // 保持最多 500 条消息状态，防内存泄漏
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
