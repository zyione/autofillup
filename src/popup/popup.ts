import { messageTypes, type PingResponse } from "../shared/messages";
import "./popup.css";

const status = document.querySelector<HTMLParagraphElement>("#status");

void chrome.runtime.sendMessage({ type: messageTypes.ping })
  .then((response: PingResponse) => {
    if (status) status.textContent = `Foundation ready (v${response.version}).`;
  })
  .catch(() => {
    if (status) status.textContent = "Extension service is unavailable. Reload the extension.";
  });
