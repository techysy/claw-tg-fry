import type { ChannelOutboundAdapter } from 'openclaw/plugin-sdk/channel-send-result';
import { TelegramClient } from '../../core/client';
import type { TelegramAccountConfig } from '../../core/config-schema';
import { formatMetricFooter } from '../../render/footer';

export const telegramOutbound: ChannelOutboundAdapter = {
  deliveryMode: 'direct',

  textChunkLimit: 4096,

  sendText: async ({ cfg, to, text, accountId, replyToId, threadId }) => {
    const rawCfg = cfg as { channels?: { telegram?: TelegramAccountConfig } };
    const config = rawCfg?.channels?.telegram;
    if (!config?.botToken) {
      throw new Error('Telegram Bot Token is not configured');
    }

    const client = TelegramClient.fromConfig(config);
    const chatId = to.replace(/^(tg|telegram):/, '');
    const replyId = replyToId ? Number(replyToId) : undefined;
    const thread = threadId ? Number(threadId) : undefined;

    const res = await client.bot.api.sendMessage(chatId, text, {
      reply_parameters: replyId ? { message_id: replyId } : undefined,
      message_thread_id: thread,
      parse_mode: 'HTML',
    });

    return {
      channel: 'telegram',
      messageId: String(res.message_id),
      chatId: String(res.chat.id),
    };
  },

  sendMedia: async ({ cfg, to, text, mediaUrl, accountId, replyToId, threadId }) => {
    const rawCfg = cfg as { channels?: { telegram?: TelegramAccountConfig } };
    const config = rawCfg?.channels?.telegram;
    if (!config?.botToken) {
      throw new Error('Telegram Bot Token is not configured');
    }

    const client = TelegramClient.fromConfig(config);
    const chatId = to.replace(/^(tg|telegram):/, '');
    const replyId = replyToId ? Number(replyToId) : undefined;
    const thread = threadId ? Number(threadId) : undefined;

    if (mediaUrl) {
      const res = await client.bot.api.sendDocument(chatId, mediaUrl, {
        caption: text || undefined,
        reply_parameters: replyId ? { message_id: replyId } : undefined,
        message_thread_id: thread,
        parse_mode: 'HTML',
      });
      return {
        channel: 'telegram',
        messageId: String(res.message_id),
        chatId: String(res.chat.id),
      };
    }

    const res = await client.bot.api.sendMessage(chatId, text || '(empty)', {
      reply_parameters: replyId ? { message_id: replyId } : undefined,
      message_thread_id: thread,
      parse_mode: 'HTML',
    });
    return {
      channel: 'telegram',
      messageId: String(res.message_id),
      chatId: String(res.chat.id),
    };
  },
};
