'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Layout,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconDelete, IconEdit, IconPlus, IconPoweroff } from '@arco-design/web-react/icon';

import type { ConversationRecord } from '../_lib/conversation-model';
import { buildSessionHref, getConversationPreview, sortConversationsByUpdatedAt } from '../_lib/conversation-model';
import {
  clearAllIndexedDbDatabases,
  createConversation,
  deleteConversation,
  listConversations,
  subscribeConversationChanges,
  updateConversationTitle,
} from '../_lib/conversation-store';
import { consumeHomeRedirectError } from '../_lib/conversation-route-state';

const shellClassName =
  'internal-app-shell mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-3! py-3! md:px-5! md:py-5!';
const accentSurfaceClassName =
  "relative overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(135deg,rgba(96,165,250,0.18)_0%,rgba(14,165,233,0.08)_32%,transparent_64%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.14),transparent_34%)] before:content-['']";
const softSurfaceClassName =
  "relative overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_22%)] before:content-['']";
const overlaySurfaceClassName = `${accentSurfaceClassName} bg-[linear-gradient(180deg,rgba(24,30,46,0.96)_0%,rgba(13,17,26,0.92)_100%)]`;
const pageCardStyle = {
  borderRadius: 24,
  backdropFilter: 'blur(18px)',
} as const;
const listCardStyle = {
  borderRadius: 20,
  cursor: 'pointer',
} as const;
const subtleTextStyle = { color: 'var(--color-text-3)' } as const;
const { Content } = Layout;
const { Paragraph, Text, Title } = Typography;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function ConversationHome() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<ConversationRecord[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [navigationTarget, setNavigationTarget] = useState('');
  const [renameDialogConversationId, setRenameDialogConversationId] = useState('');
  const [renameDraftTitle, setRenameDraftTitle] = useState('');
  const [renameError, setRenameError] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const isCreatingConversation = navigationTarget === '__creating__';
  const isNavigating = Boolean(navigationTarget) || isPending;

  async function loadConversations(options?: { isActive?: () => boolean; keepLoading?: boolean }): Promise<void> {
    const isActive = options?.isActive ?? (() => true);

    if (!options?.keepLoading && isActive()) {
      setIsLoading(true);
    }

    try {
      const conversations = await listConversations();
      if (isActive()) {
        setItems(conversations);
      }
    } catch (nextError) {
      if (isActive()) {
        setError(nextError instanceof Error ? nextError.message : '加载本地会话失败。');
      }
    } finally {
      if (isActive()) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    const redirectError = consumeHomeRedirectError();

    if (redirectError) {
      setError(redirectError);
    }

    async function syncConversations(options?: { keepLoading?: boolean }) {
      await loadConversations({
        ...options,
        isActive: () => !cancelled,
      });
    }

    void syncConversations();
    const unsubscribe = subscribeConversationChanges(() => {
      void syncConversations({ keepLoading: true });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  function openConversation(conversationId: string, title: string, options?: { force?: boolean }) {
    if (navigationTarget && !options?.force) {
      return;
    }

    setNavigationTarget(title);
    startTransition(() => {
      router.push(buildSessionHref(conversationId));
    });
  }

  async function handleCreateConversation() {
    if (navigationTarget) {
      return;
    }

    setError('');
    setNavigationTarget('__creating__');

    try {
      const conversation = await createConversation('本地 AI 会话');
      openConversation(conversation.id, conversation.title, { force: true });
    } catch (nextError) {
      setNavigationTarget('');
      setError(nextError instanceof Error ? nextError.message : '创建本地会话失败。');
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    setError('');

    setDeletingId(conversationId);

    try {
      await deleteConversation(conversationId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '删除本地绘画失败。');
    } finally {
      setDeletingId('');
    }
  }

  function openRenameDialog(conversation: ConversationRecord) {
    if (isNavigating) {
      return;
    }

    setError('');
    setRenameError('');
    setRenameDialogConversationId(conversation.id);
    setRenameDraftTitle(conversation.title);
  }

  function closeRenameDialog(options?: { force?: boolean }) {
    if (isRenaming && !options?.force) {
      return;
    }

    setRenameDialogConversationId('');
    setRenameDraftTitle('');
    setRenameError('');
  }

  async function handleRenameConversation() {
    const conversationId = renameDialogConversationId;
    const nextTitle = renameDraftTitle.trim();

    if (!conversationId) {
      return;
    }

    if (!nextTitle) {
      setRenameError('会话名称不能为空。');
      return;
    }

    setError('');
    setRenameError('');
    setIsRenaming(true);

    try {
      const updatedConversation = await updateConversationTitle(conversationId, nextTitle);
      setItems((currentItems) =>
        sortConversationsByUpdatedAt(
          currentItems.map((item) => (item.id === updatedConversation.id ? updatedConversation : item)),
        ),
      );
      closeRenameDialog({ force: true });
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : '重命名本地会话失败。';
      setError(message);
      setRenameError(message);
    } finally {
      setIsRenaming(false);
    }
  }

  async function handleClearAllData() {
    setError('');

    setIsClearingAll(true);

    try {
      await clearAllIndexedDbDatabases();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '清空全部本地数据失败。');
    } finally {
      setIsClearingAll(false);
    }
  }

  return (
    <Layout className={shellClassName}>
      <Content className="relative z-[1]">
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <Card className={`internal-panel ${accentSurfaceClassName}`} style={pageCardStyle}>
            <Space direction="vertical" size={14} style={{ width: '100%', alignItems: 'stretch' }}>
              <Space size={10} align="center" wrap>
                <Tag color="arcoblue">本地 AI 历史记录</Tag>
                <Tag color="green">{isLoading ? '正在加载本地历史' : `共 ${items.length} 条会话`}</Tag>
              </Space>
              <Title heading={3} className="internal-gradient-text" style={{ margin: 0 }}>
                先选择一条已保存的 AI 会话，再进入画布工作区。
              </Title>
              <Paragraph style={{ ...subtleTextStyle, marginBottom: 0 }}>
                当前桌面壳会将 AI 会话历史仅保存在浏览器 IndexedDB 中。你可以选择已有记录，
                或创建一条新的本地会话，然后进入嵌入式 draw.io 工作区继续操作。
              </Paragraph>
              <Space wrap>
                <Button
                  type="primary"
                  icon={<IconPlus />}
                  loading={isCreatingConversation || isPending}
                  disabled={isNavigating || isClearingAll}
                  onClick={handleCreateConversation}
                >
                  {isCreatingConversation || isPending ? '正在打开...' : '创建本地会话'}
                </Button>
                <Popconfirm
                  title="确认清空全部本地数据吗？"
                  content="会删除当前域名下全部 IndexedDB 记录。"
                  okButtonProps={{ status: 'danger', loading: isClearingAll }}
                  okText={isClearingAll ? '正在清空...' : '确认清空'}
                  onOk={handleClearAllData}
                >
                  <Button status="danger" icon={<IconPoweroff />} disabled={isClearingAll || isNavigating}>
                    清空全部本地数据
                  </Button>
                </Popconfirm>
              </Space>
              {error ? <Alert type="error" content={error} showIcon /> : null}
            </Space>
          </Card>

          <Card className={`internal-panel ${softSurfaceClassName}`} style={pageCardStyle}>
            {items.length === 0 && !isLoading ? (
              <Empty description="还没有本地会话，先创建第一条记录，再进入图形工作区。" style={{ paddingBlock: 32 }} />
            ) : (
              <Space direction="vertical" size={14} style={{ display: 'flex' }}>
                {items.map((item) => (
                  <Card
                    className="internal-page-list-card"
                    hoverable={!isNavigating}
                    key={item.id}
                    style={listCardStyle}
                    bodyStyle={{ padding: 18 }}
                    extra={
                      <Space size={8}>
                        <Button
                          size="mini"
                          icon={<IconEdit />}
                          onClick={(event) => {
                            event.stopPropagation();
                            openRenameDialog(item);
                          }}
                          disabled={isClearingAll || isNavigating || deletingId === item.id}
                        >
                          重命名
                        </Button>
                        <Popconfirm
                          title="确认删除这条本地绘画记录吗？"
                          okButtonProps={{
                            status: 'danger',
                            loading: deletingId === item.id,
                          }}
                          okText={deletingId === item.id ? '删除中...' : '确认删除'}
                          onOk={() => handleDeleteConversation(item.id)}
                        >
                          <Button
                            size="mini"
                            status="danger"
                            icon={<IconDelete />}
                            onClick={(event) => event.stopPropagation()}
                            disabled={isClearingAll || isNavigating || deletingId === item.id}
                          >
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    }
                    onClick={() => openConversation(item.id, item.title)}
                  >
                    <Space direction="vertical" size={8} style={{ width: '100%', alignItems: 'stretch' }}>
                      <div className="flex items-center justify-between gap-3">
                        <Title heading={6} style={{ margin: 0 }}>
                          {item.title}
                        </Title>
                        <Text type="secondary">{formatDate(item.updatedAt)}</Text>
                      </div>
                      <Paragraph type="secondary" ellipsis={{ rows: 2, cssEllipsis: true }} style={{ marginBottom: 0 }}>
                        {getConversationPreview(item)}
                      </Paragraph>
                    </Space>
                  </Card>
                ))}
              </Space>
            )}
          </Card>
        </Space>
      </Content>
      {navigationTarget ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(4,8,12,0.52)] px-4 backdrop-blur-sm"
          data-navigation-overlay="true"
        >
          <Card
            className={`internal-panel ${overlaySurfaceClassName}`}
            style={{ ...pageCardStyle, width: 420, maxWidth: '100%' }}
          >
            <Space direction="vertical" size={10} style={{ width: '100%', alignItems: 'stretch' }}>
              <Tag color="arcoblue">会话跳转中</Tag>
              <Title heading={5} className="internal-gradient-text" style={{ margin: 0 }}>
                正在进入画布工作区
              </Title>
              <Paragraph style={{ ...subtleTextStyle, marginBottom: 0 }}>
                {isCreatingConversation ? '正在创建新的本地会话，请稍候。' : `正在打开 ${navigationTarget}，请稍候。`}
              </Paragraph>
            </Space>
          </Card>
        </div>
      ) : null}
      <Modal
        title="重命名会话"
        visible={Boolean(renameDialogConversationId)}
        onOk={handleRenameConversation}
        onCancel={closeRenameDialog}
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
    </Layout>
  );
}
