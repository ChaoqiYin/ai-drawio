"use client";

import { getVersion } from "@tauri-apps/api/app";
import tauriConfig from "../../../src-tauri/tauri.conf.json";

const FALLBACK_APP_VERSION = tauriConfig.version;

export async function getCurrentAppVersion(): Promise<string> {
  try {
    const runtimeVersion = await getVersion();

    if (typeof runtimeVersion === "string" && runtimeVersion.trim().length > 0) {
      return runtimeVersion.trim();
    }
  } catch {}

  return FALLBACK_APP_VERSION;
}
