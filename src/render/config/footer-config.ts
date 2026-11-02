/**
 * Footer 显示项配置（与 hermes-fry-cards / claw-fry-cards 同源语义）。
 *
 * 默认**全部关闭**：既不出状态文案（已完成 / 出错 / 已停止），也不出耗时。
 * 只有显式开启的项才会渲染进卡片底部。
 */

export interface FooterConfig {
  status: boolean;
  elapsed: boolean;
  tokens: boolean;
  cache: boolean;
  context: boolean;
  model: boolean;
  provider: boolean;
}

/**
 * 缺省 footer 配置：所有元信息项均隐藏。
 */
export const DEFAULT_FOOTER_CONFIG: FooterConfig = {
  status: false,
  elapsed: false,
  tokens: false,
  cache: false,
  context: false,
  model: false,
  provider: false,
};

/**
 * 合并局部 footer 配置与 {@link DEFAULT_FOOTER_CONFIG}。
 * 输入中显式给出的字段优先，缺失项回落到缺省值。
 */
export function resolveFooterConfig(cfg?: Partial<FooterConfig> | null): FooterConfig {
  if (!cfg) return { ...DEFAULT_FOOTER_CONFIG };
  return {
    status: cfg.status ?? DEFAULT_FOOTER_CONFIG.status,
    elapsed: cfg.elapsed ?? DEFAULT_FOOTER_CONFIG.elapsed,
    tokens: cfg.tokens ?? DEFAULT_FOOTER_CONFIG.tokens,
    cache: cfg.cache ?? DEFAULT_FOOTER_CONFIG.cache,
    context: cfg.context ?? DEFAULT_FOOTER_CONFIG.context,
    model: cfg.model ?? DEFAULT_FOOTER_CONFIG.model,
    provider: cfg.provider ?? DEFAULT_FOOTER_CONFIG.provider,
  };
}
