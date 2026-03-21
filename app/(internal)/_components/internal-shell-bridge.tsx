"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { buildSessionHref } from "../_lib/conversation-model";
import {
  getSessionShellControls,
  getSessionStatus,
  getSessionRuntime,
  listOpenSessions,
  registerSessionRuntime,
  unregisterSessionRuntime,
} from "../_lib/session-runtime-registry";
import {
  createConversation,
  findConversationByTitle,
  getConversationById,
  hasConversation,
  importLegacyIndexedDbConversations,
  listConversations
} from "../_lib/conversation-store";
import { useWorkspaceSessionStore, type WorkspaceSessionSummary } from "../_lib/workspace-session-store";

type ShellState = {
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

type ShellConversationStore = {
  createConversation: () => Promise<{
    createdAt: string;
    href: string;
    id: string;
    title: string;
    updatedAt: string;
  }>;
  findConversationByTitle: (title: string) => Promise<{
    href: string;
    id: string;
    title: string;
  } | null>;
  getConversation: (id: string) => Promise<{
    canvasHistory: unknown[];
    createdAt: string;
    id: string;
    messages: unknown[];
    title: string;
    updatedAt: string;
  } | null>;
  hasConversation: (id: string) => Promise<boolean>;
  listConversations: () => Promise<
    Array<{
      id: string;
      title: string;
    }>
  >;
  closeSession: (id: string) => Promise<{
    sessionId: string;
    status: string;
  }>;
  openSession: (id: string, options?: { activate?: boolean }) => Promise<{
    href: string;
    id: string;
  }>;
};

type ShellBridge = {
  conversationStore?: ShellConversationStore;
  getState?: () => ShellState;
  getSessionStatus?: (id: string) => ReturnType<typeof getSessionStatus>;
  listOpenSessions?: () => string[];
  openSessionTab?: (id: string, title?: string, options?: { activate?: boolean }) => Promise<void>;
  ensureSessionTab?: (id?: string) => Promise<{ id: string } | null>;
  sessions?: Record<string, ReturnType<typeof getSessionRuntime>>;
};

type ShellWindow = Window &
  typeof globalThis & {
    __AI_DRAWIO_SHELL__?: ShellBridge;
  };

function buildIdleShellState(): ShellState {
  const route = `${window.location.pathname}${window.location.search}`;

  return {
    bootstrapError: null,
    bridgeReady: false,
    browserFileReady: false,
    browserFileTitle: "",
    conversationLoaded: false,
    documentLoaded: false,
    frameReady: false,
    lastEvent: "idle",
    route,
    sessionId: ""
  };
}

function buildWorkspaceSessionSummary(
  id: string,
  title?: string,
  updatedAt?: string,
): WorkspaceSessionSummary {
  return {
    id,
    isReady: false,
    title: title ?? id,
    updatedAt: updatedAt ?? new Date(0).toISOString(),
  };
}

export default function InternalShellBridge() {
  const router = useRouter();

  useEffect(() => {
    const shellWindow = window as ShellWindow;
    const previousShell = shellWindow.__AI_DRAWIO_SHELL__;

    void importLegacyIndexedDbConversations().catch(() => {
      // Ignore one-time desktop migration failures and keep the shell available.
    });

    shellWindow.__AI_DRAWIO_SHELL__ = {
      ...previousShell,
      ensureSessionTab: async (id?: string) => {
        return (await getSessionShellControls().ensureSessionTab?.(id)) ?? null;
      },
      conversationStore: {
        async createConversation() {
          const conversation = await createConversation("本地 AI 会话");

          return {
            createdAt: conversation.createdAt,
            href: buildSessionHref(conversation.id),
            id: conversation.id,
            title: conversation.title,
            updatedAt: conversation.updatedAt
          };
        },
        async hasConversation(id) {
          return hasConversation(id);
        },
        async listConversations() {
          const conversations = await listConversations();

          return conversations.map((conversation) => ({
            id: conversation.id,
            title: conversation.title
          }));
        },
        async findConversationByTitle(title) {
          const conversation = await findConversationByTitle(title);

          if (!conversation) {
            return null;
          }

          return {
            href: buildSessionHref(conversation.id),
            id: conversation.id,
            title: conversation.title
          };
        },
        async getConversation(id) {
          const conversation = await getConversationById(id);

          return conversation ?? null;
        },
        async closeSession(id) {
          const openedSessions = useWorkspaceSessionStore.getState().openedSessions;
          const isOpen = openedSessions.some((session) => session.id === id);

          if (!isOpen) {
            const error = new Error(`session '${id}' is not currently opened`) as Error & {
              code?: string;
            };
            error.code = "SESSION_NOT_OPEN";
            throw error;
          }

          useWorkspaceSessionStore.getState().closeSession(id);

          return {
            sessionId: id,
            status: "closed"
          };
        },
        async openSession(id, options) {
          const href = buildSessionHref(id);
          const openSessionTab = getSessionShellControls().openSessionTab;

          if (openSessionTab) {
            await openSessionTab(id, id, {
              activate: options?.activate ?? true,
            });
          } else {
            const conversation = await getConversationById(id);
            const openSessionInStore = useWorkspaceSessionStore.getState().openSession;

            openSessionInStore(
              buildWorkspaceSessionSummary(
                id,
                conversation?.title,
                conversation?.updatedAt,
              ),
              {
                activate: options?.activate ?? true,
              },
            );
          }

          if (window.location.pathname !== href) {
            router.push(href);
          }

          return {
            href,
            id
          };
        }
      },
      getSessionStatus,
      listOpenSessions,
      openSessionTab: async (id, title, options) => {
        await getSessionShellControls().openSessionTab?.(id, title, options);
      },
      sessions: new Proxy(
        {},
        {
          get(_target, property) {
            if (typeof property !== "string") {
              return undefined;
            }

            return getSessionRuntime(property);
          },
          ownKeys() {
            return listOpenSessions();
          },
          getOwnPropertyDescriptor(_target, property) {
            if (typeof property !== "string") {
              return undefined;
            }

            const runtime = getSessionRuntime(property);

            if (!runtime) {
              return undefined;
            }

            return {
              configurable: true,
              enumerable: true,
              value: runtime,
              writable: false,
            };
          },
        }
      ) as Record<string, ReturnType<typeof getSessionRuntime>>,
      getState: previousShell?.getState || buildIdleShellState
    };

    return () => {
      shellWindow.__AI_DRAWIO_SHELL__ = previousShell;
    };
  }, [router]);

  return null;
}
