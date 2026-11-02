import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import { buildPluginConfigSchema } from 'openclaw/plugin-sdk/core';
import { telegramPlugin } from './src/channel/plugin';
import { PluginConfigSchema } from './src/core/config-schema';

export { telegramPlugin } from './src/channel/plugin';
export { TelegramClient } from './src/core/client';
export { TypewriterScheduler } from './src/messaging/typewriter';
export { escapeHtml, escapeMarkdownV2, renderExpandableQuote } from './src/render/escape';
export { formatMetricFooter, appendMetricFooter } from './src/render/footer';
export { splitMessageSmart, TELEGRAM_MAX_MESSAGE_LENGTH } from './src/render/pager';
export { buildStandardActionKeyboard, buildCustomInlineKeyboard } from './src/render/keyboard';

const plugin = {
  id: 'claw-tg-fry',
  name: 'Telegram 虾条卡片通道',
  description: '面向 OpenClaw 的 Telegram 虾条通道插件（派发即建卡 · 动态节流调度 · 4096 智能分页 · 原生折叠与指标面板）',
  configSchema: buildPluginConfigSchema(
    PluginConfigSchema as unknown as Parameters<typeof buildPluginConfigSchema>[0],
  ),
  register(api: OpenClawPluginApi): void {
    api.registerChannel({ plugin: telegramPlugin });
  },
};

export default plugin;
