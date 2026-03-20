"use client";

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

export function getTauriInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") {
    return null;
  }

  const tauriWindow = window as TauriWindow;

  if (typeof tauriWindow.__TAURI_INTERNALS__?.invoke === "function") {
    return tauriWindow.__TAURI_INTERNALS__.invoke;
  }

  if (typeof tauriWindow.__TAURI__?.core?.invoke === "function") {
    return tauriWindow.__TAURI__.core.invoke;
  }

  return null;
}

export function hasTauriInvoke(): boolean {
  return typeof getTauriInvoke() === "function";
}

export function getRequiredTauriInvoke(): TauriInvoke {
  const invoke = getTauriInvoke();

  if (!invoke) {
    throw new Error("Tauri desktop bridge is not available in this environment.");
  }

  return invoke;
}
