"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, Space, Switch, Typography } from "@arco-design/web-react";
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
const { Title } = Typography;

export default function SettingsPage() {
  const router = useRouter();
  const [traySettings, setTraySettings] = useState<TraySettingsState>({
    enabled: false,
    trayVisible: false,
    mainWindowVisible: true,
    closeBehavior: "quit",
  });
  const [isLoadingTray, setIsLoadingTray] = useState(true);
  const [isTogglingTray, setIsTogglingTray] = useState(false);
  const [trayError, setTrayError] = useState("");

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

    const handleWindowFocus = (): void => {
      void loadTrayStatus({ clearError: false });
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        void loadTrayStatus({ clearError: false });
      }
    };

    void loadTrayStatus();
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
        </div>
      </div>
    </div>
  );
}
