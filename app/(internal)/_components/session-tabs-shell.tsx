'use client';

import { useEffect, useState } from 'react';
import { Button, Layout, Space, Tabs, Typography } from '@arco-design/web-react';
import { IconClose } from '@arco-design/web-react/icon';

import ConversationHome from './conversation-home';
import SessionWorkspaceHost from './session-workspace-host';
import { setSessionShellControls } from '../_lib/session-runtime-registry';

const shellClassName =
  'internal-app-shell mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-3! py-3! md:px-5! md:py-5!';
const { Content } = Layout;
const { Text } = Typography;

export default function SessionTabsShell({
  initialSessionId = '',
}: {
  initialSessionId?: string;
}) {
  const [openedSessionIds, setOpenedSessionIds] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [sessionTitles, setSessionTitles] = useState<Record<string, string>>({});

  function openSessionTab(sessionId: string, title: string) {
    setOpenedSessionIds((current) => (current.includes(sessionId) ? current : [...current, sessionId]));
    setSessionTitles((current) => ({
      ...current,
      [sessionId]: title,
    }));
    setActiveSessionId(sessionId);
  }

  function closeSessionTab(sessionId: string) {
    setOpenedSessionIds((current) => {
      const next = current.filter((currentSessionId) => currentSessionId !== sessionId);

      if (activeSessionId === sessionId) {
        setActiveSessionId(next.at(-1) ?? '');
      }

      return next;
    });
  }

  async function ensureSessionTab(sessionId?: string) {
    if (!sessionId) {
      return null;
    }

    openSessionTab(sessionId, sessionTitles[sessionId] || sessionId);

    return { id: sessionId };
  }

  useEffect(() => {
    setSessionShellControls({
      ensureSessionTab,
      openSessionTab,
    });

    return () => {
      setSessionShellControls({});
    };
  }, [sessionTitles]);

  useEffect(() => {
    if (!initialSessionId) {
      return;
    }

    setOpenedSessionIds((current) =>
      current.includes(initialSessionId) ? current : [...current, initialSessionId],
    );
    setSessionTitles((current) => ({
      ...current,
      [initialSessionId]: current[initialSessionId] || initialSessionId,
    }));
    setActiveSessionId(initialSessionId);
  }, [initialSessionId]);

  return (
    <Layout className={shellClassName}>
      <Content className="relative z-[1]">
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <ConversationHome onOpenSessionTab={openSessionTab} />
          {openedSessionIds.length > 0 ? (
            <Tabs activeTab={activeSessionId} onChange={setActiveSessionId} type="rounded">
              {openedSessionIds.map((sessionId) => (
                <Tabs.TabPane
                  key={sessionId}
                  title={
                    <Space size={6}>
                      <Text>{sessionTitles[sessionId] || sessionId}</Text>
                      <Button
                        aria-label={`关闭 ${sessionTitles[sessionId] || sessionId}`}
                        icon={<IconClose />}
                        onClick={(event) => {
                          event.stopPropagation();
                          closeSessionTab(sessionId);
                        }}
                        shape="circle"
                        size="mini"
                        type="text"
                      />
                    </Space>
                  }
                />
              ))}
            </Tabs>
          ) : null}
          <div className="relative min-h-0 flex flex-1 flex-col gap-4">
            {openedSessionIds.map((sessionId) => (
              <SessionWorkspaceHost
                key={sessionId}
                hidden={sessionId !== activeSessionId}
                sessionId={sessionId}
              />
            ))}
          </div>
        </Space>
      </Content>
    </Layout>
  );
}
