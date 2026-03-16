"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { buildSessionHref } from "../_lib/conversation-model";
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
};

type ShellWindow = Window &
  typeof globalThis & {
    __AI_DRAWIO_SHELL__?: ShellBridge;
  };

function buildIdleShellState(): ShellState {
  const route = `${window.location.pathname}${window.location.search}`;
  const sessionId = new URLSearchParams(window.location.search).get("id") || "";

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
    sessionId
  };
}

export default function InternalShellBridge() {
  const router = useRouter();

  useEffect(() => {
    const shellWindow = window as ShellWindow;
    const previousShell = shellWindow.__AI_DRAWIO_SHELL__;

    shellWindow.__AI_DRAWIO_SHELL__ = {
      ...previousShell,
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
          router.push(href);

          return {
            href,
            id
          };
        }
      },
      getState: previousShell?.getState || buildIdleShellState
    };

    return () => {
      shellWindow.__AI_DRAWIO_SHELL__ = previousShell;
    };
  }, [router]);

  return null;
}
