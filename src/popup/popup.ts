import "./popup.css";
import type { StatusResponse } from "../shared/messages";

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
const reviewBtn = document.querySelector<HTMLButtonElement>("#review-btn")!;
const openOptionsBtn = document.querySelector<HTMLButtonElement>("#open-options-btn")!;

async function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function initPopup(): Promise<void> {
  const tab = await queryActiveTab();
  if (!tab || !tab.id || !tab.url) {
    statusMsg.textContent = "Unable to inspect current tab.";
    return;
  }

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" })) as StatusResponse | undefined;

    if (!response || !response.supported) {
      siteBadge.textContent = "Not Workday";
      siteBadge.className = "site-badge inactive";
      statusMsg.textContent = "Open a supported Workday application page to activate autofill.";
      autofillBtn.disabled = true;
      return;
    }

    siteBadge.textContent = "Workday Ready";
    siteBadge.className = "site-badge active";
    autofillBtn.disabled = false;

    pageInfo.style.display = "block";
    tenantName.textContent = `Tenant: ${response.tenant || "Workday"}`;
    pageName.textContent = response.currentPage || "Application Form";

    if (response.outcomes && response.outcomes.length > 0) {
      updateMetrics(response);
    } else {
      statusMsg.textContent = "Click 'Autofill Page' to scan and fill detected fields.";
    }
  } catch {
    // Content script not loaded yet or not a matching page
    const isWorkdayHost = tab.url.includes("myworkdayjobs.com") || tab.url.includes("workday");
    if (isWorkdayHost) {
      siteBadge.textContent = "Workday Detected";
      siteBadge.className = "site-badge active";
      statusMsg.textContent = "Refresh page or click 'Autofill Page' to activate.";
      autofillBtn.disabled = false;
    } else {
      siteBadge.textContent = "Not Workday";
      siteBadge.className = "site-badge inactive";
      statusMsg.textContent = "Open a Workday application to begin.";
      autofillBtn.disabled = true;
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
  statusMsg.textContent = `${response.outcomes.length} field(s) analyzed. Review fields before proceeding.`;

  if (counts.unknown && counts.unknown > 0) {
    reviewBtn.style.display = "block";
    reviewBtn.textContent = `Teach ${counts.unknown} Unknown Field(s)`;
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
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: "RUN_AUTOFILL",
      showOverlay: true
    })) as StatusResponse | undefined;

    if (response) {
      updateMetrics(response);
    }
  } catch (err) {
    statusMsg.textContent = "Error communicating with page. Please refresh.";
  } finally {
    autofillBtn.disabled = false;
  }
});

reviewBtn.addEventListener("click", async () => {
  const tab = await queryActiveTab();
  if (!tab || !tab.id) return;

  // Trigger autofill with overlay so user can teach on page
  await chrome.tabs.sendMessage(tab.id, { type: "RUN_AUTOFILL", showOverlay: true });
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
