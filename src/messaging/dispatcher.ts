import type { OpenClawConfig, PluginRuntime, ReplyPayload } from 'openclaw/plugin-sdk/core';
import type { TelegramAccountConfig } from '../core/config-schema';
import { TelegramClient } from '../core/client';
import { TypewriterScheduler } from './typewriter';
import { TelegramStreamingCardController } from './streaming-controller';
import { getTelegramRuntime } from '../core/runtime-store';

export interface InboundTelegramMessageParams {
  cfg: OpenClawConfig;
  config: TelegramAccountConfig;
  chatId: number;
  userId: number;
  messageId: number;
  text: string;
  threadId?: number;
  isGroup: boolean;
}

export async function dispatchInboundTelegramMessage(params: InboundTelegramMessageParams): Promise<void> {
  const runtime = getTelegramRuntime();
  const client = TelegramClient.fromConfig(params.config);
  const scheduler = new TypewriterScheduler(client, params.config.throttleIntervalMs);

  const controller = new TelegramStreamingCardController({
    client,
    scheduler,
    chatId: params.chatId,
    replyToMessageId: params.messageId,
    threadId: params.threadId,
    instantPlaceholder: params.config.instantPlaceholder,
  });

  // 1. 派发即建卡：1 秒内发送占位卡
  await controller.start();

  // 2. 构造 Inbound 上下文
  const peerId = String(params.chatId);
  const sessionKey = `agent:main:telegram:${params.chatId}${params.threadId ? `:topic:${params.threadId}` : ''}`;

  const inboundCtx = runtime.channel.reply.finalizeInboundContext({
    Body: params.text,
    Raw: {
      messageId: params.messageId,
      chatId: params.chatId,
      userId: params.userId,
    },
    From: `tg:${params.userId}`,
    To: `tg:${params.chatId}`,
    SessionKey: sessionKey,
    Channel: 'telegram',
    AccountId: 'default',
    ChatType: params.isGroup ? 'group' : 'direct',
    MessageThreadId: params.threadId,
  });

  // 3. 构造打字机与流式 ReplyDispatcher
  const { dispatcher } = runtime.channel.reply.createReplyDispatcherWithTyping({
    deliver: async (payload: ReplyPayload, info?: { kind?: string }) => {
      if (info?.kind === 'final') {
        await controller.complete(payload);
      } else {
        const delta = payload.text || '';
        controller.updateDelta(delta, false);
      }
    },
  });

  // 4. 调用 OpenClaw Agent 核心执行派发
  try {
    await runtime.channel.reply.dispatchReplyFromConfig({
      ctx: inboundCtx,
      cfg: params.cfg,
      dispatcher,
    });
  } catch (err) {
    console.error('[claw-tg-fry] dispatchReplyFromConfig error:', err);
    await controller.complete({
      text: `⚠️ 处理异常: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
