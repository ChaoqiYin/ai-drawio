import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeHomeRedirectError,
  saveHomeRedirectError
} from "../app/(internal)/_lib/conversation-route-state.ts";

function createSessionStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  };
}

test("conversation route state safely no-ops without window", () => {
  assert.equal(consumeHomeRedirectError(), "");
  saveHomeRedirectError("Missing stored conversation.");
  assert.equal(consumeHomeRedirectError(), "");
});

test("conversation route state stores and clears the redirect error once", () => {
  const previousWindow = globalThis.window;
  const sessionStorage = createSessionStorageMock();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage }
  });

  try {
    saveHomeRedirectError("Missing stored conversation.");

    assert.equal(consumeHomeRedirectError(), "Missing stored conversation.");
    assert.equal(consumeHomeRedirectError(), "");
  } finally {
    if (typeof previousWindow === "undefined") {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow
      });
    }
  }
});
