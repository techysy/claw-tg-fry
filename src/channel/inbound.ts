import { Bot } from 'grammy';
import type { TelegramAccountConfig } from '../core/config-schema';

export interface TelegramInboundHandlerOptions {
  config: TelegramAccountConfig;
  onUserMessage?: (event: {
    chatId: number;
    userId: number;
    messageId: number;
    text: string;
    threadId?: number;
    isGroup: boolean;
  }) => Promise<void>;
  onCallbackQuery?: (event: {
    chatId: number;
    userId: number;
    messageId: number;
    data: string;
  }) => Promise<void>;
}

export class TelegramInboundAdapter {
  private bot: Bot;
  private isRunning = false;

  constructor(private readonly options: TelegramInboundHandlerOptions) {
    this.bot = new Bot(options.config.botToken, {
      client: {
        apiRoot: options.config.apiRoot,
      },
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    // 监听文本消息
    this.bot.on('message:text', async (ctx) => {
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

      // 群组中若开启了 requireMention，则检查是否 @ 了 Bot
      if (isGroup && this.options.config.requireMention) {
        const botUsername = ctx.me.username;
        const text = ctx.message.text || '';
        const entities = ctx.message.entities || [];
        const isMentioned = entities.some(
          (e) => e.type === 'mention' && text.substring(e.offset, e.offset + e.length) === `@${botUsername}`,
        );
        if (!isMentioned) {
          return;
        }
      }

      if (this.options.onUserMessage) {
        await this.options.onUserMessage({
          chatId: ctx.chat.id,
          userId: ctx.from.id,
          messageId: ctx.message.message_id,
          text: ctx.message.text,
          threadId: ctx.message.message_thread_id,
          isGroup,
        });
      }
    });

    // 监听 Inline Keyboard 回调
    this.bot.on('callback_query:data', async (ctx) => {
      const { handleTelegramCallbackQuery } = await import('../messaging/callback-handler');
      await handleTelegramCallbackQuery(ctx);

      if (this.options.onCallbackQuery && ctx.chat && ctx.callbackQuery.message) {
        await this.options.onCallbackQuery({
          chatId: ctx.chat.id,
          userId: ctx.from.id,
          messageId: ctx.callbackQuery.message.message_id,
          data: ctx.callbackQuery.data,
        });
      }
    });
  }

  public async start(abortSignal?: AbortSignal): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      this.bot.catch((err) => {
        console.warn('[claw-tg-fry] grammy bot error:', err);
      });
      await this.bot.init();

      // 启动长轮询并挂住 Promise 直到 abortSignal 触发或调用 stop()
      await new Promise<void>((resolve) => {
        if (abortSignal?.aborted) {
          resolve();
          return;
        }

        const onAbort = () => {
          void this.stop().then(() => resolve());
        };
        abortSignal?.addEventListener('abort', onAbort, { once: true });

        this.bot.start({
          drop_pending_updates: true,
          onStart: (botInfo) => {
            console.log(`[claw-tg-fry] Bot @${botInfo.username} started polling`);
          },
        }).catch((err) => {
          console.warn('[claw-tg-fry] bot.start error:', err);
          resolve();
        });
      });
    } catch (err) {
      this.isRunning = false;
      console.warn('[claw-tg-fry] Failed to start bot polling:', err);
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    await this.bot.stop();
  }
}
