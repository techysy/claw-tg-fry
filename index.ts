import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import { buildPluginConfigSchema } from 'openclaw/plugin-sdk/core';
import { telegramPlugin } from './src/channel/plugin';
import { PluginConfigSchema } from './src/core/config-schema';
import { setTelegramRuntime } from './src/core/runtime-store';

export { telegramPlugin } from './src/channel/plugin';
export { TelegramClient } from './src/core/client';
export { TypewriterScheduler } from './src/messaging/typewriter';
export { TelegramStreamingCardController } from './src/messaging/streaming-controller';
export { dispatchInboundTelegramMessage } from './src/messaging/dispatcher';
export { escapeHtml, escapeMarkdownV2, renderExpandableQuote, markdownToTelegramHtml } from './src/render/escape';
export { formatMetricFooter, appendMetricFooter, appendFooterSections } from './src/render/segments/footer';
export { formatFooterRuntimeSegments } from './src/render/segments/footer';
export { formatPanelSegments } from './src/render/segments/panel';
export { buildTerminalCardHtml } from './src/render/segments/terminal-card';
export { resolveFooterConfig, DEFAULT_FOOTER_CONFIG } from './src/render/config/footer-config';
export {
  resolvePanelSettings,
  readPanelSettings,
  resolvePanelModelName,
  PANEL_FIELD_POOL,
  DEFAULT_PANEL_FIELDS,
} from './src/render/config/panel-config';
export { shouldShowPanel } from './src/render/config/panel-gate';
export { fetchSessionMetricsFromSqlite } from './src/core/metrics';
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
    setTelegramRuntime(api.runtime);
    api.registerChannel({ plugin: telegramPlugin });
  },
};

export default plugin;

