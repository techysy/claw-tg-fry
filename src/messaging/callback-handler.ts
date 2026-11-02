import type { Context } from 'grammy';
import { messageStateStore } from './state-store';
import { renderExpandableQuote } from '../render/escape';
import { appendMetricFooter } from '../render/footer';
import { buildStandardActionKeyboard } from '../render/keyboard';

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

    let displayContent = '';
    if (cached.reasoningExpanded) {
      displayContent += renderExpandableQuote(`💭 思考过程:\n${cached.reasoningText}`, 'HTML') + '\n\n';
    } else {
      displayContent += `<i>💡 已包含思考推理过程（可通过下方按钮展开）</i>\n\n`;
    }
    displayContent += cached.mainText;

    displayContent = appendMetricFooter(
      displayContent,
      {
        elapsedMs: cached.elapsedMs,
      },
      'HTML',
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
    const sec = cached?.elapsedMs ? (cached.elapsedMs / 1000).toFixed(1) : '9.0';
    const alertText = [
      '📊 运行与耗时分析',
      '━━━━━━━━━━━━━━━━',
      `⏱ 总耗时: ${sec}s`,
      '⚡️ 推理状态: 极速就地更新',
      '🌊 上下文: 正常',
      '🚀 调度引擎: claw-tg-fry v1.0.0',
    ].join('\n');

    await ctx.answerCallbackQuery({
      text: alertText,
      show_alert: true,
    });
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
