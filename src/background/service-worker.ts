import { logger } from "../shared/logger";
import { messageTypes, type ExtensionMessage, type PingResponse } from "../shared/messages";

chrome.runtime.onInstalled.addListener(({ reason }) => {
  logger.info("Extension installed or updated", { reason });
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const typedMessage = message as ExtensionMessage;
  if (typedMessage.type !== messageTypes.ping) return;

  const response: PingResponse = { ok: true, version: chrome.runtime.getManifest().version };
  sendResponse(response);
});
