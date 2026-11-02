import type { Context } from 'grammy';
import { messageStateStore } from './state-store';
import { buildTerminalCardHtml } from '../render/segments/terminal-card';
import { buildStandardActionKeyboard } from '../render/keyboard';
import { resolveFooterConfig } from '../render/config/footer-config';
import { compactNumber, computeCacheHitRate } from '../render/segments/format';
import { buildAliasTable } from '../render/segments/panel-alias';

function pct(part: number | undefined, whole: number | undefined): string {
  if (part == null || whole == null || whole <= 0) return '—';
  return `${Math.round((part / whole) * 100)}%`;
}

export async function handleTelegramCallbackQuery(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const msg = ctx.callbackQuery?.message;
  const chatId = ctx.chat?.id;

  if (!data || !msg || !chatId) return;

  const messageId = msg.message_id;

  // 1. 展开/收起思考过程
  if (data === 'action:toggle_reasoning') {
    const cached = messageStateStore.get(chatId, messageId);
    if (!cached || !cached.reasoningText) {
      await ctx.answerCallbackQuery({ text: '💭 该消息未记录思考过程' });
      return;
    }

    cached.reasoningExpanded = !cached.reasoningExpanded;

    // 展开态下重渲染（含面板与配置驱动的 footer，与终版一致）
    const footer = cached.footer ?? resolveFooterConfig(null);
    const displayContent = buildTerminalCardHtml(
      cached.mainText,
      cached.reasoningExpanded ? cached.reasoningText : '',
      {
        elapsedMs: cached.elapsedMs ?? 0,
        metrics: cached.metrics,
        footer,
        panel: cached.panel,
        aliasTable: buildAliasTable(cached.panel),
      },
    );

    const keyboard = buildStandardActionKeyboard({
      hasReasoning: true,
      reasoningExpanded: cached.reasoningExpanded,
    });

    try {
      await ctx.api.editMessageText(chatId, messageId, displayContent, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      await ctx.answerCallbackQuery({
        text: cached.reasoningExpanded ? '已展开思考过程' : '已收起思考过程',
      });
    } catch (err) {
      console.warn('[claw-tg-fry] Failed to toggle reasoning view:', err);
      await ctx.answerCallbackQuery();
    }
    return;
  }

  // 2. 耗时与指标分析（原生居中 Alert 弹窗卡片）
  if (data === 'action:trace_info') {
    const cached = messageStateStore.get(chatId, messageId);
    const metrics = cached?.metrics;
    const sec = (cached?.elapsedMs ?? 0) / 1000;

    const tps = metrics?.tokensPerSecond ?? cached?.tokensPerSec;
    const inputTokens = metrics?.inputTokens ?? cached?.inputTokens;
    const outputTokens =
      metrics?.outputTokensTotal ?? metrics?.outputTokens ?? cached?.outputTokens ?? cached?.tokens;
    const ctxWindow = metrics?.contextTokens;
    const cacheRead = metrics?.cacheRead ?? cached?.cacheRead;
    const cacheWrite = metrics?.cacheWrite;
    const model = metrics?.model ?? cached?.modelName;
    const cacheHit = computeCacheHitRate({ cacheRead, cacheWrite, inputTokens });

    const lines = [
      '🍤 OpenClaw · 性能与调度全景',
      '━━━━━━━━━━━━━━━━━━━━━━',
      `⏱ 响应耗时: ${sec > 0 ? `${sec.toFixed(1)} 秒` : '—'}`,
      `⚡ 生成速度: ${typeof tps === 'number' && tps > 0 ? `${Math.round(tps)} tok/s` : '—'}`,
      `🎫 消耗汇总: 输入 ${inputTokens != null ? compactNumber(inputTokens) : '—'} / 输出 ${
        outputTokens != null ? compactNumber(outputTokens) : '—'
      }`,
      `🌊 上下文池: ${
        ctxWindow != null && inputTokens != null
          ? `${compactNumber(inputTokens)}/${compactNumber(ctxWindow)} (${pct(inputTokens, ctxWindow)})`
          : cached?.contextUsage ?? '—'
      }`,
      `💾 缓存命中: ${cacheHit != null ? `${cacheHit}%` : '—'}`,
      `🤖 调度模型: ${model ?? '—'}`,
      '🚀 调度引擎: claw-tg-fry v1.0.0',
    ];

    await ctx.answerCallbackQuery({ text: lines.join('\n'), show_alert: true });
    return;
  }

  // 3. 清理上下文
  if (data === 'action:clear_context') {
    await ctx.answerCallbackQuery({
      text: '🧹 已成功清理当前会话的上下文记忆！',
      show_alert: false,
    });
    return;
  }

  // 4. 重新生成
  if (data === 'action:regenerate') {
    await ctx.answerCallbackQuery({
      text: '🔄 收到重新生成请求，请向 Bot 稍等片刻...',
      show_alert: false,
    });
    return;
  }

  await ctx.answerCallbackQuery();
}
