"use client";

import {
  getRequiredTauriInvoke as getSharedRequiredTauriInvoke,
  getTauriInvoke as getSharedTauriInvoke,
  type TauriInvoke,
} from "../../_lib/tauri-bridge.ts";

export type { TauriInvoke } from "../../_lib/tauri-bridge.ts";

export function getTauriInvoke(): TauriInvoke | null {
  return getSharedTauriInvoke();
}

export function hasTauriInvoke(): boolean {
  return typeof getTauriInvoke() === "function";
}

export function getRequiredTauriInvoke(): TauriInvoke {
  return getSharedRequiredTauriInvoke();
}
