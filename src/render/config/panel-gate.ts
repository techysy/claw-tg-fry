import type { ResolvedPanelSettings } from './panel-config';

export interface PanelGateParams {
  elapsedMs?: number;
  hasReasoning?: boolean;
  toolCount?: number;
}

/**
 * 面板显示门槛：耗时 ≥ 门槛，或有思考过程，或有工具调用。
 *
 * 门槛来自 `panel.unifiedPanelMinDuration`（秒），缺省 5s。
 * 任一条件命中即出面板；全部不命中则整块面板（含 🍤 标题段）不渲染。
 */
export function shouldShowPanel(
  panel: ResolvedPanelSettings | undefined,
  params: PanelGateParams,
): boolean {
  const minMs = panel?.unifiedPanelMinDurationMs ?? 5000;
  const elapsed = params.elapsedMs ?? 0;
  return elapsed >= minMs || Boolean(params.hasReasoning) || (params.toolCount ?? 0) > 0;
}
