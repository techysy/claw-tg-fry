import type { TelegramClient } from '../core/client';
import type { InlineKeyboard } from 'grammy';

export interface TypewriterTask {
  chatId: number | string;
  messageId: number;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  replyMarkup?: InlineKeyboard;
  isFinal?: boolean;
}

/**
 * Throttled Typewriter Engine:
 * Batches and rate-limits `editMessageText` calls to Telegram to avoid 429 Too Many Requests.
 * Supports handling `retry_after` from Telegram error responses.
 */
export class TypewriterScheduler {
  private queue: Map<string, TypewriterTask> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private retryUntil = 0;

  constructor(
    private readonly client: TelegramClient,
    private readonly throttleIntervalMs: number = 900,
  ) {}

  private getKey(chatId: number | string, messageId: number): string {
    return `${chatId}:${messageId}`;
  }

  public enqueue(task: TypewriterTask): void {
    const key = this.getKey(task.chatId, task.messageId);
    this.queue.set(key, task);
    this.ensureTimer();
  }

  private ensureTimer(): void {
    if (this.timer || this.queue.size === 0) return;

    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.flush();
    }, this.throttleIntervalMs);
  }

  public async flush(): Promise<void> {
    if (this.isProcessing) return;
    if (Date.now() < this.retryUntil) {
      this.ensureTimer();
      return;
    }

    this.isProcessing = true;
    try {
      const entries = Array.from(this.queue.entries());
      for (const [key, task] of entries) {
        try {
          await this.client.editMessage(task.chatId, task.messageId, task.text, {
            parseMode: task.parseMode,
            replyMarkup: task.replyMarkup,
          });
          this.queue.delete(key);
        } catch (err: unknown) {
          const errorObj = err as { parameters?: { retry_after?: number }; message?: string };
          if (errorObj?.parameters?.retry_after) {
            const retryAfterSec = errorObj.parameters.retry_after;
            this.retryUntil = Date.now() + (retryAfterSec + 1) * 1000;
            break;
          } else if (errorObj?.message?.includes('message is not modified')) {
            // Content identical, safe to drop
            this.queue.delete(key);
          } else {
            // Log other errors and remove to prevent infinite loop
            this.queue.delete(key);
          }
        }
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.size > 0) {
        this.ensureTimer();
      }
    }
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.queue.clear();
  }
}
