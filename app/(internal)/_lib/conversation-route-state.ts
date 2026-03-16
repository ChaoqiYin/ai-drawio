const HOME_REDIRECT_ERROR_KEY = "ai-drawio:home-redirect-error";

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveHomeRedirectError(message: string): void {
  const sessionStorage = getSessionStorage();
  const nextMessage = message.trim();

  if (!sessionStorage || !nextMessage) {
    return;
  }

  sessionStorage.setItem(HOME_REDIRECT_ERROR_KEY, nextMessage);
}

export function consumeHomeRedirectError(): string {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return "";
  }

  const message = sessionStorage.getItem(HOME_REDIRECT_ERROR_KEY)?.trim() || "";

  if (message) {
    sessionStorage.removeItem(HOME_REDIRECT_ERROR_KEY);
  }

  return message;
}
