'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Layout,
  Modal,
  Space,
  Tabs,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconEdit } from '@arco-design/web-react/icon';

import {
  buildBrowserFileTitle,
  buildConversationTimeline,
  type CanvasHistoryEntry,
  type CanvasHistorySource,
  type ConversationMessage,
  type ConversationRecord,
} from '../_lib/conversation-model';
import { buildCanvasHistoryLabel } from '../_lib/canvas-history-label';
import { normalizeCanvasHistoryPreviewPages, type CanvasHistoryPreviewPage } from '../_lib/canvas-history-preview';
import {
  appendCanvasHistoryEntry,
  appendConversationMessage,
  getConversationById,
  subscribeConversationChanges,
  touchConversationUpdatedAt,
  updateConversationTitle,
} from '../_lib/conversation-store';
import { saveHomeRedirectError } from '../_lib/conversation-route-state';
import { InternalBreadcrumb, type InternalBreadcrumbRoute } from './internal-breadcrumb';
import { InternalTopNavigation } from './internal-top-navigation';

const DRAWIO_EMBED_PATH = '/drawio/index.html?embed=1&proto=json&spin=1&noSaveBtn=1&noExitBtn=1&saveAndExit=0';

const FALLBACK_EMPTY_DIAGRAM_XML =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

const shellClassName = 'internal-app-shell h-screen overflow-hidden';
const pageShellClassName = 'flex flex-col h-full min-h-full p-[18px] lg:p-[22px]';
const shellBodyClassName = 'min-h-0 flex flex-1 gap-4 bg-transparent!';
const sidebarClassName = 'h-full overflow-hidden bg-transparent!';
const workspaceClassName = 'min-h-0 flex min-w-0 flex-1 flex-col gap-4 lg:gap-[18px] bg-transparent!';
const toolbarSurfaceClassName = 'bg-transparent';
const sidebarSurfaceClassName = 'bg-transparent';
const workspaceCanvasClassName =
  'relative min-h-0 flex flex-1 overflow-hidden rounded-[8px] border border-[rgba(148,163,184,0.2)] bg-white/95 shadow-[0_20px_52px_rgba(15,23,42,0.08)]';
const toolbarCardStyle = {
  borderRadius: 8,
  backdropFilter: 'blur(18px)',
} as const;
const { Header, Content, Sider } = Layout;
const { Paragraph, Text } = Typography;

type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (value: unknown) => void;
};

type BridgeState = {
  bootstrapFrame: (() => Promise<void>) | null;
  bootstrapError: string;
  bootstrapStarted: boolean;
  bootstrappingBrowserFile: boolean;
  browserFileReady: boolean;
  browserFileTitle: string;
  documentLoaded: boolean;
  lastDocumentXml: string;
  lastEvent: string;
  nextCallbackId: number;
  pending: Map<string, PendingRequest>;
  remoteReady: boolean;
};

type FrameMessage = {
  error?: { errResp?: string };
  event?: string;
  msgMarkers?: { callbackId?: string };
  resp?: unknown;
  xml?: string;
};

type EditorUiInstance = {
  emptyDiagramXml?: string;
  currentPage?: { getId?: () => string };
  editor?: { modified?: unknown };
  fileLoaded?: (file: unknown) => void;
  getCurrentFile?: () => { getTitle?: () => string } | null;
  getFileData: (includeAllPages: boolean) => string;
  setFileData: (xml: string) => void;
};

type EditorUiPrototype = {
  aiDrawioApplyDocument?: (this: EditorUiInstance, xml: string) => string;
  aiDrawioBuildSvgPreviewPages?: (this: EditorUiInstance, xml: string) => { pages: CanvasHistoryPreviewPage[] };
  aiDrawioEnsureBrowserFile?: (
    this: EditorUiInstance,
    title: string,
    initialXml: string,
    success: (result: { mode: 'browser'; status: 'created' | 'opened' | 'ready'; title: string }) => void,
    failure: (message?: string) => void,
  ) => void;
  aiDrawioGetDocument?: (this: EditorUiInstance) => string;
  aiDrawioGetState?: (this: EditorUiInstance) => {
    currentFileTitle: string | null;
    currentPageId: string | null;
    isModified: boolean;
  };
  emptyDiagramXml?: string;
  remoteInvokableFns?: Record<string, { isAsync: boolean }>;
};

type DrawioStorageFile = {
  getTitle: () => string;
};

type DrawioStorageFileConstructor = {
  new (ui: EditorUiInstance, data: string, title: string): DrawioStorageFile;
  getFileContent: (
    ui: EditorUiInstance,
    title: string,
    success: (data: string | null | undefined) => void,
    failure: (error?: unknown) => void,
  ) => void;
  insertFile: (
    ui: EditorUiInstance,
    title: string,
    data: string,
    success: (file: DrawioStorageFile) => void,
    failure: (error?: unknown) => void,
  ) => void;
};

type DrawioFrameWindow = Window &
  typeof globalThis & {
    EditorUi?: {
      prototype?: EditorUiPrototype;
    };
    StorageFile?: DrawioStorageFileConstructor;
  };

type ShellWindow = Window &
  typeof globalThis & {
    __AI_DRAWIO_SHELL__?: {
      conversationStore?: {
        createConversation?: () => Promise<{
          createdAt: string;
          href: string;
          id: string;
          title: string;
          updatedAt: string;
        }>;
      };
      documentBridge?: {
        applyDocument: ({
          historyLabel,
          historySource,
          prompt,
          relatedMessageId,
          xml,
        }: {
          historyLabel?: string;
          historySource?: CanvasHistorySource;
          prompt?: string;
          relatedMessageId?: string | null;
          xml: string;
        }) => Promise<{
          appliedAt: string;
          xml: string;
        }>;
        applyDocumentWithoutHistory: (xml: string) => Promise<{
          appliedAt: string;
          xml: string;
        }>;
        exportSvgPages: () => Promise<{
          exportedAt: string;
          pages: Array<{
            id: string;
            name: string;
            svg: string;
          }>;
        }>;
        getDocument: () => Promise<{ readAt: string; xml: string }>;
      };
      getFrameWindow?: () => Window;
      getState?: () => {
        bootstrapError: string | null;
        bridgeReady: boolean;
        browserFileReady: boolean;
        browserFileTitle: string;
        conversationLoaded: boolean;
        documentLoaded: boolean;
        frameReady: boolean;
        lastEvent: string;
        route: string;
        sessionId: string;
      };
    };
  };

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function decodeSvgDataUri(svgDataUri: string): string {
  const [header, encoded = ''] = svgDataUri.split(',', 2);

  if (!header.startsWith('data:image/svg+xml')) {
    throw new Error('invalid svg data uri');
  }

  if (header.includes(';base64')) {
    const binary = window.atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  return decodeURIComponent(encoded);
}

function parseFrameMessage(input: unknown): FrameMessage | null {
  if (!input) {
    return null;
  }

  if (typeof input === 'string') {
    try {
      return JSON.parse(input) as FrameMessage;
    } catch {
      return null;
    }
  }

  if (typeof input === 'object') {
    return input as FrameMessage;
  }

  return null;
}

function getEmptyDiagramXml(frameWindow: DrawioFrameWindow | null | undefined): string {
  return frameWindow?.EditorUi?.prototype?.emptyDiagramXml || FALLBACK_EMPTY_DIAGRAM_XML;
}

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return fallbackMessage;
}

function buildCanvasHistoryDescription(entry: CanvasHistoryEntry): string {
  if (entry.source === 'restore-pre-apply') {
    return '恢复前快照';
  }

  return '快照';
}

function findUserPromptForCanvasHistory(entry: CanvasHistoryEntry, messages: ConversationMessage[]): string {
  const orderedMessages = [...messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const findNearestUserMessage = (startIndex: number): string => {
    for (let index = startIndex; index >= 0; index -= 1) {
      const message = orderedMessages[index];

      if (message.role !== 'user') {
        continue;
      }

      const content = message.content.trim();

      if (content) {
        return content;
      }
    }

    return '';
  };

  if (entry.relatedMessageId) {
    const relatedIndex = orderedMessages.findIndex((message) => message.id === entry.relatedMessageId);

    if (relatedIndex >= 0) {
      const relatedContent = findNearestUserMessage(relatedIndex);

      if (relatedContent) {
        return relatedContent;
      }
    }
  }

  const entryAnchorIndex = orderedMessages.findIndex((message) => message.createdAt > entry.createdAt);
  const fallbackStartIndex = entryAnchorIndex >= 0 ? entryAnchorIndex - 1 : orderedMessages.length - 1;
  const fallbackContent = findNearestUserMessage(fallbackStartIndex);

  if (fallbackContent) {
    return fallbackContent;
  }

  return entry.label.trim() || buildCanvasHistoryDescription(entry);
}

function buildTimelineEntryHeading(entry: ReturnType<typeof buildConversationTimeline>[number]): string {
  if (entry.entryType === 'message') {
    return entry.role;
  }

  return entry.source === 'restore-pre-apply' ? '恢复快照' : 'assistant';
}

function buildTimelineEntryBody(
  entry: ReturnType<typeof buildConversationTimeline>[number],
  messages: ConversationMessage[],
): string {
  if (entry.entryType === 'message') {
    return entry.content;
  }

  if (entry.source !== 'restore-pre-apply') {
    return findUserPromptForCanvasHistory(entry, messages);
  }

  const baseLabel = entry.label.trim() || buildCanvasHistoryDescription(entry);
  return `恢复前快照：${baseLabel}`;
}

function findCanvasHistoryEntryForMessage(
  message: ConversationMessage,
  canvasHistory: CanvasHistoryEntry[],
): CanvasHistoryEntry | null {
  return canvasHistory.find((entry) => entry.relatedMessageId === message.id) || null;
}

function installDocumentRemoteInvokes(frameWindow: DrawioFrameWindow | null | undefined): void {
  const editorUiPrototype = frameWindow?.EditorUi?.prototype;
  const storageFile = frameWindow?.StorageFile;

  if (!editorUiPrototype) {
    throw new Error('draw.io EditorUi prototype is not available');
  }

  if (!storageFile) {
    throw new Error('draw.io StorageFile is not available');
  }

  editorUiPrototype.remoteInvokableFns = {
    ...(editorUiPrototype.remoteInvokableFns || {}),
    aiDrawioApplyDocument: { isAsync: false },
    aiDrawioBuildSvgPreviewPages: { isAsync: false },
    aiDrawioEnsureBrowserFile: { isAsync: true },
    aiDrawioGetDocument: { isAsync: false },
    aiDrawioGetState: { isAsync: false },
  };

  editorUiPrototype.aiDrawioGetDocument =
    editorUiPrototype.aiDrawioGetDocument ||
    function aiDrawioGetDocument() {
      return this.getFileData(true);
    };

  editorUiPrototype.aiDrawioApplyDocument =
    editorUiPrototype.aiDrawioApplyDocument ||
    function aiDrawioApplyDocument(xml) {
      if (typeof xml !== 'string' || xml.trim().length === 0) {
        throw new Error('xml cannot be empty');
      }

      this.setFileData(xml);
      return this.getFileData(true);
    };

  editorUiPrototype.aiDrawioBuildSvgPreviewPages =
    editorUiPrototype.aiDrawioBuildSvgPreviewPages ||
    function aiDrawioBuildSvgPreviewPages(xml) {
      if (typeof xml !== 'string' || xml.trim().length === 0) {
        throw new Error('preview xml cannot be empty');
      }

      const ui = this as EditorUiInstance & {
        getImageForPage?: (page: unknown, currentPage: unknown, graph?: unknown, noCrop?: boolean) => { src?: string };
        getPagesForXml?: (xml: string) => Array<{
          getId?: () => string;
          getName?: () => string;
        }>;
      };

      if (typeof ui.getPagesForXml !== 'function' || typeof ui.getImageForPage !== 'function') {
        throw new Error('draw.io preview APIs are not available');
      }

      const pages = ui.getPagesForXml(xml);

      if (!Array.isArray(pages) || pages.length === 0) {
        throw new Error('draw.io preview did not return any pages');
      }

      return {
        pages: pages.map((page, index) => {
          const previewImage = ui.getImageForPage?.(page, page, null, true);
          const svgDataUri = typeof previewImage?.src === 'string' ? previewImage.src.trim() : '';
          const pageId = typeof page?.getId === 'function' ? page.getId()?.trim() || '' : '';
          const pageName = typeof page?.getName === 'function' ? page.getName()?.trim() || '' : '';

          if (!svgDataUri.startsWith('data:image/svg+xml')) {
            throw new Error('draw.io preview did not return an SVG image');
          }

          return {
            id: pageId || `page-${index + 1}`,
            name: pageName || `Page ${index + 1}`,
            svgDataUri,
          };
        }),
      };
    };

  editorUiPrototype.aiDrawioEnsureBrowserFile =
    editorUiPrototype.aiDrawioEnsureBrowserFile ||
    function aiDrawioEnsureBrowserFile(title, initialXml, success, failure) {
      const normalizedTitle =
        typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'local-session.drawio';
      const nextXml =
        typeof initialXml === 'string' && initialXml.trim().length > 0
          ? initialXml
          : this.emptyDiagramXml || FALLBACK_EMPTY_DIAGRAM_XML;
      const finish = (status: 'created' | 'opened' | 'ready') =>
        success({
          mode: 'browser',
          status,
          title: normalizedTitle,
        });
      const fail = (error?: unknown) => {
        failure(toErrorMessage(error, 'draw.io browser storage bootstrap failed'));
      };
      const currentFileTitle = this.getCurrentFile?.()?.getTitle?.();

      if (!this.fileLoaded) {
        fail('draw.io fileLoaded hook is not available');
        return;
      }

      if (currentFileTitle === normalizedTitle) {
        finish('ready');
        return;
      }

      storageFile.getFileContent(
        this,
        normalizedTitle,
        (storedXml) => {
          try {
            if (typeof storedXml === 'string' && storedXml.trim().length > 0) {
              this.fileLoaded?.(new storageFile(this, storedXml, normalizedTitle));
              finish('opened');
              return;
            }

            storageFile.insertFile(
              this,
              normalizedTitle,
              nextXml,
              (file) => {
                try {
                  this.fileLoaded?.(file);
                  finish('created');
                } catch (callbackError) {
                  fail(callbackError);
                }
              },
              fail,
            );
          } catch (callbackError) {
            fail(callbackError);
          }
        },
        fail,
      );
    };

  editorUiPrototype.aiDrawioGetState =
    editorUiPrototype.aiDrawioGetState ||
    function aiDrawioGetState() {
      return {
        currentFileTitle: this.getCurrentFile?.()?.getTitle?.() || null,
        currentPageId: this.currentPage?.getId?.() || null,
        isModified: Boolean(this.editor?.modified),
      };
    };
}

export default function SessionWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeRef = useRef<BridgeState>({
    bootstrapFrame: null,
    bootstrapError: '',
    bootstrapStarted: false,
    bootstrappingBrowserFile: false,
    browserFileReady: false,
    browserFileTitle: '',
    documentLoaded: false,
    lastDocumentXml: '',
    lastEvent: 'idle',
    nextCallbackId: 1,
    pending: new Map(),
    remoteReady: false,
  });
  const conversationRef = useRef<ConversationRecord | null>(null);
  const autosaveSyncRef = useRef(Promise.resolve<void>(undefined));
  const frameReadyRef = useRef(false);
  const sessionIdRef = useRef('');
  const [conversation, setConversation] = useState<ConversationRecord | null>(null);
  const [error, setError] = useState('');
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [renameDraftTitle, setRenameDraftTitle] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [restorePreviewActivePageId, setRestorePreviewActivePageId] = useState('');
  const [restorePreviewDialogOpen, setRestorePreviewDialogOpen] = useState(false);
  const [restorePreviewEntry, setRestorePreviewEntry] = useState<CanvasHistoryEntry | null>(null);
  const [restorePreviewError, setRestorePreviewError] = useState('');
  const [restorePreviewPages, setRestorePreviewPages] = useState<CanvasHistoryPreviewPage[]>([]);
  const [restoringHistoryId, setRestoringHistoryId] = useState('');
  const [isRouteRedirecting, setIsRouteRedirecting] = useState(false);

  const sessionId = searchParams.get('id');
  const breadcrumbRoutes = [
    { path: '/', breadcrumbName: '首页' },
    { path: sessionId || '', breadcrumbName: '工作区详情' },
  ] satisfies InternalBreadcrumbRoute[];

  conversationRef.current = conversation;
  frameReadyRef.current = isFrameReady;
  sessionIdRef.current = sessionId || '';

  function resetEmbeddedDocumentState(): void {
    const bridge = bridgeRef.current;
    bridge.bootstrapStarted = false;
    bridge.bootstrapError = '';
    bridge.bootstrappingBrowserFile = false;
    bridge.browserFileReady = false;
    bridge.browserFileTitle = '';
    bridge.documentLoaded = false;
    bridge.lastDocumentXml = '';
    bridge.lastEvent = 'session-change';
    bridge.remoteReady = false;
    setIsFrameReady(false);
  }

  async function reloadConversationState(targetSessionId = sessionIdRef.current): Promise<ConversationRecord | null> {
    const nextSessionId = targetSessionId.trim();

    if (!nextSessionId) {
      return null;
    }

    try {
      const nextConversation = await getConversationById(nextSessionId);

      if (!nextConversation) {
        return null;
      }

      setConversation(nextConversation);
      return nextConversation;
    } catch (reloadError) {
      setError(toErrorMessage(reloadError, '刷新本地会话失败。'));
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;

    function redirectHome(message: string, options?: { persistError?: boolean }): void {
      if (cancelled) {
        return;
      }

      setConversation(null);
      setError(message);
      setIsRouteRedirecting(true);
      if (options?.persistError !== false) {
        saveHomeRedirectError(message);
      }
      router.replace('/');
    }

    async function loadConversation() {
      if (!sessionId) {
        redirectHome('缺少会话编号，已返回首页。');
        return;
      }

      try {
        const nextConversation = await getConversationById(sessionId);
        if (!cancelled) {
          if (!nextConversation) {
            redirectHome('未找到对应的本地会话，已返回首页。');
            return;
          }

          setConversation(nextConversation);
          setError('');
          setIsRouteRedirecting(false);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : '加载所选会话失败。');
        }
      }
    }

    loadConversation();
    const unsubscribe = subscribeConversationChanges((detail) => {
      if (cancelled || detail.type !== 'deleted' || detail.conversationId !== sessionId) {
        return;
      }

      redirectHome('', { persistError: false });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router, sessionId]);

  useEffect(() => {
    resetEmbeddedDocumentState();
  }, [sessionId]);

  function openRenameDialog(): void {
    if (!conversation) {
      return;
    }

    setRenameDraftTitle(conversation.title);
    setRenameError('');
    setRenameDialogOpen(true);
  }

  const handleNavigateBack = (): void => {
    router.push('/');
  };

  function closeRenameDialog(options?: { force?: boolean }): void {
    if (isRenaming && !options?.force) {
      return;
    }

    setRenameDialogOpen(false);
    setRenameDraftTitle('');
    setRenameError('');
  }

  function closeRestorePreview(options?: { force?: boolean }): void {
    if (restoringHistoryId && !options?.force) {
      return;
    }

    setRestorePreviewDialogOpen(false);
    setRestorePreviewEntry(null);
    setRestorePreviewError('');
    setRestorePreviewPages([]);
    setRestorePreviewActivePageId('');
  }

  async function handleRenameConversation(): Promise<void> {
    if (!conversation) {
      return;
    }

    const nextTitle = renameDraftTitle.trim();

    if (!nextTitle) {
      setRenameError('会话名称不能为空。');
      return;
    }

    setRenameError('');
    setError('');
    setIsRenaming(true);

    try {
      const updatedConversation = await updateConversationTitle(conversation.id, nextTitle);
      setConversation(updatedConversation);
      closeRenameDialog({ force: true });
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : '重命名会话失败。';
      setError(message);
      setRenameError(message);
    } finally {
      setIsRenaming(false);
    }
  }

  async function openRestorePreview(entry: CanvasHistoryEntry): Promise<void> {
    if (restoringHistoryId || !entry.xml.trim()) {
      return;
    }

    setError('');
    setRestorePreviewEntry(entry);
    setRestorePreviewDialogOpen(true);
    setRestorePreviewPages(entry.previewPages);
    setRestorePreviewActivePageId(entry.previewPages[0]?.id || '');
    setRestorePreviewError(entry.previewPages.length > 0 ? '' : '暂无缓存预览，暂时无法确认恢复。');
  }

  async function handleRestoreCanvasHistory(entry: CanvasHistoryEntry): Promise<boolean> {
    if (restoringHistoryId || !entry.xml.trim()) {
      return false;
    }

    const documentBridge = (window as ShellWindow).__AI_DRAWIO_SHELL__?.documentBridge;

    if (!documentBridge) {
      setError('draw.io 文档桥未就绪，暂时无法恢复历史版本。');
      return false;
    }

    setError('');
    setRestoringHistoryId(entry.id);

    try {
      await documentBridge.applyDocumentWithoutHistory(entry.xml);
      await reloadConversationState();
      return true;
    } catch (restoreError) {
      setError(toErrorMessage(restoreError, '恢复画布历史失败。'));
      return false;
    } finally {
      setRestoringHistoryId('');
    }
  }

  async function confirmRestorePreview(): Promise<void> {
    if (!restorePreviewEntry) {
      return;
    }

    const restored = await handleRestoreCanvasHistory(restorePreviewEntry);

    if (restored) {
      closeRestorePreview({ force: true });
    }
  }

  useEffect(() => {
    const bridge = bridgeRef.current;

    function rejectPendingRequests(message: string): void {
      for (const pending of bridge.pending.values()) {
        pending.reject(new Error(message));
      }

      bridge.pending.clear();
    }

    function getFrameWindow(): Window {
      if (!iframeRef.current?.contentWindow) {
        throw new Error('draw.io iframe window is not available');
      }

      return iframeRef.current.contentWindow;
    }

    function postFrameMessage(message: Record<string, unknown>): void {
      getFrameWindow().postMessage(JSON.stringify(message), '*');
    }

    function ensureBridgeReady({ requireDocumentLoaded = true } = {}): void {
      if (bridge.bootstrapError) {
        throw new Error(bridge.bootstrapError);
      }

      if (!bridge.remoteReady) {
        throw new Error('draw.io document bridge is not ready');
      }

      if (requireDocumentLoaded && !bridge.documentLoaded) {
        throw new Error('draw.io document is not ready');
      }
    }

    function callRemoteInvoke(
      functionName: string,
      functionArgs: unknown[] = [],
      options?: { requireDocumentLoaded?: boolean },
    ): Promise<unknown> {
      ensureBridgeReady(options);

      const callbackId = String(bridge.nextCallbackId++);

      return new Promise((resolve, reject) => {
        bridge.pending.set(callbackId, { reject, resolve });

        try {
          postFrameMessage({
            action: 'remoteInvoke',
            functionArgs,
            funtionName: functionName,
            msgMarkers: { callbackId },
          });
        } catch (callError) {
          bridge.pending.delete(callbackId);
          reject(callError);
        }
      });
    }

    function updateShellError(nextError: string): void {
      bridge.bootstrapError = nextError;
      setError((currentError) => currentError || nextError);
    }

    function syncConversationUpdatedAt(): void {
      const conversationId = sessionIdRef.current.trim();

      if (!conversationId) {
        return;
      }

      autosaveSyncRef.current = autosaveSyncRef.current
        .catch(() => undefined)
        .then(async () => {
          const updatedAt = await touchConversationUpdatedAt(conversationId);

          if (!updatedAt) {
            return;
          }

          setConversation((currentConversation) => {
            if (!currentConversation || currentConversation.id !== conversationId) {
              return currentConversation;
            }

            if (currentConversation.updatedAt.localeCompare(updatedAt) >= 0) {
              return currentConversation;
            }

            return {
              ...currentConversation,
              updatedAt,
            };
          });
        })
        .catch((syncError) => {
          setError((currentError) => currentError || toErrorMessage(syncError, '同步会话更新时间失败。'));
        });
    }

    async function readCurrentDocumentXml(): Promise<string> {
      const response = await callRemoteInvoke('aiDrawioGetDocument');
      const xml = Array.isArray(response) ? response[0] : response;

      if (typeof xml !== 'string' || xml.trim().length === 0) {
        throw new Error('draw.io returned an empty document');
      }

      bridge.lastDocumentXml = xml;
      return xml;
    }

    async function buildSvgPreviewPagesForHistory(xml: string): Promise<CanvasHistoryPreviewPage[]> {
      const response = await callRemoteInvoke('aiDrawioBuildSvgPreviewPages', [xml]);
      const result = Array.isArray(response) ? response[0] : response;

      return normalizeCanvasHistoryPreviewPages((result as { pages?: unknown } | null)?.pages);
    }

    async function buildSvgPagesForExport(xml: string): Promise<
      Array<{
        id: string;
        name: string;
        svg: string;
      }>
    > {
      const pages = await buildSvgPreviewPagesForHistory(xml);

      return pages.map((page) => ({
        id: page.id,
        name: page.name,
        svg: decodeSvgDataUri(page.svgDataUri),
      }));
    }

    async function exportCurrentSvgPages(): Promise<{
      exportedAt: string;
      pages: Array<{
        id: string;
        name: string;
        svg: string;
      }>;
    }> {
      const xml = await readCurrentDocumentXml();
      const pages = await buildSvgPagesForExport(xml);

      return {
        exportedAt: new Date().toISOString(),
        pages,
      };
    }

    async function applyDocumentWithHistory({
      historyLabel = '快照',
      historySource = 'ai-pre-apply',
      prompt = '',
      relatedMessageId = null,
      xml,
    }: {
      historyLabel?: string;
      historySource?: CanvasHistorySource;
      prompt?: string;
      relatedMessageId?: string | null;
      xml: string;
    }): Promise<{ appliedAt: string; xml: string }> {
      if (typeof xml !== 'string' || xml.trim().length === 0) {
        throw new Error('xml cannot be empty');
      }

      const conversationId = sessionIdRef.current.trim();
      const normalizedPrompt = prompt.trim();
      const resolvedHistoryLabel = buildCanvasHistoryLabel({
        fallbackLabel: '快照',
        historyLabel,
        prompt: normalizedPrompt,
      });
      let userMessage: ConversationMessage | null = null;

      if (conversationId) {
        try {
          if (historySource === 'ai-pre-apply' && normalizedPrompt) {
            userMessage = await appendConversationMessage({
              content: normalizedPrompt,
              conversationId,
              role: 'user',
            });
          }
        } catch (snapshotError) {
          const message = toErrorMessage(snapshotError, '记录画布历史失败。');
          setError(message);
          throw new Error(message);
        }
      }

      const appliedDocument = await applyDocumentWithoutHistory(xml);

      if (conversationId) {
        try {
          const previewPages = await buildSvgPreviewPagesForHistory(appliedDocument.xml);

          await appendCanvasHistoryEntry({
            conversationId,
            label: resolvedHistoryLabel,
            previewPages,
            relatedMessageId: userMessage?.id || relatedMessageId,
            source: historySource,
            xml: appliedDocument.xml,
          });
        } catch (snapshotError) {
          const message = toErrorMessage(snapshotError, '记录画布历史失败。');
          setError(message);
          throw new Error(message);
        }
      }

      void reloadConversationState(conversationId);

      return appliedDocument;
    }

    async function applyDocumentWithoutHistory(xml: string): Promise<{ appliedAt: string; xml: string }> {
      if (typeof xml !== 'string' || xml.trim().length === 0) {
        throw new Error('xml cannot be empty');
      }

      const response = await callRemoteInvoke('aiDrawioApplyDocument', [xml]);
      const nextXml = Array.isArray(response) ? response[0] : response;

      if (typeof nextXml !== 'string' || nextXml.trim().length === 0) {
        throw new Error('draw.io returned an empty document after apply');
      }

      bridge.lastDocumentXml = nextXml;

      return {
        appliedAt: new Date().toISOString(),
        xml: nextXml,
      };
    }

    async function ensureBrowserFileReady(): Promise<void> {
      if (bridge.bootstrappingBrowserFile || bridge.browserFileReady) {
        return;
      }

      bridge.bootstrappingBrowserFile = true;

      try {
        const frameWindow = getFrameWindow() as DrawioFrameWindow;
        const browserFileTitle = buildBrowserFileTitle(sessionIdRef.current);
        const response = await callRemoteInvoke(
          'aiDrawioEnsureBrowserFile',
          [browserFileTitle, getEmptyDiagramXml(frameWindow)],
          { requireDocumentLoaded: false },
        );
        const result = Array.isArray(response) ? response[0] : response;

        if (!result || typeof result !== 'object') {
          throw new Error('draw.io browser storage bootstrap returned an empty response');
        }

        bridge.browserFileReady = true;
        bridge.browserFileTitle =
          typeof (result as { title?: unknown }).title === 'string'
            ? (result as { title: string }).title
            : browserFileTitle;
        bridge.lastEvent = 'browser-file-ready';
        setIsFrameReady(true);
      } catch (bootstrapError) {
        bridge.browserFileReady = false;
        updateShellError(toErrorMessage(bootstrapError, '初始化 draw.io 浏览器存储失败。'));
      } finally {
        bridge.bootstrappingBrowserFile = false;
      }
    }

    async function bootstrapFrameBridge() {
      if (bridge.bootstrapStarted) {
        return;
      }

      bridge.bootstrapStarted = true;

      try {
        const frameWindow = getFrameWindow() as DrawioFrameWindow;
        installDocumentRemoteInvokes(frameWindow);

        bridge.remoteReady = true;
        bridge.bootstrapError = '';
        bridge.browserFileReady = false;
        bridge.browserFileTitle = '';
        bridge.lastEvent = 'bootstrap';

        postFrameMessage({ action: 'remoteInvokeReady' });
        postFrameMessage({
          action: 'load',
          autosave: 1,
          title: conversationRef.current?.title || '本地会话画布',
          xml: getEmptyDiagramXml(frameWindow),
        });
      } catch (bootstrapError) {
        bridge.bootstrapStarted = false;
        bridge.remoteReady = false;
        updateShellError(toErrorMessage(bootstrapError, '初始化 draw.io 文档桥失败。'));
      }
    }

    bridge.bootstrapFrame = bootstrapFrameBridge;

    function handleFrameMessage(event: MessageEvent): void {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const message = parseFrameMessage(event.data);
      if (!message) {
        return;
      }

      bridge.lastEvent = message.event || 'message';

      if (message.event === 'init') {
        void bootstrapFrameBridge();
        return;
      }

      if (message.event === 'load') {
        bridge.documentLoaded = true;
        bridge.remoteReady = true;
        void ensureBrowserFileReady();
        return;
      }

      if (message.event === 'autosave' || message.event === 'save') {
        if (typeof message.xml === 'string' && message.xml.trim().length > 0) {
          bridge.lastDocumentXml = message.xml;
        }

        bridge.documentLoaded = true;
        bridge.remoteReady = true;
        void syncConversationUpdatedAt();
        if (bridge.browserFileReady) {
          setIsFrameReady(true);
        }
        return;
      }

      if (message.event === 'remoteInvokeResponse') {
        const callbackId = String(message.msgMarkers?.callbackId || '');
        const pending = bridge.pending.get(callbackId);

        if (!pending) {
          return;
        }

        bridge.pending.delete(callbackId);

        if (message.error?.errResp) {
          pending.reject(new Error(String(message.error.errResp)));
          return;
        }

        pending.resolve(message.resp);
      }
    }

    const shellWindow = window as ShellWindow;
    const previousDocumentBridge = shellWindow.__AI_DRAWIO_SHELL__?.documentBridge;
    const previousGetFrameWindow = shellWindow.__AI_DRAWIO_SHELL__?.getFrameWindow;
    const previousGetState = shellWindow.__AI_DRAWIO_SHELL__?.getState;

    shellWindow.__AI_DRAWIO_SHELL__ = {
      ...(shellWindow.__AI_DRAWIO_SHELL__ || {}),
      documentBridge: {
        async applyDocument({ historyLabel, historySource, prompt, relatedMessageId, xml }) {
          return applyDocumentWithHistory({
            historyLabel,
            historySource,
            prompt,
            relatedMessageId,
            xml,
          });
        },

        async applyDocumentWithoutHistory(xml) {
          return applyDocumentWithoutHistory(xml);
        },

        async getDocument() {
          const xml = await readCurrentDocumentXml();

          return {
            readAt: new Date().toISOString(),
            xml,
          };
        },

        async exportSvgPages() {
          return exportCurrentSvgPages();
        },
      },

      getFrameWindow() {
        return getFrameWindow();
      },

      getState() {
        return {
          bootstrapError: bridge.bootstrapError || null,
          bridgeReady: bridge.remoteReady,
          browserFileReady: bridge.browserFileReady,
          browserFileTitle: bridge.browserFileTitle,
          conversationLoaded: Boolean(conversationRef.current),
          documentLoaded: bridge.documentLoaded,
          frameReady: frameReadyRef.current,
          lastEvent: bridge.lastEvent,
          route: `${window.location.pathname}${window.location.search}`,
          sessionId: sessionIdRef.current,
        };
      },
    };

    window.addEventListener('message', handleFrameMessage);

    return () => {
      window.removeEventListener('message', handleFrameMessage);
      bridge.bootstrapFrame = null;
      bridge.bootstrapStarted = false;
      bridge.bootstrappingBrowserFile = false;
      rejectPendingRequests('draw.io shell bridge was disposed');

      if (shellWindow.__AI_DRAWIO_SHELL__) {
        if (previousDocumentBridge) {
          shellWindow.__AI_DRAWIO_SHELL__.documentBridge = previousDocumentBridge;
        } else {
          delete shellWindow.__AI_DRAWIO_SHELL__.documentBridge;
        }

        if (previousGetFrameWindow) {
          shellWindow.__AI_DRAWIO_SHELL__.getFrameWindow = previousGetFrameWindow;
        } else {
          delete shellWindow.__AI_DRAWIO_SHELL__.getFrameWindow;
        }

        if (previousGetState) {
          shellWindow.__AI_DRAWIO_SHELL__.getState = previousGetState;
        } else {
          delete shellWindow.__AI_DRAWIO_SHELL__.getState;
        }
      }
    };
  }, []);

  const timelineEntries = conversation ? buildConversationTimeline(conversation) : [];
  const hasRestorePreview = restorePreviewPages.length > 0;
  const activeRestorePreviewPage = hasRestorePreview
    ? restorePreviewPages.find((page) => page.id === restorePreviewActivePageId) || restorePreviewPages[0] || null
    : null;

  if (isRouteRedirecting) {
    return null;
  }

  return (
    <Layout className={shellClassName}>
      <div className={pageShellClassName}>
        <Header className="mb-[14px]! h-auto bg-transparent p-0" data-layout="workspace-head">
          <InternalTopNavigation
            onBack={handleNavigateBack}
            content={
              <div
                className="flex min-w-0 flex-1 items-center justify-between gap-4"
                data-layout="workspace-top-nav-body"
              >
                <InternalBreadcrumb dataLayout="workspace-breadcrumb" routes={breadcrumbRoutes} />

                <div className="flex items-center justify-end gap-3" data-layout="workspace-status-bar">
                  <Space size={8}>
                    <Button icon={<IconEdit />} onClick={openRenameDialog} disabled={!conversation || isRenaming}>
                      重命名
                    </Button>
                    {conversation ? <Tag color="green">更新时间 {formatDate(conversation.updatedAt)}</Tag> : null}
                    <Tag color={isFrameReady ? 'green' : 'gold'}>
                      {isFrameReady ? 'draw.io 已就绪' : '正在加载 draw.io'}
                    </Tag>
                  </Space>
                </div>
              </div>
            }
          />
        </Header>

        <Layout hasSider className={shellBodyClassName} data-layout="workspace-body">
          <Sider width={320} theme="light" trigger={null} className={sidebarClassName} data-layout="workspace-sidebar">
            <Card
              className={`internal-panel overflow-hidden ${sidebarSurfaceClassName}`}
              title="会话记录"
              style={{ ...toolbarCardStyle, height: '100%' }}
              bodyStyle={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                minHeight: 0,
                height: 'calc(100% - 57px)',
                padding: 18,
              }}
            >
              <div className="flex min-h-0 flex-1 flex-col gap-[14px] lg:gap-4">
                {error ? <Alert type="error" content={error} showIcon /> : null}

                {timelineEntries.length ? (
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <Space direction="vertical" size={10} style={{ display: 'flex' }}>
                      {timelineEntries.map((entry) =>
                        entry.entryType === 'message' ? (
                          (() => {
                            const linkedCanvasHistoryEntry = findCanvasHistoryEntryForMessage(
                              entry,
                              conversation?.canvasHistory ?? [],
                            );

                            return (
                              <Card className="internal-message-card" key={entry.id}>
                                <Space direction="vertical" size={6} style={{ width: '100%', alignItems: 'stretch' }}>
                                  <Text style={{ fontWeight: 600 }}>{buildTimelineEntryHeading(entry)}</Text>
                                  <Text type="secondary">{formatDate(entry.createdAt)}</Text>
                                  <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                                    {buildTimelineEntryBody(entry, conversation?.messages ?? [])}
                                  </Paragraph>
                                  {entry.role === 'assistant' && linkedCanvasHistoryEntry ? (
                                    <Button
                                      size="small"
                                      type="primary"
                                      disabled={!isFrameReady || Boolean(restoringHistoryId)}
                                      loading={restoringHistoryId === linkedCanvasHistoryEntry.id}
                                      onClick={() => void openRestorePreview(linkedCanvasHistoryEntry)}
                                    >
                                      恢复到此版本
                                    </Button>
                                  ) : null}
                                </Space>
                              </Card>
                            );
                          })()
                        ) : (
                          <Card className="internal-message-card" key={entry.id}>
                            <Space direction="vertical" size={8} style={{ width: '100%', alignItems: 'stretch' }}>
                              <Text style={{ fontWeight: 600 }}>{buildTimelineEntryHeading(entry)}</Text>
                              <Text type="secondary">{formatDate(entry.createdAt)}</Text>
                              <Paragraph type="secondary" style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                                {buildTimelineEntryBody(entry, conversation?.messages ?? [])}
                              </Paragraph>
                              <Button
                                size="small"
                                type="primary"
                                disabled={!isFrameReady || Boolean(restoringHistoryId)}
                                loading={restoringHistoryId === entry.id}
                                onClick={() => void openRestorePreview(entry)}
                              >
                                恢复到此版本
                              </Button>
                            </Space>
                          </Card>
                        ),
                      )}
                    </Space>
                  </div>
                ) : (
                  <Empty
                    description="这条会话还没有消息或画布历史，后续 AI 修改画布后会在这里追加可恢复记录。"
                    style={{ paddingBlock: 24 }}
                  />
                )}
              </div>
            </Card>
          </Sider>

          <Content
            className={workspaceClassName}
            style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}
            data-layout="workspace-main"
          >
            <div className={workspaceCanvasClassName} data-layout="workspace-main-canvas">
              {conversation ? (
                <iframe
                  key={sessionId || 'empty-session'}
                  ref={iframeRef}
                  className="h-full w-full flex-1 border-0 bg-white"
                  style={{ display: 'block', width: '100%', height: '100%' }}
                  src={DRAWIO_EMBED_PATH}
                  title="嵌入式 draw.io 工作区"
                  onLoad={() => {
                    resetEmbeddedDocumentState();
                    bridgeRef.current.lastEvent = 'iframe-load';
                  }}
                />
              ) : (
                <div className="flex min-h-full w-full items-center justify-center">
                  <Empty description="正在校验本地会话记录..." />
                </div>
              )}
            </div>
          </Content>
        </Layout>
      </div>
      <Modal
        title="预览后恢复"
        visible={restorePreviewDialogOpen}
        style={{ width: '70vw', maxWidth: '70vw' }}
        onOk={() => void confirmRestorePreview()}
        onCancel={() => closeRestorePreview()}
        okText={restoringHistoryId === restorePreviewEntry?.id ? '恢复中...' : '确认恢复'}
        cancelText="取消"
        okButtonProps={{
          loading: restoringHistoryId === restorePreviewEntry?.id,
          disabled: !restorePreviewEntry || !hasRestorePreview || Boolean(restorePreviewError),
        }}
        cancelButtonProps={{ disabled: restoringHistoryId === restorePreviewEntry?.id }}
      >
        <Space direction="vertical" size={14} style={{ width: '100%', alignItems: 'stretch' }}>
          {restorePreviewEntry ? (
            <div className="flex items-center justify-between gap-3">
              <Tag>{buildCanvasHistoryDescription(restorePreviewEntry)}</Tag>
              <Tag color="green">{formatDate(restorePreviewEntry.createdAt)}</Tag>
            </div>
          ) : null}

          {hasRestorePreview ? (
            <Tabs
              activeTab={restorePreviewActivePageId}
              onChange={(value) => setRestorePreviewActivePageId(String(value))}
            >
              {restorePreviewPages.map((page) => (
                <Tabs.TabPane key={page.id} title={page.name} />
              ))}
            </Tabs>
          ) : null}

          {restorePreviewError ? <Alert type="error" content={restorePreviewError} showIcon /> : null}

          <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-[8px] bg-white p-4">
            {activeRestorePreviewPage ? (
              <img
                src={activeRestorePreviewPage.svgDataUri}
                alt={`${activeRestorePreviewPage.name} SVG 预览`}
                className="max-h-[60vh] max-w-full bg-white object-contain"
              />
            ) : (
              <Empty description="暂无缓存预览" />
            )}
          </div>
        </Space>
      </Modal>
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
    </Layout>
  );
}
