import { DatabaseSync } from 'node:sqlite';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface SessionMetrics {
  inputTokens?: number;
  outputTokens?: number;
  outputTokensTotal?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  model?: string;
  provider?: string;
  tokensPerSecond?: number;
  contextTokens?: number;
  toolCount?: number;
  hasReasoning?: boolean;
}

interface UsageLike {
  input?: unknown;
  output?: unknown;
  cacheRead?: unknown;
  cacheWrite?: unknown;
  totalTokens?: unknown;
}

interface TranscriptEvent {
  type?: unknown;
  timestamp?: unknown;
  message?: {
    role?: unknown;
    model?: unknown;
    provider?: unknown;
    usage?: unknown;
    content?: unknown;
  };
}

/** 生成速度有效区间（毫秒）：超出视为跨轮次/工具段，静默省略。 */
const TPS_MAX_DURATION_MS = 30 * 60 * 1000;

/**
 * 本轮生成速度 = 本轮 output / 本轮生成耗时。
 * 耗时由 transcript 时间戳推算：本轮 assistant(usage) 事件时间戳 − 其紧邻前一条
 * 事件的时间戳（轮次起点），不含工具执行段。任一环缺失/异常时返回 undefined。
 */
export function deriveTokensPerSecond(
  db: DatabaseSync,
  sessionId: string,
  usageRowid: number,
  usageTimestamp: unknown,
  outputTokens: number | undefined,
): number | undefined {
  try {
    if (typeof outputTokens !== 'number' || outputTokens <= 0) return undefined;
    const usageTsMs = typeof usageTimestamp === 'string' ? Date.parse(usageTimestamp) : NaN;
    if (!Number.isFinite(usageTsMs)) return undefined;

    const prev = db
      .prepare('SELECT event_json FROM transcript_events WHERE session_id = ? AND rowid < ? ORDER BY rowid DESC LIMIT 1')
      .get(sessionId, usageRowid) as { event_json?: string } | undefined;
    if (!prev?.event_json) return undefined;

    const prevEv = JSON.parse(prev.event_json) as TranscriptEvent;
    const prevTsMs = typeof prevEv?.timestamp === 'string' ? Date.parse(prevEv.timestamp) : NaN;
    if (!Number.isFinite(prevTsMs)) return undefined;

    const durationMs = usageTsMs - prevTsMs;
    if (durationMs <= 0 || durationMs > TPS_MAX_DURATION_MS) return undefined;
    return outputTokens / (durationMs / 1000);
  } catch {
    return undefined;
  }
}

/**
 * 从 `cfg.models.providers[provider].models` 解析模型上下文窗口。
 * 解析不到时返回 undefined（该段静默省略，不再回落硬编码 128k）。
 */
export function resolveContextWindow(
  cfg: unknown,
  provider: string | undefined,
  model: string | undefined,
): number | undefined {
  try {
    if (!provider || !model) return undefined;
    const providers = (cfg as { models?: { providers?: Record<string, unknown> } })?.models?.providers ?? {};
    const pcfg = providers[provider] as { models?: Array<{ id?: unknown; contextWindow?: unknown }> } | undefined;
    if (!pcfg || !Array.isArray(pcfg.models)) return undefined;
    const found = pcfg.models.find((m) => m && m.id === model);
    return typeof found?.contextWindow === 'number' ? found.contextWindow : undefined;
  } catch {
    return undefined;
  }
}

/** 统计 transcript 中的工具调用次数与是否出现思考过程。 */
function scanActivity(rows: Array<{ event_json?: string }>): { toolCount: number; hasReasoning: boolean } {
  let toolCount = 0;
  let hasReasoning = false;

  for (const row of rows) {
    if (!row?.event_json) continue;
    let ev: TranscriptEvent;
    try {
      ev = JSON.parse(row.event_json) as TranscriptEvent;
    } catch {
      continue;
    }

    const content = ev?.message?.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part && typeof part === 'object' && (part as { type?: unknown }).type === 'toolCall') {
          toolCount += 1;
        }
        if (
          part &&
          typeof part === 'object' &&
          ((part as { type?: unknown }).type === 'reasoning' ||
            (part as { type?: unknown }).type === 'thinking')
        ) {
          hasReasoning = true;
        }
      }
    }

    if (typeof ev?.type === 'string' && ev.type === 'message' && ev.message?.role === 'tool') {
      // tool result rows don't add to tool count (counted from toolCall parts)
      continue;
    }

    if (typeof content === 'string' && /<\s*(?:think|thinking)\s*>/.test(content)) {
      hasReasoning = true;
    }
  }

  return { toolCount, hasReasoning };
}

/**
 * 从 OpenClaw agent transcript SQLite 拉取本轮会话指标。
 *
 * 读取范围 `LIMIT 500`（与 hermes-fry-cards 一致），取**最近一条**带 usage 的
 * assistant 事件作为本轮指标，并累计本轮全部 output。
 */
export function fetchSessionMetricsFromSqlite(
  agentId = 'main',
  sessionKey = 'agent:main:telegram:8191135144',
  cfg?: unknown,
): SessionMetrics | undefined {
  try {
    const dbPath = join(homedir(), '.openclaw', 'agents', agentId, 'agent', 'openclaw-agent.sqlite');
    const db = new DatabaseSync(dbPath, { readOnly: true });

    try {
      const window = db
        .prepare(
          'SELECT session_id FROM session_windows WHERE lower(session_key) = ? ORDER BY updated_at DESC LIMIT 1',
        )
        .get(sessionKey.trim().toLowerCase()) as { session_id: string } | undefined;

      if (!window?.session_id) return undefined;

      const rows = db
        .prepare(
          "SELECT rowid, event_json FROM transcript_events WHERE session_id = ? AND event_json LIKE '%usage%' ORDER BY rowid DESC LIMIT 500",
        )
        .all(window.session_id) as Array<{ rowid: number; event_json: string } | undefined>;

      if (!rows.length) return undefined;

      let metrics: SessionMetrics | undefined;
      let outputTotal = 0;
      let sawOutput = false;

      for (const row of rows) {
        if (!row?.event_json) continue;
        let ev: TranscriptEvent;
        try {
          ev = JSON.parse(row.event_json) as TranscriptEvent;
        } catch {
          continue;
        }

        const msg = ev?.message ?? {};
        const u = msg.usage as UsageLike | undefined;
        if (!u) continue;

        if (!metrics) {
          const inputTokens = typeof u.input === 'number' ? u.input : undefined;
          const outputTokens = typeof u.output === 'number' ? u.output : undefined;
          const cacheRead = typeof u.cacheRead === 'number' ? u.cacheRead : undefined;
          const cacheWrite = typeof u.cacheWrite === 'number' ? u.cacheWrite : undefined;
          const totalTokens = typeof u.totalTokens === 'number' ? u.totalTokens : undefined;

          metrics = {
            inputTokens,
            outputTokens,
            cacheRead,
            cacheWrite,
            totalTokens,
            model: typeof msg.model === 'string' ? msg.model : undefined,
            provider: typeof msg.provider === 'string' ? msg.provider : undefined,
          };

          metrics.tokensPerSecond = deriveTokensPerSecond(
            db,
            window.session_id,
            row.rowid,
            ev.timestamp,
            metrics.outputTokens,
          );
        }

        if (typeof u.output === 'number' && u.output > 0) {
          outputTotal += u.output;
          sawOutput = true;
        }
      }

      if (!metrics) return undefined;
      if (sawOutput) metrics.outputTokensTotal = outputTotal;

      const ctxWindow = resolveContextWindow(cfg, metrics.provider, metrics.model);
      if (ctxWindow != null) metrics.contextTokens = ctxWindow;

      // 工具调用与思考过程需要全量事件（usage 事件只是子集）
      const activityRows = (db
        .prepare('SELECT event_json FROM transcript_events WHERE session_id = ? ORDER BY rowid DESC LIMIT 500')
        .all(window.session_id) as Array<{ event_json?: string } | undefined>).filter(
          (row): row is { event_json?: string } => row != null,
        );
      const activity = scanActivity(activityRows);
      metrics.toolCount = activity.toolCount;
      metrics.hasReasoning = activity.hasReasoning;

      return metrics;
    } finally {
      db.close();
    }
  } catch (err) {
    console.warn('[claw-tg-fry] fetchSessionMetricsFromSqlite failed:', err);
    return undefined;
  }
}
