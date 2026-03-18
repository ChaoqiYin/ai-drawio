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

export type CliInstallStatus = {
  status: "not_installed" | "installed" | "installed_other_build" | "mismatched" | "error";
  commandPath: string;
  targetPath: string | null;
  completionInstalled: boolean;
};

export type CliInstallResult = {
  ok: boolean;
  commandInstalled: boolean;
  completionInstalled: boolean;
  commandPath: string;
  targetPath: string | null;
  message: string;
  errorCode: string | null;
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

export async function getCliInstallStatus(): Promise<CliInstallStatus> {
  const invoke = getRequiredTauriInvoke();
  return invoke("get_cli_install_status") as Promise<CliInstallStatus>;
}

export async function installCliToPath(): Promise<CliInstallResult> {
  const invoke = getRequiredTauriInvoke();
  return invoke("install_cli_to_path") as Promise<CliInstallResult>;
}
