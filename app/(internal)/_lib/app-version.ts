"use client";

import { getVersion } from "@tauri-apps/api/app";
import tauriConfig from "../../../src-tauri/tauri.conf.json";

const FALLBACK_APP_VERSION = tauriConfig.version;

export type AppVersionDetails = {
  version: string;
  source: "tauri-runtime" | "tauri-config";
  error: string | null;
};

export async function getCurrentAppVersionDetails(): Promise<AppVersionDetails> {
  try {
    const runtimeVersion = await getVersion();

    if (typeof runtimeVersion === "string" && runtimeVersion.trim().length > 0) {
      return {
        version: runtimeVersion.trim(),
        source: "tauri-runtime",
        error: null,
      };
    }
  } catch (nextError) {
    return {
      version: FALLBACK_APP_VERSION,
      source: "tauri-config",
      error: nextError instanceof Error ? nextError.message : "unknown-error",
    };
  }

  return {
    version: FALLBACK_APP_VERSION,
    source: "tauri-config",
    error: null,
  };
}

export async function getCurrentAppVersion(): Promise<string> {
  const versionDetails = await getCurrentAppVersionDetails();
  return versionDetails.version;
}
