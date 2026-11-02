import type { ChannelOutboundAdapter } from 'openclaw/plugin-sdk/channel-send-result';
import { TelegramClient } from '../../core/client';
import type { TelegramAccountConfig } from '../../core/config-schema';
import { markdownToTelegramHtml, splitReasoningText, renderExpandableQuote } from '../../render/escape';
import { formatMetricFooter, appendMetricFooter } from '../../render/footer';

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

    // 分离 reasoning 和正文并转换为 Telegram 原生 HTML 渲染
    const { reasoningText, answerText } = splitReasoningText(text);
    let finalHtml = '';
    if (reasoningText) {
      finalHtml += renderExpandableQuote(reasoningText, '💭 思考过程') + '\n\n';
    }
    finalHtml += markdownToTelegramHtml(answerText || text);

    const res = await client.bot.api.sendMessage(chatId, finalHtml, {
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

    const { reasoningText, answerText } = splitReasoningText(text);
    let finalHtml = '';
    if (reasoningText) {
      finalHtml += renderExpandableQuote(reasoningText, '💭 思考过程') + '\n\n';
    }
    finalHtml += markdownToTelegramHtml(answerText || text || '(empty)');

    const res = await client.bot.api.sendMessage(chatId, finalHtml, {
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
