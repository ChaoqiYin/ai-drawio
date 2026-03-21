"use client";

import { getRequiredTauriInvoke } from "../../_lib/tauri-bridge.ts";

const TRAY_RUNTIME_STATE_CHANGE_EVENT = "ai-drawio:tray-runtime-state-change";

export type TrayCloseBehavior = "hide_to_tray" | "quit";

export type TraySettingsState = {
  enabled: boolean;
  trayVisible: boolean;
  mainWindowVisible: boolean;
  closeBehavior: TrayCloseBehavior;
};

export async function getTraySettings(): Promise<TraySettingsState> {
  const invoke = getRequiredTauriInvoke();
  return invoke("get_tray_settings") as Promise<TraySettingsState>;
}

export async function setTrayEnabled(enabled: boolean): Promise<TraySettingsState> {
  const invoke = getRequiredTauriInvoke();
  return invoke("set_tray_enabled", {
    enabled,
  }) as Promise<TraySettingsState>;
}

export function subscribeTrayRuntimeStateChange(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = (): void => {
    listener();
  };

  window.addEventListener(TRAY_RUNTIME_STATE_CHANGE_EVENT, handleChange);

  return () => {
    window.removeEventListener(TRAY_RUNTIME_STATE_CHANGE_EVENT, handleChange);
  };
}
