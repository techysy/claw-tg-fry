import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  escapeHtml,
  escapeMarkdownV2,
  renderExpandableQuote,
  formatMetricFooter,
  appendMetricFooter,
  splitMessageSmart,
  buildStandardActionKeyboard,
  buildCustomInlineKeyboard,
  TypewriterScheduler,
} from '../index';

describe('claw-tg-fry Render Engine', () => {
  it('escapes HTML special characters correctly', () => {
    expect(escapeHtml('<script>alert("hello & world")</script>')).toBe(
      '&lt;script&gt;alert("hello &amp; world")&lt;/script&gt;',
    );
  });

  it('escapes MarkdownV2 special characters correctly', () => {
    expect(escapeMarkdownV2('Hello [world]! *bold* _italic_')).toBe(
      'Hello \\[world\\]\\! \\*bold\\* \\_italic\\_',
    );
  });

  it('renders expandable quote in HTML format', () => {
    const quote = renderExpandableQuote('Thinking step by step...', 'HTML');
    expect(quote).toBe('<blockquote expandable>Thinking step by step...</blockquote>');
  });

  it('formats metric footer as compact single line', () => {
    const footer = formatMetricFooter({
      elapsedMs: 1400,
      tokens: 1240,
      tokensPerSec: 82,
      contextUsage: '4.8k/128k',
      modelName: '梁文锋⚡️',
    });
    expect(footer).toBe('⏱ 1.4s · ⚡️ 1,240 tokens · 82 t/s · 🌊 上下文 4.8k/128k · 梁文锋⚡️');
  });

  it('appends metric footer with HTML code wrapper', () => {
    const body = 'Hello response';
    const appended = appendMetricFooter(
      body,
      {
        elapsedMs: 1200,
        tokens: 500,
      },
      'HTML',
    );
    expect(appended).toContain('Hello response\n\n<code>⏱ 1.2s · ⚡️ 500 tokens</code>');
  });
});

describe('Smart 4096 Pager', () => {
  it('does not split short messages', () => {
    const text = 'Short message within limits.';
    expect(splitMessageSmart(text, 4096)).toEqual([text]);
  });

  it('splits long messages at paragraph or sentence boundaries', () => {
    const p1 = 'A'.repeat(3000);
    const p2 = 'B'.repeat(2000);
    const text = `${p1}\n\n${p2}`;
    const chunks = splitMessageSmart(text, 4096);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(p1);
    expect(chunks[1]).toBe(p2);
  });
});

describe('Inline Keyboard Matrix', () => {
  it('builds standard action keyboard with regenerate, trace, and clear', () => {
    const kb = buildStandardActionKeyboard();
    const json = JSON.stringify(kb);
    expect(json).toContain('action:regenerate');
    expect(json).toContain('action:trace_info');
    expect(json).toContain('action:clear_context');
  });

  it('builds custom inline keyboard with custom actions and urls', () => {
    const kb = buildCustomInlineKeyboard([
      [
        { text: 'GitHub', url: 'https://github.com' },
        { text: 'Custom Action', callbackData: 'custom:do_thing' },
      ],
    ]);
    const json = JSON.stringify(kb);
    expect(json).toContain('https://github.com');
    expect(json).toContain('custom:do_thing');
  });
});

describe('TypewriterScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('batches and throttles edit calls', async () => {
    const mockClient = {
      editMessage: vi.fn().mockResolvedValue({}),
    } as any;

    const scheduler = new TypewriterScheduler(mockClient, 500);

    // Enqueue 3 rapid updates for the same message
    scheduler.enqueue({ chatId: 123, messageId: 456, text: 'Thinking 1' });
    scheduler.enqueue({ chatId: 123, messageId: 456, text: 'Thinking 2' });
    scheduler.enqueue({ chatId: 123, messageId: 456, text: 'Final Answer' });

    expect(mockClient.editMessage).not.toHaveBeenCalled();

    // Advance time past throttle interval
    await vi.advanceTimersByTimeAsync(500);

    // Should only have called editMessage with the latest snapshot ('Final Answer')
    expect(mockClient.editMessage).toHaveBeenCalledTimes(1);
    expect(mockClient.editMessage).toHaveBeenCalledWith(123, 456, 'Final Answer', {
      parseMode: undefined,
      replyMarkup: undefined,
    });

    scheduler.stop();
  });
});
