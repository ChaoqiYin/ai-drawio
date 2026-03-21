"use client";

import { useEffect } from "react";
import { getRequiredTauriInvoke, setTauriInvokeBridge } from "../_lib/tauri-bridge.ts";

export default function AppStartupReady() {
  useEffect(() => {
    try {
      setTauriInvokeBridge();
      const invoke = getRequiredTauriInvoke();

      void invoke("app_ready").catch(() => {
        // Ignore startup reporting failures outside the desktop shell.
      });
    } catch {
      return;
    }
  }, []);

  return null;
}
