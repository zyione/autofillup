import { logger } from "../shared/logger";
import { messageTypes, type ExtensionMessage, type PingResponse } from "../shared/messages";
import { SessionManager } from "./session-manager";

const sessionManager = new SessionManager();

chrome.runtime.onInstalled.addListener(({ reason }) => {
  logger.info("Extension installed or updated", { reason });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  sessionManager.removeSession(tabId);
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const typed = message as Record<string, unknown>;

  if (typed.type === messageTypes.ping || typed.type === "FOUNDATION_PING") {
    const response: PingResponse = { ok: true, version: chrome.runtime.getManifest().version };
    sendResponse(response);
    return false;
  }

  if (typed.type === messageTypes.openOptions || typed.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
