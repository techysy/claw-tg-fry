import { z } from 'zod';

export const DmPolicyEnum = z.enum(['open', 'pairing', 'allowlist', 'disabled']);
export const GroupPolicyEnum = z.enum(['open', 'allowlist', 'disabled']);
export const ConnectionModeEnum = z.enum(['polling', 'webhook']);

const ContextDisplayModeEnum = z.enum(['text', 'bar', 'text_bar']);

const PanelFieldEnum = z.enum([
  'model',
  'reasoning',
  'tools',
  'context',
  'cache',
  'output',
  'speed',
  'elapsed',
]);

const ModelAliasRuleSchema = z
  .object({
    name: z.string(),
    days: z.array(z.number().int()).or(z.string()).optional(),
    start: z.string().optional(),
    end: z.string().optional(),
  })
  .optional();

const ModelAliasEntrySchema = z
  .union([
    z.string(),
    z
      .object({
        name: z.string().optional(),
        timeAliases: z.array(ModelAliasRuleSchema).optional(),
      })
      .optional(),
  ])
  .optional();

const PeakValleyEntrySchema = z.object({
  peakName: z.string(),
  valleyName: z.string(),
  schedule: z.string().optional(),
});

/**
 * Footer 显示项配置：默认全部关闭（与 hermes-fry-cards 同源语义）。
 */
export const FooterConfigSchema = z
  .object({
    status: z.boolean().default(false),
    elapsed: z.boolean().default(false),
    tokens: z.boolean().default(false),
    cache: z.boolean().default(false),
    context: z.boolean().default(false),
    model: z.boolean().default(false),
    provider: z.boolean().default(false),
  })
  .optional();

export type FooterConfigInput = z.infer<typeof FooterConfigSchema>;

/**
 * 面板配置。`fields` 是有序数组，数组顺序即标题段显示顺序；
 * 未列出的段不显示，未配置时用缺省顺序（全部字段）。
 */
export const PanelConfigSchema = z
  .object({
    /** 面板显示门槛（秒）：耗时 ≥ 此值或有思考/工具调用时出面板。 */
    unifiedPanelMinDuration: z.number().default(3),
    contextDisplayMode: ContextDisplayModeEnum.default('text_bar'),
    expanded: z.boolean().default(false),
    truncateModelName: z.boolean().default(true),
    modelAliasesEnabled: z.boolean().default(true),
    modelAliases: z.record(z.string(), ModelAliasEntrySchema).optional(),
    peakValley: z.array(PeakValleyEntrySchema).optional(),
    fields: z.array(PanelFieldEnum).optional(),
  })
  .optional();

export type PanelConfigInput = z.infer<typeof PanelConfigSchema>;

export const TelegramAccountConfigSchema = z.object({
  botToken: z.string().min(1, 'Telegram Bot Token is required'),
  apiRoot: z.string().optional().default('https://api.telegram.org'),
  connectionMode: ConnectionModeEnum.default('polling'),
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().optional(),
  webhookPort: z.number().int().optional(),
  throttleIntervalMs: z.number().min(300).max(5000).default(900),
  instantPlaceholder: z.boolean().default(true),
  dmPolicy: DmPolicyEnum.default('pairing'),
  allowFrom: z.array(z.string()).default([]),
  groupPolicy: GroupPolicyEnum.default('open'),
  groupAllowFrom: z.array(z.string()).default([]),
  requireMention: z.boolean().default(true),
  panel: PanelConfigSchema,
  footer: FooterConfigSchema,
});

export type TelegramAccountConfig = z.infer<typeof TelegramAccountConfigSchema>;

export const PluginConfigSchema = z.object({
  telegram: TelegramAccountConfigSchema.optional(),
  panel: PanelConfigSchema,
  footer: FooterConfigSchema,
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;
