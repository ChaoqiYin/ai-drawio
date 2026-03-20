'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Modal, Space, Tabs, Typography } from '@arco-design/web-react';
import { IconClose, IconEdit } from '@arco-design/web-react/icon';

import { getConversationById, updateConversationTitle } from '../_lib/conversation-store';
import { setSessionShellControls } from '../_lib/session-runtime-registry';
import { useWorkspaceSessionStore, type WorkspaceSessionSummary } from '../_lib/workspace-session-store';
import { InternalBreadcrumb } from './internal-breadcrumb';
import { InternalTopNavigation } from './internal-top-navigation';
import SessionWorkspaceHost from './session-workspace-host';

const shellClassName =
  'internal-app-shell mx-auto flex h-screen min-h-0 min-w-0 w-full flex-col overflow-hidden px-3! py-3! md:px-5! md:py-5!';
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
  const updateSessionMeta = useWorkspaceSessionStore((state) => state.updateSessionMeta);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameDraftTitle, setRenameDraftTitle] = useState('');
  const [renameError, setRenameError] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const activeSession = openedSessions.find((session) => session.id === activeSessionId) ?? null;

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

  function openRenameDialog(session: WorkspaceSessionSummary): void {
    setRenameDraftTitle(session.title);
    setRenameError('');
    setRenameDialogOpen(true);
  }

  function closeRenameDialog(options?: { force?: boolean }): void {
    if (isRenaming && !options?.force) {
      return;
    }

    setRenameDialogOpen(false);
    setRenameDraftTitle('');
    setRenameError('');
  }

  async function handleRenameConversation(): Promise<void> {
    if (!activeSession) {
      return;
    }

    const nextTitle = renameDraftTitle.trim();

    if (!nextTitle) {
      setRenameError('会话名称不能为空。');
      return;
    }

    setRenameError('');
    setIsRenaming(true);

    try {
      const updatedConversation = await updateConversationTitle(activeSession.id, nextTitle);
      updateSessionMeta(activeSession.id, {
        title: updatedConversation.title,
        updatedAt: updatedConversation.updatedAt,
      });
      closeRenameDialog({ force: true });
    } catch (nextError) {
      setRenameError(nextError instanceof Error ? nextError.message : '重命名会话失败。');
    } finally {
      setIsRenaming(false);
    }
  }

  function renderSessionTabTitle(session: WorkspaceSessionSummary): ReactNode {
    const isActive = session.id === activeSessionId;

    return (
      <div className="internal-session-tab-title flex min-w-0 items-center gap-2" data-layout="session-tab-title">
        <span
          aria-label={session.isReady ? '状态已就绪' : '状态加载中'}
          className="h-[10px] w-[10px] shrink-0 rounded-full"
          data-layout="session-tab-status-lamp"
          role="status"
          style={{
            backgroundColor: session.isReady ? 'rgb(var(--success-6))' : 'rgb(var(--warning-6))',
            boxShadow: session.isReady
              ? '0 0 0 4px rgba(34, 197, 94, 0.16)'
              : '0 0 0 4px rgba(245, 158, 11, 0.18)',
          }}
        />
        <Text className="session-tab-title-text min-w-0 flex-1 truncate">{session.title}</Text>
        <div
          className="session-tab-actions ml-auto flex items-center gap-1 border-l border-[rgba(148,163,184,0.26)] pl-1.5"
          data-layout="session-tab-actions"
        >
          {isActive ? (
            <Button
              aria-label={`重命名 ${session.title}`}
              data-layout="session-tab-rename"
              icon={<IconEdit />}
              onClick={(event) => {
                event.stopPropagation();
                openRenameDialog(session);
              }}
              shape="circle"
              size="mini"
              type="text"
            />
          ) : null}
          <Button
            aria-label={`关闭 ${session.title}`}
            data-layout="session-tab-close"
            icon={<IconClose />}
            onClick={(event) => {
              event.stopPropagation();
              closeSession(session.id);
            }}
            shape="circle"
            size="mini"
            type="text"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-3" data-layout="session-shell-header">
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
            <div className="min-w-0 overflow-x-auto" data-layout="session-shell-tabs">
              <div className="min-w-max px-1 py-0" data-layout="session-shell-tabs-inner">
                <Tabs activeTab={activeSessionId} className="internal-session-tabs" onChange={activateSession} type="rounded">
                  {openedSessions.map((session) => (
                    <Tabs.TabPane key={session.id} title={renderSessionTabTitle(session)} />
                  ))}
                </Tabs>
              </div>
            </div>
          ) : null}
        </div>
        <div className="relative min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden" data-layout="session-shell-body">
          {openedSessions.map((session) => (
            <SessionWorkspaceHost
              key={session.id}
              hidden={session.id !== activeSessionId}
              sessionId={session.id}
            />
          ))}
        </div>
      </div>
      <Modal
        title="重命名会话"
        visible={renameDialogOpen}
        onOk={() => void handleRenameConversation()}
        onCancel={() => closeRenameDialog()}
        okText={isRenaming ? '保存中...' : '保存'}
        cancelText="取消"
        okButtonProps={{ loading: isRenaming, disabled: !renameDraftTitle.trim() }}
      >
        <Space direction="vertical" size={10} style={{ width: '100%', alignItems: 'stretch' }}>
          <Input
            value={renameDraftTitle}
            placeholder="请输入新的会话名称"
            maxLength={80}
            onChange={(value) => {
              setRenameDraftTitle(value);
              if (renameError) {
                setRenameError('');
              }
            }}
            onPressEnter={() => void handleRenameConversation()}
          />
          {renameError ? <div style={{ color: 'rgb(var(--danger-6))', fontSize: 12 }}>{renameError}</div> : null}
        </Space>
      </Modal>
    </div>
  );
}
