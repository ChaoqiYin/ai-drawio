"use client";

import { useEffect } from "react";

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

function getTauriInvoke() {
  const tauriWindow = window as TauriWindow;

  if (typeof tauriWindow.__TAURI_INTERNALS__?.invoke === "function") {
    return tauriWindow.__TAURI_INTERNALS__.invoke;
  }

  if (typeof tauriWindow.__TAURI__?.core?.invoke === "function") {
    return tauriWindow.__TAURI__.core.invoke;
  }

  return null;
}

export default function AppStartupReady() {
  useEffect(() => {
    const invoke = getTauriInvoke();

    if (!invoke) {
      return;
    }

    void invoke("app_ready").catch(() => {
      // Ignore startup reporting failures outside the desktop shell.
    });
  }, []);

  return null;
}
