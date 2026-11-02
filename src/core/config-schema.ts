import { z } from 'zod';

export const DmPolicyEnum = z.enum(['open', 'pairing', 'allowlist', 'disabled']);
export const GroupPolicyEnum = z.enum(['open', 'allowlist', 'disabled']);
export const ConnectionModeEnum = z.enum(['polling', 'webhook']);

export const PanelConfigSchema = z
  .object({
    unifiedPanelMinDuration: z.number().default(3),
    modelAliases: z.record(z.string(), z.string()).optional(),
    peakValley: z
      .record(
        z.string(),
        z.object({
          peakName: z.string(),
          valleyName: z.string(),
        }),
      )
      .optional(),
  })
  .optional();

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
});

export type TelegramAccountConfig = z.infer<typeof TelegramAccountConfigSchema>;

export const PluginConfigSchema = z.object({
  telegram: TelegramAccountConfigSchema.optional(),
  panel: PanelConfigSchema,
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;
