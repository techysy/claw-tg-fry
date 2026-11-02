import type { TelegramClient } from '../core/client';
import type { TypewriterScheduler } from './typewriter';
import { renderExpandableQuote, markdownToTelegramHtml } from '../render/escape';
import { buildTerminalCardHtml } from '../render/segments/terminal-card';
import { buildStandardActionKeyboard } from '../render/keyboard';
import { messageStateStore } from './state-store';
import { fetchSessionMetricsFromSqlite, type SessionMetrics } from '../core/metrics';
import { resolveFooterConfig, type FooterConfig } from '../render/config/footer-config';
import type { ResolvedPanelSettings } from '../render/config/panel-config';
import { buildAliasTable } from '../render/segments/panel-alias';

export interface TelegramStreamingCardParams {
  client: TelegramClient;
  scheduler: TypewriterScheduler;
  chatId: number | string;
  sessionKey: string;
  replyToMessageId?: number;
  threadId?: number;
  instantPlaceholder?: boolean;
  /** 插件级 footer 配置（解析后）。缺省 = 全部关闭。 */
  footer?: FooterConfig;
  /** 面板配置（解析后）。 */
  panel?: ResolvedPanelSettings;
  /** OpenClaw 配置，用于解析模型上下文窗口。 */
  cfg?: unknown;
}

export class TelegramStreamingCardController {
  private placeholderMessageId: number | null = null;
  private currentText = '';
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
      displayContent += renderExpandableQuote(this.reasoningText, '💭 思考过程 (生成中)') + '\n\n';
    }
    displayContent += markdownToTelegramHtml(this.currentText) || '🍤 正在生成回答...';

    this.params.scheduler.enqueue({
      chatId: this.params.chatId,
      messageId: this.placeholderMessageId,
      text: displayContent,
      parseMode: 'HTML',
    });
  }

  public async complete(finalPayload?: { text?: string }): Promise<void> {
    const elapsedMs = Date.now() - this.startTime;
    const finalText = finalPayload?.text || this.currentText || '已完成。';

    const metrics = fetchSessionMetricsFromSqlite('main', this.params.sessionKey, this.params.cfg);
    const footer = this.params.footer ?? resolveFooterConfig(null);

    const displayContent = buildTerminalCardHtml(finalText, this.reasoningText, {
      elapsedMs,
      metrics,
      footer,
      panel: this.params.panel,
      aliasTable: buildAliasTable(this.params.panel),
    });

    const keyboard = buildStandardActionKeyboard({
      hasReasoning: Boolean(this.reasoningText),
      reasoningExpanded: false,
    });

    let targetMsgId = this.placeholderMessageId;

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
      const sent = await this.params.client.bot.api.sendMessage(this.params.chatId, displayContent, {
        reply_parameters: this.params.replyToMessageId
          ? { message_id: this.params.replyToMessageId }
          : undefined,
        message_thread_id: this.params.threadId,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      targetMsgId = sent.message_id;
    }

    if (targetMsgId) {
      messageStateStore.set({
        chatId: this.params.chatId,
        messageId: targetMsgId,
        mainText: finalText,
        reasoningText: this.reasoningText,
        reasoningExpanded: false,
        elapsedMs,
        metrics,
        footer,
        panel: this.params.panel,
      });
    }
  }
}
