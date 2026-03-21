export type SessionRuntimeStatus = {
  isReady: boolean;
  sessionId: string;
  status: string;
};

export type SessionRuntimeEntry = {
  documentBridge: object;
  getState: () => SessionRuntimeStatus;
};

type SessionShellControls = {
  ensureSessionTab?: (sessionId?: string) => Promise<{ id: string } | null> | { id: string } | null;
  openSessionTab?: (
    sessionId: string,
    title?: string,
    options?: { activate?: boolean },
  ) => Promise<void> | void;
};

const sessionRuntimes = new Map<string, SessionRuntimeEntry>();
let sessionShellControls: SessionShellControls = {};

export function registerSessionRuntime(sessionId: string, entry: SessionRuntimeEntry): void {
  sessionRuntimes.set(sessionId, entry);
}

export function unregisterSessionRuntime(sessionId: string): void {
  sessionRuntimes.delete(sessionId);
}

export function getSessionRuntime(sessionId: string): SessionRuntimeEntry | null {
  return sessionRuntimes.get(sessionId) ?? null;
}

export function listOpenSessions(): string[] {
  return [...sessionRuntimes.keys()];
}

export function getSessionStatus(sessionId: string): SessionRuntimeStatus | null {
  return sessionRuntimes.get(sessionId)?.getState() ?? null;
}

export function setSessionShellControls(nextControls: SessionShellControls): void {
  sessionShellControls = nextControls;
}

export function getSessionShellControls(): SessionShellControls {
  return sessionShellControls;
}

export async function runSessionDocumentAction<T>(
  _sessionId: string,
  action: () => Promise<T> | T,
): Promise<T> {
  return await action();
}

export function resetSessionRuntimeRegistryForTests(): void {
  sessionRuntimes.clear();
  sessionShellControls = {};
}
