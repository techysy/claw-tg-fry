import type { PluginRuntime } from 'openclaw/plugin-sdk/core';

let runtime: PluginRuntime | null = null;

export function setTelegramRuntime(nextRuntime: PluginRuntime): void {
  runtime = nextRuntime;
}

export function getTelegramRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error('Telegram plugin runtime has not been initialized');
  }
  return runtime;
}

export function tryGetTelegramRuntime(): PluginRuntime | null {
  return runtime;
}
