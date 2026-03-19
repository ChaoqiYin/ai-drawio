import { create, type StoreApi, type UseBoundStore } from "zustand";

export type WorkspaceSessionSummary = {
  id: string;
  isReady: boolean;
  title: string;
  updatedAt: string;
};

type WorkspaceSessionState = {
  activeSessionId: string;
  openedSessions: WorkspaceSessionSummary[];
  activateSession: (sessionId: string) => void;
  closeSession: (sessionId: string) => void;
  enterSessionDetail: (session: WorkspaceSessionSummary) => void;
  openSession: (session: WorkspaceSessionSummary) => void;
  resetSessionDetail: () => void;
  updateSessionMeta: (
    sessionId: string,
    patch: Partial<Omit<WorkspaceSessionSummary, "id">>,
  ) => void;
};

function createState(set: StoreApi<WorkspaceSessionState>["setState"]): WorkspaceSessionState {
  return {
    activeSessionId: "",
    openedSessions: [],
    activateSession: (sessionId) => {
      set({ activeSessionId: sessionId });
    },
    closeSession: (sessionId) => {
      set((state) => {
        const currentIndex = state.openedSessions.findIndex((item) => item.id === sessionId);
        const nextSessions = state.openedSessions.filter((item) => item.id !== sessionId);
        const fallbackSession = nextSessions[currentIndex] ?? nextSessions[currentIndex - 1] ?? null;

        return {
          activeSessionId:
            state.activeSessionId === sessionId ? (fallbackSession?.id ?? "") : state.activeSessionId,
          openedSessions: nextSessions,
        };
      });
    },
    enterSessionDetail: (session) => {
      set({
        activeSessionId: session.id,
        openedSessions: [session],
      });
    },
    openSession: (session) => {
      set((state) => {
        const existingIndex = state.openedSessions.findIndex((item) => item.id === session.id);

        if (existingIndex === -1) {
          return {
            activeSessionId: session.id,
            openedSessions: [...state.openedSessions, session],
          };
        }

        const nextSessions = [...state.openedSessions];
        nextSessions[existingIndex] = {
          ...nextSessions[existingIndex],
          ...session,
        };

        return {
          activeSessionId: session.id,
          openedSessions: nextSessions,
        };
      });
    },
    resetSessionDetail: () => {
      set({
        activeSessionId: "",
        openedSessions: [],
      });
    },
    updateSessionMeta: (sessionId, patch) => {
      set((state) => ({
        openedSessions: state.openedSessions.map((item) =>
          item.id === sessionId ? { ...item, ...patch } : item,
        ),
      }));
    },
  };
}

export function createWorkspaceSessionStore(): UseBoundStore<StoreApi<WorkspaceSessionState>> {
  return create<WorkspaceSessionState>()(createState);
}

export const useWorkspaceSessionStore = createWorkspaceSessionStore();
