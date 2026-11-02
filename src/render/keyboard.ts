import { InlineKeyboard } from 'grammy';
import type { InlineButtonAction } from '../core/types';

export function buildStandardActionKeyboard(options?: {
  hasReasoning?: boolean;
  reasoningExpanded?: boolean;
  enableRegenerate?: boolean;
  enableTrace?: boolean;
  enableClearContext?: boolean;
}): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  const firstRow: { text: string; data: string }[] = [];

  if (options?.hasReasoning) {
    if (options.reasoningExpanded) {
      firstRow.push({ text: '🙈 收起思考过程', data: 'action:toggle_reasoning' });
    } else {
      firstRow.push({ text: '💭 展开思考过程', data: 'action:toggle_reasoning' });
    }
  }

  if (options?.enableTrace ?? true) {
    firstRow.push({ text: '📊 运行指标', data: 'action:trace_info' });
  }

  for (const btn of firstRow) {
    keyboard.text(btn.text, btn.data);
  }

  keyboard.row();

  if (options?.enableRegenerate ?? true) {
    keyboard.text('🔄 重新生成', 'action:regenerate');
  }

  if (options?.enableClearContext ?? true) {
    keyboard.text('🧹 清理上下文', 'action:clear_context');
  }

  return keyboard;
}

export function buildCustomInlineKeyboard(buttons: InlineButtonAction[][]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const row of buttons) {
    for (const btn of row) {
      if (btn.url) {
        keyboard.url(btn.text, btn.url);
      } else if (btn.callbackData) {
        keyboard.text(btn.text, btn.callbackData);
      }
    }
    keyboard.row();
  }
  return keyboard;
}
