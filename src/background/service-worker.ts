import { logger } from "../shared/logger";
import { messageTypes, type PingResponse } from "../shared/messages";
import { SessionManager } from "./session-manager";

const sessionManager = new SessionManager();

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  logger.info("Extension installed or updated", { reason });

  // Safety migration & auto-recovery check across builds
  try {
    const raw = await chrome.storage.local.get(["profile", "fieldMappings", "settings", "autofillup_backup_snapshot"]);
    if ((!raw.profile || Object.keys(raw.profile).length === 0) && raw.autofillup_backup_snapshot) {
      const snap = raw.autofillup_backup_snapshot;
      if (snap.profile) await chrome.storage.local.set({ profile: snap.profile });
      if (snap.fieldMappings) await chrome.storage.local.set({ fieldMappings: snap.fieldMappings });
      if (snap.settings) await chrome.storage.local.set({ settings: snap.settings });
      logger.info("Auto-recovered configuration from safety snapshot", { savedAt: snap.savedAt });
    }
  } catch (err) {
    logger.warn("Auto-recovery notice", { error: String(err) });
  }
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
