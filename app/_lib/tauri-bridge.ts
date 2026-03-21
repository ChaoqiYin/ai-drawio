"use client";

import { invoke as tauriInvoke, isTauri } from "@tauri-apps/api/core";

export type TauriInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

type TauriBridgeWindow = Window &
  typeof globalThis & {
    __AI_DRAWIO_TAURI__?: {
      invoke?: TauriInvoke;
    };
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
    };
  };

function getWindowBridge(): TauriBridgeWindow | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window as TauriBridgeWindow;
}

function resolveTauriInvoke(tauriWindow: TauriBridgeWindow): TauriInvoke | null {
  if (typeof tauriWindow.__AI_DRAWIO_TAURI__?.invoke === "function") {
    return tauriWindow.__AI_DRAWIO_TAURI__.invoke;
  }

  if (isTauri()) {
    return tauriInvoke as TauriInvoke;
  }

  if (typeof tauriWindow.__TAURI_INTERNALS__?.invoke === "function") {
    return tauriWindow.__TAURI_INTERNALS__.invoke;
  }

  if (typeof tauriWindow.__TAURI__?.core?.invoke === "function") {
    return tauriWindow.__TAURI__.core.invoke;
  }

  return null;
}

export function setTauriInvokeBridge(): TauriInvoke | null {
  const tauriWindow = getWindowBridge();

  if (!tauriWindow) {
    return null;
  }

  const invoke = resolveTauriInvoke(tauriWindow);

  if (!invoke) {
    return null;
  }

  tauriWindow.__AI_DRAWIO_TAURI__ = {
    ...(tauriWindow.__AI_DRAWIO_TAURI__ || {}),
    invoke,
  };

  return invoke;
}

export function getTauriInvoke(): TauriInvoke | null {
  const tauriWindow = getWindowBridge();

  if (!tauriWindow) {
    return null;
  }

  return resolveTauriInvoke(tauriWindow);
}

export function getRequiredTauriInvoke(): TauriInvoke {
  const invoke = setTauriInvokeBridge() ?? getTauriInvoke();

  if (!invoke) {
    throw new Error("Tauri desktop bridge is not available in this environment.");
  }

  return invoke;
}
