'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconDelete, IconEdit, IconPlus, IconPoweroff, IconSettings } from '@arco-design/web-react/icon';

import { getConversationPreview, type ConversationSummaryRecord } from '../_lib/conversation-model';
import {
  clearAllAppData,
  createConversation,
  deleteConversation,
  getConversationById,
  listConversationSummaryPage,
  subscribeConversationChanges,
  updateConversationTitle,
} from '../_lib/conversation-store';
import { consumeHomeRedirectError } from '../_lib/conversation-route-state';
import { useWorkspaceSessionStore } from '../_lib/workspace-session-store';

const shellClassName =
  'internal-app-shell mx-auto flex h-screen min-h-screen w-full flex-col overflow-hidden px-3! py-3! md:px-5! md:py-5!';
const accentSurfaceClassName = 'bg-transparent';
const softSurfaceClassName = 'bg-transparent';
const overlaySurfaceClassName = 'bg-white/95';
const pageCardStyle = {
  borderRadius: 8,
  backdropFilter: 'blur(18px)',
} as const;
const listCardStyle = {
  borderRadius: 8,
  cursor: 'pointer',
} as const;
const subtleTextStyle = { color: 'var(--color-text-3)' } as const;
const PAGE_SIZE = 10;
const { Paragraph, Text, Title } = Typography;

type ConversationListItem = ConversationSummaryRecord & {
  preview: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function ConversationHome() {
  const router = useRouter();
  const enterSessionDetail = useWorkspaceSessionStore((state) => state.enterSessionDetail);
  const suppressNavigationUntilRef = useRef(0);
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [navigationTarget, setNavigationTarget] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [renameDialogConversationId, setRenameDialogConversationId] = useState('');
  const [renameDraftTitle, setRenameDraftTitle] = useState('');
  const [renameError, setRenameError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const isCreatingConversation = navigationTarget === '__creating__';
  const isNavigating = Boolean(navigationTarget) || isPending;
  const normalizedSearchQuery = searchQuery.trim();

  function suppressNavigationForDelete(): void {
    suppressNavigationUntilRef.current = Date.now() + 600;
  }

  function shouldSuppressNavigation(): boolean {
    return Date.now() < suppressNavigationUntilRef.current;
  }

  async function loadConversations(options?: { isActive?: () => boolean; keepLoading?: boolean }): Promise<void> {
    const isActive = options?.isActive ?? (() => true);

    if (!options?.keepLoading && isActive()) {
      setIsLoading(true);
    }

    try {
      const summaryPage = await listConversationSummaryPage({
        page: currentPage,
        pageSize: PAGE_SIZE,
        searchQuery: normalizedSearchQuery,
      });
      const conversations = await Promise.all(
        summaryPage.items.map(async (item) => {
          const conversation = await getConversationById(item.id);

          return {
            ...item,
            preview: conversation ? getConversationPreview(conversation) : 'No messages yet.',
          };
        }),
      );

      if (isActive()) {
        setItems(conversations);
        setTotalCount(summaryPage.total);
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
  }, [currentPage, normalizedSearchQuery]);

  function openConversation(conversation: ConversationListItem, options?: { force?: boolean }) {
    if (shouldSuppressNavigation()) {
      return;
    }

    if (navigationTarget && !options?.force) {
      return;
    }

    setNavigationTarget(conversation.title);
    startTransition(() => {
      enterSessionDetail({
        id: conversation.id,
        isReady: false,
        title: conversation.title,
        updatedAt: conversation.updatedAt,
      });
      router.push("/session");
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
      openConversation(conversation, { force: true });
    } catch (nextError) {
      setNavigationTarget('');
      setError(nextError instanceof Error ? nextError.message : '创建本地会话失败。');
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    setError('');
    suppressNavigationForDelete();

    setDeletingId(conversationId);

    try {
      await deleteConversation(conversationId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '删除本地绘画失败。');
    } finally {
      setDeletingId('');
    }
  }

  function openRenameDialog(conversation: ConversationListItem) {
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
      await updateConversationTitle(conversationId, nextTitle);
      await loadConversations({ keepLoading: true });
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
      await clearAllAppData();
      setCurrentPage(1);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '清空全部本地数据失败。');
    } finally {
      setIsClearingAll(false);
    }
  }

  function openSettings(): void {
    if (isNavigating) {
      return;
    }

    router.push("/settings");
  }

  return (
    <div className={shellClassName}>
      <div className="fixed right-6 bottom-[16vh] z-[12]" data-layout="home-settings-fab">
        <Button
          disabled={isNavigating || isClearingAll}
          icon={<IconSettings style={{ display: 'block', fontSize: 20 }} />}
          aria-label="打开设置"
          onClick={openSettings}
          shape="circle"
          type="primary"
          className="flex! h-10! w-10! items-center! justify-center! rounded-full border-0 bg-[rgb(15,23,42)]! p-0! shadow-[0_14px_28px_rgba(15,23,42,0.22)]"
        ></Button>
      </div>
      <div className="relative z-[1] flex flex-1 min-h-0 gap-4" data-layout="home-main-columns">
        <Card
          className={`internal-panel ${accentSurfaceClassName} w-[340px] shrink-0`}
          style={pageCardStyle}
          bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 18 }}
          data-layout="home-left-panel"
        >
          <div className="flex h-full flex-col gap-4">
            <Space size={10} align="center" wrap>
              <Tag color="green">{isLoading ? '正在加载本地历史' : `共 ${totalCount} 条会话`}</Tag>
            </Space>
            <Title heading={3} style={{ margin: 0 }}>
              选择历史会话开启工作区
            </Title>
            <Space direction="vertical" size={10} style={{ width: '100%', alignItems: 'stretch' }}>
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
          </div>
        </Card>

        <Card
          className={`internal-panel ${softSurfaceClassName} flex-1 min-w-0 min-h-0`}
          style={pageCardStyle}
          bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: 18 }}
          data-layout="home-right-panel"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex flex-col gap-3" data-layout="home-list-controls">
              <Input
                allowClear
                value={searchQuery}
                placeholder="按标题搜索会话"
                disabled={isNavigating || isClearingAll}
                onChange={(value) => {
                  setSearchQuery(value);
                  setCurrentPage(1);
                }}
              />
              <div data-layout="home-list-pagination">
                {totalCount > PAGE_SIZE ? (
                  <Pagination
                    current={currentPage}
                    pageSize={PAGE_SIZE}
                    total={totalCount}
                    size="small"
                    showTotal
                    onChange={(page) => setCurrentPage(page)}
                  />
                ) : null}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pt-3" data-layout="home-list-viewport">
              {items.length === 0 && !isLoading ? (
                <Empty description="还没有本地会话，先创建第一条记录，再进入图形工作区。" style={{ paddingBlock: 32 }} />
              ) : (
                <div className="flex flex-col gap-3">
                  {items.map((item) => (
                    <Card
                      className="internal-page-list-card"
                      hoverable={!isNavigating}
                      key={item.id}
                      style={listCardStyle}
                      bodyStyle={{ padding: 18 }}
                      title={
                        <Title heading={6} style={{ margin: 0 }}>
                          {item.title}
                        </Title>
                      }
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
                            onOk={() => {
                              suppressNavigationForDelete();
                              return handleDeleteConversation(item.id);
                            }}
                          >
                            <Button
                              size="mini"
                              status="danger"
                              icon={<IconDelete />}
                              onClick={(event) => {
                                event.stopPropagation();
                                suppressNavigationForDelete();
                              }}
                              disabled={isClearingAll || isNavigating || deletingId === item.id}
                            >
                              删除
                            </Button>
                          </Popconfirm>
                        </Space>
                      }
                      onClick={() => openConversation(item)}
                    >
                      <Space direction="vertical" size={8} style={{ width: '100%', alignItems: 'stretch' }}>
                        <Text style={{ color: 'var(--color-text-4)', fontSize: 12, fontWeight: 400 }}>
                          {formatDate(item.updatedAt)}
                        </Text>
                        <Paragraph type="secondary" ellipsis={{ rows: 2, cssEllipsis: true }} style={{ marginBottom: 0 }}>
                          {item.preview}
                        </Paragraph>
                      </Space>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
      {navigationTarget ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(255,255,255,0.68)] px-4 backdrop-blur-sm"
          data-navigation-overlay="true"
        >
          <Card
            className={`internal-panel ${overlaySurfaceClassName}`}
            style={{ ...pageCardStyle, width: 420, maxWidth: '100%' }}
          >
            <Space direction="vertical" size={10} style={{ width: '100%', alignItems: 'stretch' }}>
              <Tag color="arcoblue">会话跳转中</Tag>
              <Title heading={5} style={{ margin: 0 }}>
                正在进入画布工作区
              </Title>
              <Paragraph style={{ ...subtleTextStyle, marginBottom: 0 }}>
                {isCreatingConversation ? '正在创建新的本地会话，请稍候。' : `正在准备 ${navigationTarget} 的工作区，请稍候。`}
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
    </div>
  );
}
