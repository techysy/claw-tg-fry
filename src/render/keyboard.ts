import { InlineKeyboard } from 'grammy';
import type { InlineButtonAction } from '../core/types';

export function buildStandardActionKeyboard(options?: {
  enableRegenerate?: boolean;
  enableTrace?: boolean;
  enableClearContext?: boolean;
}): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (options?.enableRegenerate ?? true) {
    keyboard.text('🔄 重新生成', 'action:regenerate');
  }

  if (options?.enableTrace ?? true) {
    keyboard.text('📊 耗时分析', 'action:trace_info');
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
