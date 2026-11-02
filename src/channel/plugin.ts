import type { ChannelPlugin, OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { buildChannelConfigSchema } from 'openclaw/plugin-sdk/core';
import type { TelegramAccount } from '../core/types';
import { TelegramAccountConfigSchema, type TelegramAccountConfig } from '../core/config-schema';
import { TelegramClient } from '../core/client';
import { TelegramInboundAdapter } from './inbound';
import { telegramOutbound } from '../messaging/outbound/outbound';

const meta = {
  id: 'telegram',
  label: 'Telegram (fry)',
  selectionLabel: 'Telegram（虾条卡片与打字机）',
  docsPath: 'https://github.com/techysy/claw-tg-fry#readme',
  docsLabel: 'Telegram 虾条插件文档',
  blurb: '面向 Telegram 的高级卡片与打字机流式通道插件（派发即建卡 · 节流调度 · 4096 字符智能分页 · 原生折叠）。',
  aliases: ['tg'],
  order: 60,
};

let activeInbound: TelegramInboundAdapter | null = null;

export const telegramPlugin: ChannelPlugin<TelegramAccount> = {
  id: 'telegram',
  meta,

  capabilities: {
    chatTypes: ['direct', 'group'],
    media: true,
    reactions: true,
    threads: true,
    polls: false,
    nativeCommands: true,
    blockStreaming: true,
  },

  outbound: telegramOutbound,

  configSchema: buildChannelConfigSchema(
    TelegramAccountConfigSchema as unknown as Parameters<typeof buildChannelConfigSchema>[0],
    {
      uiHints: {
        botToken: { label: 'Bot Token', sensitive: true, help: '从 @BotFather 获取的 Bot Token' },
        apiRoot: { label: 'API 根路径', help: 'Telegram Bot API 代理地址，默认官方端点' },
        connectionMode: { label: '连接方式', help: '长轮询 polling 或 webhook' },
        throttleIntervalMs: { label: '打字机节流周期 (ms)', help: '消息就地更新流控周期（默认 900ms）' },
        instantPlaceholder: { label: '派发即建卡', help: '收到消息后 1 秒内回复占位卡' },
      },
    },
  ),

  config: {
    listAccountIds: (cfg: OpenClawConfig) => {
      const tg = (cfg as { channels?: { telegram?: Record<string, unknown> } })?.channels?.telegram;
      if (!tg) return [];
      return ['default'];
    },
    resolveAccount: (cfg: OpenClawConfig, accountId?: string | null): TelegramAccount => {
      const tg = (cfg as { channels?: { telegram?: Record<string, unknown> } })?.channels?.telegram;
      const targetAccountId = accountId || 'default';
      return {
        accountId: targetAccountId,
        enabled: Boolean(tg?.botToken),
        configured: Boolean(tg?.botToken),
        config: tg as unknown as TelegramAccount['config'],
      };
    },
    defaultAccountId: () => 'default',
    isConfigured: (account) => Boolean(account?.configured),
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
    }),
  },

  status: {
    defaultRuntime: {
      accountId: 'default',
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      port: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      port: snapshot.port ?? null,
    }),
    probeAccount: async ({ account }) => {
      if (!account.config?.botToken) return { ok: false, error: 'No Bot Token configured' };
      try {
        const client = TelegramClient.fromConfig(account.config);
        const me = await client.getMe();
        return { ok: true, details: { id: me.id, username: me.username } };
      } catch (err: unknown) {
        return { ok: false, error: String(err) };
      }
    },
  },

  gateway: {
    startAccount: async (ctx) => {
      ctx.log?.info(`[claw-tg-fry] Starting Telegram provider for account: ${ctx.accountId}`);
      const rawCfg = ctx.cfg as { channels?: { telegram?: TelegramAccountConfig } };
      const config = rawCfg?.channels?.telegram;
      if (!config?.botToken) {
        throw new Error('Telegram Bot Token is missing');
      }

      activeInbound = new TelegramInboundAdapter({
        config,
        onUserMessage: async (evt) => {
          ctx.log?.info(`[claw-tg-fry] Received message in chat ${evt.chatId}: ${evt.text}`);
          const { dispatchInboundTelegramMessage } = await import('../messaging/dispatcher');
          await dispatchInboundTelegramMessage({
            cfg: ctx.cfg,
            config,
            chatId: evt.chatId,
            userId: evt.userId,
            messageId: evt.messageId,
            text: evt.text,
            threadId: evt.threadId,
            isGroup: evt.isGroup,
          });
        },
        onCallbackQuery: async (evt) => {
          ctx.log?.info(`[claw-tg-fry] Received callback action ${evt.data} in chat ${evt.chatId}`);
        },
      });

      // 挂住通道生命周期，直到网关发出 abortSignal
      await activeInbound.start(ctx.abortSignal);
    },

    stopAccount: async (ctx) => {
      ctx.log?.info(`[claw-tg-fry] Stopping Telegram provider for account: ${ctx.accountId}`);
      if (activeInbound) {
        await activeInbound.stop();
        activeInbound = null;
      }
    },
  },
};

