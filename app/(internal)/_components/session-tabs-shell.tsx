'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Layout, Space, Tabs, Typography } from '@arco-design/web-react';
import { IconClose } from '@arco-design/web-react/icon';

import { getConversationById } from '../_lib/conversation-store';
import { setSessionShellControls } from '../_lib/session-runtime-registry';
import { useWorkspaceSessionStore, type WorkspaceSessionSummary } from '../_lib/workspace-session-store';
import { InternalBreadcrumb } from './internal-breadcrumb';
import { InternalTopNavigation } from './internal-top-navigation';
import SessionWorkspaceHost from './session-workspace-host';

const shellClassName =
  'internal-app-shell mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-3! py-3! md:px-5! md:py-5!';
const { Content } = Layout;
const { Text } = Typography;

function buildSessionSummary(
  sessionId: string,
  title?: string,
  currentSummary?: WorkspaceSessionSummary,
): WorkspaceSessionSummary {
  return {
    id: sessionId,
    isReady: currentSummary?.isReady ?? false,
    title: title ?? currentSummary?.title ?? sessionId,
    updatedAt: currentSummary?.updatedAt ?? new Date(0).toISOString(),
  };
}

export default function SessionTabsShell() {
  const router = useRouter();
  const openedSessions = useWorkspaceSessionStore((state) => state.openedSessions);
  const activeSessionId = useWorkspaceSessionStore((state) => state.activeSessionId);
  const openSession = useWorkspaceSessionStore((state) => state.openSession);
  const activateSession = useWorkspaceSessionStore((state) => state.activateSession);
  const closeSession = useWorkspaceSessionStore((state) => state.closeSession);
  const resetSessionDetail = useWorkspaceSessionStore((state) => state.resetSessionDetail);

  useEffect(() => {
    if (openedSessions.length > 0) {
      return;
    }

    router.push("/");
  }, [openedSessions.length, router]);

  useEffect(() => {
    async function openSessionTab(sessionId: string, title?: string) {
      const currentSummary = openedSessions.find((session) => session.id === sessionId);
      const storedConversation = await getConversationById(sessionId);

      openSession(
        storedConversation
          ? {
              id: storedConversation.id,
              isReady: currentSummary?.isReady ?? false,
              title: storedConversation.title,
              updatedAt: storedConversation.updatedAt,
            }
          : buildSessionSummary(sessionId, title, currentSummary),
      );
    }

    async function ensureSessionTab(sessionId?: string) {
      if (!sessionId) {
        return null;
      }

      await openSessionTab(sessionId);

      return { id: sessionId };
    }

    setSessionShellControls({
      ensureSessionTab,
      openSessionTab,
    });

    return () => {
      setSessionShellControls({});
    };
  }, [openSession, openedSessions]);

  function handleBackToHome(): void {
    resetSessionDetail();
    router.push("/");
  }

  function renderSessionTabTitle(session: WorkspaceSessionSummary): ReactNode {
    return (
      <Space size={6}>
        <Text>{session.title}</Text>
        <Button
          aria-label={`关闭 ${session.title}`}
          icon={<IconClose />}
          onClick={(event) => {
            event.stopPropagation();
            closeSession(session.id);
          }}
          shape="circle"
          size="mini"
          type="text"
        />
      </Space>
    );
  }

  return (
    <Layout className={shellClassName}>
      <Content className="relative z-[1]">
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <InternalTopNavigation
            onBack={handleBackToHome}
            content={
              <InternalBreadcrumb
                dataLayout="workspace-breadcrumb"
                routes={[
                  { path: '/', breadcrumbName: '首页' },
                  { path: '/session', breadcrumbName: '工作区详情' },
                ]}
              />
            }
          />
          {openedSessions.length > 0 ? (
            <Tabs activeTab={activeSessionId} onChange={activateSession} type="rounded">
              {openedSessions.map((session) => (
                <Tabs.TabPane key={session.id} title={renderSessionTabTitle(session)} />
              ))}
            </Tabs>
          ) : null}
          <div className="relative min-h-0 flex flex-1 flex-col gap-4">
            {openedSessions.map((session) => (
              <SessionWorkspaceHost
                key={session.id}
                hidden={session.id !== activeSessionId}
                sessionId={session.id}
              />
            ))}
          </div>
        </Space>
      </Content>
    </Layout>
  );
}
