"use client";

const TRAY_RUNTIME_STATE_CHANGE_EVENT = "ai-drawio:tray-runtime-state-change";

type TauriInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

type TauriWindow = Window &
  typeof globalThis & {
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
    };
  };

export type TrayCloseBehavior = "hide_to_tray" | "quit";

export type TraySettingsState = {
  enabled: boolean;
  trayVisible: boolean;
  mainWindowVisible: boolean;
  closeBehavior: TrayCloseBehavior;
};

function getTauriInvoke(): TauriInvoke | null {
  const tauriWindow = window as TauriWindow;

  if (typeof tauriWindow.__TAURI_INTERNALS__?.invoke === "function") {
    return tauriWindow.__TAURI_INTERNALS__.invoke;
  }

  if (typeof tauriWindow.__TAURI__?.core?.invoke === "function") {
    return tauriWindow.__TAURI__.core.invoke;
  }

  return null;
}

function getRequiredTauriInvoke(): TauriInvoke {
  const invoke = getTauriInvoke();

  if (!invoke) {
    throw new Error("Tauri desktop bridge is not available in this environment.");
  }

  return invoke;
}

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
