import "./popup.css";
import type { StatusResponse, LearnPageResponse } from "../shared/messages";

const siteBadge = document.querySelector<HTMLDivElement>("#site-badge")!;
const pageInfo = document.querySelector<HTMLDivElement>("#page-info")!;
const tenantName = document.querySelector<HTMLSpanElement>("#tenant-name")!;
const pageName = document.querySelector<HTMLHeadingElement>("#page-name")!;
const statusMsg = document.querySelector<HTMLParagraphElement>("#status-msg")!;
const metricsGrid = document.querySelector<HTMLDivElement>("#metrics-grid")!;
const cntFilled = document.querySelector<HTMLElement>("#cnt-filled")!;
const cntReview = document.querySelector<HTMLElement>("#cnt-review")!;
const cntUnknown = document.querySelector<HTMLElement>("#cnt-unknown")!;
const cntSkipped = document.querySelector<HTMLElement>("#cnt-skipped")!;
const autofillBtn = document.querySelector<HTMLButtonElement>("#autofill-btn")!;
const learnPageBtn = document.querySelector<HTMLButtonElement>("#learn-page-btn")!;
const reviewBtn = document.querySelector<HTMLButtonElement>("#review-btn")!;
const openOptionsBtn = document.querySelector<HTMLButtonElement>("#open-options-btn")!;

async function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    const res = (await chrome.tabs.sendMessage(tabId, { type: "GET_STATUS" })) as StatusResponse | undefined;
    if (res !== undefined) return true;
  } catch {
    // Content script not yet attached; inject dynamically
    try {
      if (chrome.scripting) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["assets/content.js"]
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
        return true;
      }
    } catch (err) {
      console.warn("[AutoFillUp] Programmatic script injection failed:", err);
      return false;
    }
  }
  return false;
}

async function initPopup(): Promise<void> {
  const tab = await queryActiveTab();
  if (!tab || !tab.id || !tab.url) {
    statusMsg.textContent = "Unable to inspect current tab.";
    return;
  }

  const isWorkdayHost =
    tab.url.includes("myworkdayjobs.com") ||
    tab.url.includes("workday") ||
    tab.url.includes("myworkday") ||
    tab.url.includes("myworkdaysite.com");

  try {
    let response = (await chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" })) as StatusResponse | undefined;

    if (!response && isWorkdayHost) {
      await ensureContentScript(tab.id);
      response = (await chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" })) as StatusResponse | undefined;
    }

    if (!response || !response.supported) {
      if (isWorkdayHost) {
        siteBadge.textContent = "Workday Ready";
        siteBadge.className = "site-badge active";
        statusMsg.textContent = "Click 'Autofill Page' to scan fields, or fill inputs on the page and click 'Learn'.";
        autofillBtn.disabled = false;
        learnPageBtn.style.display = "block";
      } else {
        siteBadge.textContent = "Not Workday";
        siteBadge.className = "site-badge inactive";
        statusMsg.textContent = "Open a supported Workday application page to activate autofill.";
        autofillBtn.disabled = true;
        learnPageBtn.style.display = "none";
      }
      return;
    }

    siteBadge.textContent = "Workday Ready";
    siteBadge.className = "site-badge active";
    autofillBtn.disabled = false;
    learnPageBtn.style.display = "block";

    pageInfo.style.display = "block";
    tenantName.textContent = `Tenant: ${response.tenant || "Workday"}`;
    pageName.textContent = response.currentPage || "Application Form";

    if (response.outcomes && response.outcomes.length > 0) {
      updateMetrics(response);
    } else {
      statusMsg.textContent = "Click 'Autofill Page' to scan and fill detected fields.";
    }
  } catch {
    if (isWorkdayHost) {
      // Try injection once
      const injected = await ensureContentScript(tab.id);
      if (injected) {
        try {
          const retryRes = (await chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" })) as StatusResponse | undefined;
          if (retryRes && retryRes.supported) {
            siteBadge.textContent = "Workday Ready";
            siteBadge.className = "site-badge active";
            autofillBtn.disabled = false;
            learnPageBtn.style.display = "block";
            pageInfo.style.display = "block";
            tenantName.textContent = `Tenant: ${retryRes.tenant || "Workday"}`;
            pageName.textContent = retryRes.currentPage || "Application Form";
            if (retryRes.outcomes && retryRes.outcomes.length > 0) {
              updateMetrics(retryRes);
            } else {
              statusMsg.textContent = "Click 'Autofill Page' to scan and fill detected fields.";
            }
            return;
          }
        } catch {}
      }

      siteBadge.textContent = "Workday Ready";
      siteBadge.className = "site-badge active";
      statusMsg.textContent = "Click 'Autofill Page' or refresh the tab if needed.";
      autofillBtn.disabled = false;
      learnPageBtn.style.display = "block";
    } else {
      siteBadge.textContent = "Not Workday";
      siteBadge.className = "site-badge inactive";
      statusMsg.textContent = "Open a Workday application to begin.";
      autofillBtn.disabled = true;
      learnPageBtn.style.display = "none";
    }
  }
}

function updateMetrics(response: StatusResponse): void {
  const counts = response.outcomes.reduce<Record<string, number>>((acc, item) => {
    acc[item.outcome] = (acc[item.outcome] ?? 0) + 1;
    return acc;
  }, {});

  cntFilled.textContent = String(counts.filled ?? 0);
  cntReview.textContent = String(counts.review ?? 0);
  cntUnknown.textContent = String(counts.unknown ?? 0);
  cntSkipped.textContent = String(counts.skipped ?? 0);

  metricsGrid.style.display = "grid";
  statusMsg.textContent = `${response.outcomes.length} field(s) analyzed. Review fields or learn from page below.`;

  const unknownOrReview = (counts.unknown ?? 0) + (counts.review ?? 0);
  if (unknownOrReview > 0) {
    reviewBtn.style.display = "block";
    reviewBtn.textContent = `Teach ${unknownOrReview} Field(s)`;
  } else {
    reviewBtn.style.display = "none";
  }
}

autofillBtn.addEventListener("click", async () => {
  const tab = await queryActiveTab();
  if (!tab || !tab.id) return;

  autofillBtn.disabled = true;
  statusMsg.textContent = "Scanning and autofilling...";

  try {
    let response: StatusResponse | undefined;
    try {
      response = (await chrome.tabs.sendMessage(tab.id, {
        type: "RUN_AUTOFILL",
        showOverlay: true
      })) as StatusResponse | undefined;
    } catch {
      await ensureContentScript(tab.id);
      response = (await chrome.tabs.sendMessage(tab.id, {
        type: "RUN_AUTOFILL",
        showOverlay: true
      })) as StatusResponse | undefined;
    }

    if (response) {
      siteBadge.textContent = "Workday Ready";
      siteBadge.className = "site-badge active";
      pageInfo.style.display = "block";
      tenantName.textContent = `Tenant: ${response.tenant || "Workday"}`;
      pageName.textContent = response.currentPage || "Application Form";
      updateMetrics(response);
    }
  } catch (err) {
    statusMsg.textContent = "Could not connect to page. Please reload the Workday tab (F5) and try again.";
  } finally {
    autofillBtn.disabled = false;
  }
});

learnPageBtn.addEventListener("click", async () => {
  const tab = await queryActiveTab();
  if (!tab || !tab.id) return;

  learnPageBtn.disabled = true;
  statusMsg.textContent = "Scanning page inputs to learn values...";

  try {
    let res: LearnPageResponse | undefined;
    try {
      res = (await chrome.tabs.sendMessage(tab.id, {
        type: "LEARN_PAGE"
      })) as LearnPageResponse | undefined;
    } catch {
      await ensureContentScript(tab.id);
      res = (await chrome.tabs.sendMessage(tab.id, {
        type: "LEARN_PAGE"
      })) as LearnPageResponse | undefined;
    }

    if (res && res.learnedCount > 0) {
      statusMsg.textContent = `✓ Learned ${res.learnedCount} field(s) from this page into your profile & mappings!`;
      setTimeout(() => {
        void initPopup();
      }, 1200);
    } else {
      statusMsg.textContent = "No filled values detected on page. Fill out your details on the form first, then click Learn!";
    }
  } catch {
    statusMsg.textContent = "Could not learn from page. Please refresh the page.";
  } finally {
    learnPageBtn.disabled = false;
  }
});

reviewBtn.addEventListener("click", async () => {
  const tab = await queryActiveTab();
  if (!tab || !tab.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "RUN_AUTOFILL", showOverlay: true });
  } catch {
    await ensureContentScript(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: "RUN_AUTOFILL", showOverlay: true });
  }
  window.close();
});

openOptionsBtn.addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("src/options/options.html"));
  }
});

void initPopup();
