import type { OpenClawConfig, ReplyPayload } from 'openclaw/plugin-sdk/core';
import type { TelegramClient } from '../core/client';
import type { TypewriterScheduler } from './typewriter';
import { renderExpandableQuote } from '../render/escape';
import { appendMetricFooter } from '../render/footer';
import { buildStandardActionKeyboard } from '../render/keyboard';

export interface TelegramStreamingCardParams {
  client: TelegramClient;
  scheduler: TypewriterScheduler;
  chatId: number | string;
  replyToMessageId?: number;
  threadId?: number;
  instantPlaceholder?: boolean;
}

export class TelegramStreamingCardController {
  private placeholderMessageId: number | null = null;
  private currentText = '';
  private isThinking = false;
  private reasoningText = '';
  private startTime = Date.now();

  constructor(private readonly params: TelegramStreamingCardParams) {}

  public async start(): Promise<void> {
    if (this.params.instantPlaceholder !== false) {
      try {
        const msg = await this.params.client.sendPlaceholder(
          this.params.chatId,
          this.params.replyToMessageId,
          this.params.threadId,
        );
        this.placeholderMessageId = msg.message_id;
      } catch (err) {
        console.warn('[claw-tg-fry] Failed to send instant placeholder:', err);
      }
    }
  }

  public updateDelta(delta: string, isReasoning = false): void {
    if (isReasoning) {
      this.reasoningText += delta;
    } else {
      this.currentText += delta;
    }

    if (!this.placeholderMessageId) return;

    let displayContent = '';
    if (this.reasoningText) {
      displayContent += renderExpandableQuote(`💭 思考过程:\n${this.reasoningText}`, 'HTML') + '\n\n';
    }
    displayContent += this.currentText || '🍤 正在生成回答...';

    this.params.scheduler.enqueue({
      chatId: this.params.chatId,
      messageId: this.placeholderMessageId,
      text: displayContent,
      parseMode: 'HTML',
    });
  }

  public async complete(finalPayload?: ReplyPayload): Promise<void> {
    const elapsedMs = Date.now() - this.startTime;
    const finalText = finalPayload?.text || this.currentText || '已完成。';

    let displayContent = '';
    if (this.reasoningText) {
      displayContent += renderExpandableQuote(`💭 思考过程:\n${this.reasoningText}`, 'HTML') + '\n\n';
    }
    displayContent += finalText;

    displayContent = appendMetricFooter(
      displayContent,
      {
        elapsedMs,
      },
      'HTML',
    );

    const keyboard = buildStandardActionKeyboard();

    if (this.placeholderMessageId) {
      this.params.scheduler.enqueue({
        chatId: this.params.chatId,
        messageId: this.placeholderMessageId,
        text: displayContent,
        parseMode: 'HTML',
        replyMarkup: keyboard,
        isFinal: true,
      });
      await this.params.scheduler.flush();
    } else {
      await this.params.client.bot.api.sendMessage(this.params.chatId, displayContent, {
        reply_parameters: this.params.replyToMessageId
          ? { message_id: this.params.replyToMessageId }
          : undefined,
        message_thread_id: this.params.threadId,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }
  }
}
