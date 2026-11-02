import type { OpenClawConfig, PluginRuntime, ReplyPayload } from 'openclaw/plugin-sdk/core';
import type { TelegramAccountConfig } from '../core/config-schema';
import { TelegramClient } from '../core/client';
import { TypewriterScheduler } from './typewriter';
import { TelegramStreamingCardController } from './streaming-controller';
import { getTelegramRuntime } from '../core/runtime-store';
import { resolveFooterConfig } from '../render/config/footer-config';
import { resolvePanelSettings } from '../render/config/panel-config';

/** 本插件 id（用于读取 plugins.entries.<id>.config）。 */
export const PLUGIN_ID = 'claw-tg-fry';

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

  const sessionKey = `agent:main:telegram:${params.chatId}${params.threadId ? `:topic:${params.threadId}` : ''}`;

  // 插件级配置优先（plugins.entries.claw-tg-fry.config），回落通道级（channels.telegram）
  const rawCfg = params.cfg as unknown;
  const footer = resolveFooterConfig(
    readPluginFooter(rawCfg) ?? (params.config as { footer?: Parameters<typeof resolveFooterConfig>[0] }).footer,
  );
  const panel = resolvePanelSettings(rawCfg, PLUGIN_ID);

  const controller = new TelegramStreamingCardController({
    client,
    scheduler,
    chatId: params.chatId,
    sessionKey,
    replyToMessageId: params.messageId,
    threadId: params.threadId,
    instantPlaceholder: params.config.instantPlaceholder,
    footer,
    panel,
    cfg: rawCfg,
  });

  // 1. 派发即建卡：1 秒内发送占位卡
  await controller.start();

  // 2. 构造 Inbound 上下文
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

/** 读插件级 footer（plugins.entries.<id>.config.footer）。 */
function readPluginFooter(rawCfg: unknown): unknown {
  if (!rawCfg || typeof rawCfg !== 'object') return undefined;
  const entry = (rawCfg as { plugins?: { entries?: Record<string, unknown> } }).plugins?.entries?.[PLUGIN_ID];
  if (!entry || typeof entry !== 'object') return undefined;
  return (entry as { config?: { footer?: unknown } }).config?.footer;
}
