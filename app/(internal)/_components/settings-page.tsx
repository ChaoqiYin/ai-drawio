"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Descriptions, Layout, Space, Tag, Typography } from "@arco-design/web-react";

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
import { InternalBreadcrumb, type InternalBreadcrumbRoute } from "./internal-breadcrumb";
import { InternalTopNavigation } from "./internal-top-navigation";

const shellClassName =
  "internal-app-shell mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-3! py-3! md:px-5! md:py-5!";
const pageCardStyle = {
  borderRadius: 8,
  backdropFilter: "blur(18px)",
} as const;
const { Header, Content } = Layout;
const { Paragraph, Title, Text } = Typography;

export default function SettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<CliInstallStatus>({
    status: "not_installed",
    commandPath: "/usr/local/bin/ai-drawio",
    targetPath: null,
    completionInstalled: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CliInstallResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      setIsLoading(true);
      setError("");

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
          setError(nextError instanceof Error ? nextError.message : "读取 CLI 安装状态失败。");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleInstall(): Promise<void> {
    setIsInstalling(true);
    setError("");
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
      setError(nextError instanceof Error ? nextError.message : "执行 CLI 安装失败。");
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

  return (
    <Layout className={shellClassName}>
      <Header className="mb-[14px]! h-auto bg-transparent p-0">
        <InternalTopNavigation
          onBack={handleNavigateBack}
          content={
            <div className="flex min-w-0 flex-1 items-center gap-4" data-layout="settings-top-nav-body">
              <InternalBreadcrumb dataLayout="settings-breadcrumb" routes={breadcrumbRoutes} />
            </div>
          }
        />
      </Header>
      <Content className="relative z-[1] flex-1">
        <Card className="internal-panel bg-transparent" style={pageCardStyle}>
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
            {error ? <Alert type="error" content={error} showIcon /> : null}
          </Space>
        </Card>
      </Content>
    </Layout>
  );
}
