import { Bot, InlineKeyboard } from 'grammy';
import type { TelegramAccountConfig } from '../core/config-schema';

export interface TelegramClientOptions {
  botToken: string;
  apiRoot?: string;
}

export class TelegramClient {
  public readonly bot: Bot;

  constructor(options: TelegramClientOptions) {
    this.bot = new Bot(options.botToken, {
      client: {
        apiRoot: options.apiRoot,
      },
    });
  }

  public static fromConfig(config: TelegramAccountConfig): TelegramClient {
    return new TelegramClient({
      botToken: config.botToken,
      apiRoot: config.apiRoot,
    });
  }

  public async getMe() {
    return await this.bot.api.getMe();
  }

  public async sendPlaceholder(chatId: number | string, replyToMessageId?: number, threadId?: number) {
    return await this.bot.api.sendMessage(chatId, '🍤 正在思考...', {
      reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined,
      message_thread_id: threadId,
      parse_mode: 'HTML',
    });
  }

  public async editMessage(
    chatId: number | string,
    messageId: number,
    text: string,
    options?: {
      parseMode?: 'HTML' | 'MarkdownV2';
      replyMarkup?: InlineKeyboard;
    },
  ) {
    return await this.bot.api.editMessageText(chatId, messageId, text, {
      parse_mode: options?.parseMode ?? 'HTML',
      reply_markup: options?.replyMarkup,
    });
  }
}
