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
  listConversations
} from "../_lib/conversation-store";

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
  openSession: (id: string) => Promise<{
    href: string;
    id: string;
  }>;
};

type ShellBridge = {
  conversationStore?: ShellConversationStore;
  getState?: () => ShellState;
  getSessionStatus?: (id: string) => ReturnType<typeof getSessionStatus>;
  listOpenSessions?: () => string[];
  openSessionTab?: (id: string, title?: string) => Promise<void>;
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

export default function InternalShellBridge() {
  const router = useRouter();

  useEffect(() => {
    const shellWindow = window as ShellWindow;
    const previousShell = shellWindow.__AI_DRAWIO_SHELL__;

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
        async openSession(id) {
          const href = buildSessionHref(id);
          await getSessionShellControls().openSessionTab?.(id, id);
          router.push(href);

          return {
            href,
            id
          };
        }
      },
      getSessionStatus,
      listOpenSessions,
      openSessionTab: async (id, title) => {
        await getSessionShellControls().openSessionTab?.(id, title);
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
