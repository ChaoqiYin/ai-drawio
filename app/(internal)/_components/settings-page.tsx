"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Descriptions, Space, Switch, Tag, Typography } from "@arco-design/web-react";

import {
  getCliInstallStatusColor,
  getCliInstallStatusLabel,
} from "../_lib/cli-install-status-presentation";
import {
  getCliInstallStatus,
  installCliToPath,
  type CliInstallResult,
  type CliInstallStatus,
} from "../_lib/tauri-cli-install";
import {
  getTraySettings,
  subscribeTrayRuntimeStateChange,
  setTrayEnabled,
  type TraySettingsState,
} from "../_lib/tauri-tray-settings";
import { InternalBreadcrumb, type InternalBreadcrumbRoute } from "./internal-breadcrumb";
import { InternalTopNavigation } from "./internal-top-navigation";

const shellClassName =
  "internal-app-shell mx-auto flex h-screen min-h-0 min-w-0 w-full flex-col overflow-hidden px-3! py-3! md:px-5! md:py-5!";
const pageCardStyle = {
  borderRadius: 8,
  backdropFilter: "blur(18px)",
} as const;
const { Paragraph, Title, Text } = Typography;

export default function SettingsPage() {
  const router = useRouter();
  const [traySettings, setTraySettings] = useState<TraySettingsState>({
    enabled: false,
    trayVisible: false,
    mainWindowVisible: true,
    closeBehavior: "quit",
  });
  const [status, setStatus] = useState<CliInstallStatus>({
    status: "not_installed",
    commandPath: "/usr/local/bin/ai-drawio",
    targetPath: null,
    completionInstalled: false,
  });
  const [isLoadingTray, setIsLoadingTray] = useState(true);
  const [isTogglingTray, setIsTogglingTray] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [trayError, setTrayError] = useState("");
  const [cliError, setCliError] = useState("");
  const [result, setResult] = useState<CliInstallResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTrayStatus(options?: { clearError?: boolean }) {
      setIsLoadingTray(true);

      if (options?.clearError !== false) {
        setTrayError("");
      }

      try {
        const nextTraySettings = await getTraySettings();

        if (!cancelled) {
          setTraySettings(nextTraySettings);
        }
      } catch (nextError) {
        if (!cancelled) {
          setTrayError(nextError instanceof Error ? nextError.message : "读取托盘状态失败。");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTray(false);
        }
      }
    }

    async function loadCliStatus() {
      setCliError("");

      try {
        const nextStatus = await getCliInstallStatus();

        if (!cancelled) {
          setStatus(nextStatus);
        }
      } catch (nextError) {
        if (!cancelled) {
          setStatus((currentStatus) => ({
            ...currentStatus,
            status: "error",
          }));
          setCliError(nextError instanceof Error ? nextError.message : "读取 CLI 安装状态失败。");
        }
      } finally {
        // no-op
      }
    }

    const handleWindowFocus = (): void => {
      void loadTrayStatus({ clearError: false });
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        void loadTrayStatus({ clearError: false });
      }
    };

    void loadTrayStatus();
    void loadCliStatus();
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const unsubscribeTrayRuntimeStateChange = subscribeTrayRuntimeStateChange(() => {
      void loadTrayStatus({ clearError: false });
    });

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribeTrayRuntimeStateChange();
    };
  }, []);

  async function handleTrayEnabledChange(enabled: boolean): Promise<void> {
    setIsTogglingTray(true);
    setTrayError("");

    try {
      const nextTraySettings = await setTrayEnabled(enabled);
      setTraySettings(nextTraySettings);
    } catch (nextError) {
      setTrayError(nextError instanceof Error ? nextError.message : "更新托盘设置失败。");
    } finally {
      setIsTogglingTray(false);
    }
  }

  async function handleInstall(): Promise<void> {
    setIsInstalling(true);
    setCliError("");
    setResult(null);

    try {
      const installResult = await installCliToPath();
      setResult(installResult);
      setStatus((currentStatus) => ({
        ...currentStatus,
        status: installResult.ok ? "installed" : currentStatus.status,
        targetPath: installResult.targetPath,
        commandPath: installResult.commandPath,
        completionInstalled: installResult.completionInstalled,
      }));
    } catch (nextError) {
      setCliError(nextError instanceof Error ? nextError.message : "执行 CLI 安装失败。");
    } finally {
      setIsInstalling(false);
    }
  }

  const handleNavigateBack = (): void => {
    router.push("/");
  };
  const breadcrumbRoutes: InternalBreadcrumbRoute[] = [
    {
      path: "/",
      breadcrumbName: "首页",
    },
    {
      path: "/settings",
      breadcrumbName: "设置",
    },
  ];
  const actionLabel = status.status === "installed" ? "重新安装 ai-drawio 命令" : "安装 ai-drawio 命令";
  const trayRuntimeStatus = traySettings.mainWindowVisible
    ? "当前状态：主界面"
    : traySettings.enabled
      ? "当前状态：托盘中"
      : "当前状态：未启用";

  return (
    <div className={shellClassName}>
      <div className="mb-[14px]! h-auto shrink-0 bg-transparent p-0" data-layout="settings-shell-header">
        <InternalTopNavigation
          onBack={handleNavigateBack}
          content={
            <div className="flex min-w-0 flex-1 items-center gap-4" data-layout="settings-top-nav-body">
              <InternalBreadcrumb dataLayout="settings-breadcrumb" routes={breadcrumbRoutes} />
            </div>
          }
        />
      </div>
      <div
        className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        data-layout="settings-body"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto" data-layout="settings-card-list">
          <Card
            className="internal-panel bg-transparent shrink-0"
            data-layout="settings-tray-card"
            style={pageCardStyle}
            bodyStyle={{ padding: 20 }}
          >
            <Space direction="vertical" size={10} style={{ width: "100%", alignItems: "stretch" }}>
              <div className="flex items-center justify-between gap-4">
                <Title heading={3} style={{ margin: 0 }}>
                  系统托盘
                </Title>
                <Switch
                  checked={traySettings.enabled}
                  disabled={isLoadingTray || isTogglingTray}
                  loading={isTogglingTray}
                  onChange={handleTrayEnabledChange}
                />
              </div>
              <div className="text-[14px] leading-[1.5] text-[var(--color-text-3)]" data-testid="tray-runtime-status">
                {trayRuntimeStatus}
              </div>
              {trayError ? <Alert type="error" content={trayError} showIcon /> : null}
            </Space>
          </Card>
          <Card
            className="internal-panel bg-transparent h-[320px] shrink-0"
            data-layout="settings-cli-card"
            style={pageCardStyle}
            bodyStyle={{ height: "100%", padding: 20 }}
          >
            <Space direction="vertical" size={14} style={{ width: "100%", alignItems: "stretch" }}>
              <Title heading={3} style={{ margin: 0 }}>
                CLI 集成
              </Title>
              <Paragraph style={{ margin: 0 }}>
                将 <Text code>ai-drawio</Text> 接入终端环境，完成后可以在新的终端窗口里直接调用，安装时会请求管理员权限。
              </Paragraph>
              <Descriptions
                column={1}
                data={[
                  {
                    label: "命令入口",
                    value: <Text code>{status.commandPath}</Text>,
                  },
                  {
                    label: "当前状态",
                    value: <Tag color={getCliInstallStatusColor(status.status)}>{getCliInstallStatusLabel(status.status)}</Tag>,
                  },
                  {
                    label: "终端集成",
                    value: (
                      <Tag color={status.targetPath ? "green" : "gray"}>
                        {status.targetPath ? "已连接" : "尚未接入"}
                      </Tag>
                    ),
                  },
                ]}
                layout="inline-horizontal"
              />
              <Space wrap>
                <Button type="primary" loading={isInstalling} onClick={handleInstall}>
                  {actionLabel}
                </Button>
              </Space>
              <Paragraph style={{ margin: 0 }}>
                安装完成后请在新终端执行 <Text code>ai-drawio status</Text>。如果当前终端仍未识别命令，请重新打开终端。
              </Paragraph>
              {result ? (
                <Alert
                  type={result.ok ? "success" : "warning"}
                  content={result.message}
                  showIcon
                />
              ) : null}
              {cliError ? <Alert type="error" content={cliError} showIcon /> : null}
            </Space>
          </Card>
        </div>
      </div>
    </div>
  );
}
