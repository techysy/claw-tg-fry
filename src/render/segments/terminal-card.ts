import type { TerminalCardRenderParams } from '../../core/types';
import { escapeHtml, renderExpandableQuote, markdownToTelegramHtml } from '../escape';
import { appendFooterSections } from './footer';
import { formatPanelSegments } from './panel';
import { shouldShowPanel } from '../config/panel-gate';
import { resolvePanelModelName } from '../config/panel-config';

/**
 * 组装终版卡片 HTML：正文（+ 可折叠思考）+ 面板标题段（有门槛）+ footer（配置驱动）。
 *
 * 面板门槛：耗时 ≥ `unifiedPanelMinDuration` / 有思考 / 有工具调用。
 * footer 默认全关 —— 只有显式开启的项才会渲染。
 */
export function buildTerminalCardHtml(
  finalText: string,
  reasoningText: string,
  params: TerminalCardRenderParams,
): string {
  const { elapsedMs, metrics, footer, panel, aliasTable } = params;

  let html = '';
  if (reasoningText) {
    html += renderExpandableQuote(reasoningText, '💭 思考过程') + '\n\n';
  }
  html += markdownToTelegramHtml(finalText);

  const hasReasoning = Boolean(reasoningText?.trim());
  const toolCount = metrics?.toolCount ?? 0;

  if (shouldShowPanel(panel, { elapsedMs, hasReasoning, toolCount })) {
    const rawModel = (metrics?.model ?? '').trim();
    const modelName = resolvePanelModelName(aliasTable, rawModel, {
      truncateModelName: panel?.truncateModelName,
      modelAliasesEnabled: panel?.modelAliasesEnabled,
    });

    const segments = formatPanelSegments({
      fields: panel?.fields,
      metrics,
      modelName: rawModel ? modelName : undefined,
      hasReasoning,
      toolCount,
      elapsedMs,
      contextDisplayMode: panel?.contextDisplayMode,
    });

    if (segments.length > 1) {
      html += `\n\n<code>${escapeHtml(segments.join(' · '))}</code>`;
    }
  }

  html = appendFooterSections(html, footer, metrics, { elapsedMs }, 'HTML');
  return html;
}
