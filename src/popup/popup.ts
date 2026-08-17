import "./popup.css";
import type { StatusResponse, LearnPageResponse, ForgetPageResponse } from "../shared/messages";
import type { FieldFillResult } from "../shared/types";

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
const forgetPageBtn = document.querySelector<HTMLButtonElement>("#forget-page-btn")!;
const openOptionsBtn = document.querySelector<HTMLButtonElement>("#open-options-btn")!;

// Inspector elements in popup
const tabBtnAutofill = document.querySelector<HTMLButtonElement>("#tab-btn-autofill")!;
const tabBtnInspector = document.querySelector<HTMLButtonElement>("#tab-btn-inspector")!;
const viewAutofill = document.querySelector<HTMLDivElement>("#view-autofill")!;
const viewInspector = document.querySelector<HTMLDivElement>("#view-inspector")!;
const popupFieldsList = document.querySelector<HTMLDivElement>("#popup-fields-list")!;
const fieldsCountTitle = document.querySelector<HTMLSpanElement>("#fields-count-title")!;
const insToast = document.querySelector<HTMLDivElement>("#inspector-toast")!;
const insLearnBtn = document.querySelector<HTMLButtonElement>("#ins-learn-btn")!;
const insSaveProfileBtn = document.querySelector<HTMLButtonElement>("#ins-save-profile-btn")!;
const insAutofillBtn = document.querySelector<HTMLButtonElement>("#ins-autofill-btn")!;

let lastOutcomes: FieldFillResult[] = [];

// Tab switching
tabBtnAutofill.addEventListener("click", () => {
  tabBtnAutofill.classList.add("active");
  tabBtnInspector.classList.remove("active");
  viewAutofill.classList.add("active");
  viewInspector.classList.remove("active");
});

tabBtnInspector.addEventListener("click", () => {
  tabBtnInspector.classList.add("active");
  tabBtnAutofill.classList.remove("active");
  viewInspector.classList.add("active");
  viewAutofill.classList.remove("active");
});

async function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    const res = (await chrome.tabs.sendMessage(tabId, { type: "GET_STATUS" })) as StatusResponse | undefined;
    if (res !== undefined) return true;
  } catch {
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

function showToast(msg: string, isError = false): void {
  insToast.textContent = msg;
  insToast.style.display = "block";
  insToast.style.background = isError ? "#7f1d1d" : "#065f46";
  insToast.style.color = isError ? "#fca5a5" : "#34d399";
  insToast.style.borderColor = isError ? "#991b1b" : "#059669";
  setTimeout(() => {
    insToast.style.display = "none";
  }, 2500);
}

function renderInspectorFields(outcomes: FieldFillResult[]): void {
  lastOutcomes = outcomes;
  fieldsCountTitle.textContent = `Detected Fields (${outcomes.length})`;

  if (!outcomes.length) {
    popupFieldsList.innerHTML = `<p style="padding:16px;font-size:12px;color:#94a3b8;text-align:center;">No fields found on this page yet. Click "Autofill Page" to scan.</p>`;
    return;
  }

  popupFieldsList.innerHTML = outcomes
    .map((item) => {
      const isIgnored = item.mappingSource === "ignore" || item.outcome === "skipped";
      const initialVal = isIgnored ? "" : item.valueAttempted || "";
      const isUnknown = !isIgnored && (item.outcome === "unknown" || item.outcome === "review" || !initialVal);

      return `
        <div class="field-item ${isIgnored ? "is-ignored" : ""}" data-id="${item.fieldId}">
          <div class="field-top-row">
            <span class="field-label" title="${item.label}">${item.label}</span>
            <div class="field-badges">
              ${isIgnored ? `<span class="field-ignored-badge">IGNORED</span>` : ""}
              <span class="field-kind-badge">${item.kind}</span>
            </div>
          </div>
          <div class="field-input-row">
            <input 
              type="text" 
              class="field-input ins-field-input" 
              data-field-id="${item.fieldId}" 
              data-label="${item.label}" 
              placeholder="${isIgnored ? "Permanently ignored" : (isUnknown ? "Type answer to save..." : "Value to fill")}" 
              value="${initialVal.replace(/"/g, "&quot;")}"
              ${isIgnored ? "disabled" : ""}
            />
            <button class="btn-row-save ins-row-save-btn" data-field-id="${item.fieldId}" data-label="${item.label}" title="Save value to Profile" ${isIgnored ? "disabled" : ""}>💾</button>
          </div>
        </div>
      `;
    })
    .join("");

  // Individual row save
  popupFieldsList.querySelectorAll<HTMLButtonElement>(".ins-row-save-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tab = await queryActiveTab();
      if (!tab || !tab.id) return;

      const fieldId = btn.getAttribute("data-field-id");
      const label = btn.getAttribute("data-label") || "";
      const input = popupFieldsList.querySelector<HTMLInputElement>(`.ins-field-input[data-field-id="${CSS.escape(fieldId || "")}"]`);
      const val = input?.value.trim() || "";

      if (!val) {
        showToast(`Please enter a value for "${label}" before saving.`, true);
        return;
      }

      btn.disabled = true;
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "SAVE_PAGE_VALUES",
          entries: [{ fieldId: fieldId || "", label, value: val }]
        });
        showToast(`✓ Saved "${label}" to Profile!`);
      } catch {
        showToast(`Error saving ${label}`, true);
      } finally {
        btn.disabled = false;
      }
    });
  });
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

  renderInspectorFields(response.outcomes);
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
        statusMsg.textContent = "Click 'Autofill Page' to scan fields, or inspect values in the Inspector tab.";
        autofillBtn.disabled = false;
        learnPageBtn.style.display = "block";
        if (forgetPageBtn) forgetPageBtn.style.display = "block";
      } else {
        siteBadge.textContent = "Not Workday";
        siteBadge.className = "site-badge inactive";
        statusMsg.textContent = "Open a supported Workday application page to activate autofill.";
        autofillBtn.disabled = true;
        learnPageBtn.style.display = "none";
        if (forgetPageBtn) forgetPageBtn.style.display = "none";
      }
      return;
    }

    siteBadge.textContent = "Workday Ready";
    siteBadge.className = "site-badge active";
    autofillBtn.disabled = false;
    learnPageBtn.style.display = "block";
    if (forgetPageBtn) forgetPageBtn.style.display = "block";

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
      const injected = await ensureContentScript(tab.id);
      if (injected) {
        try {
          const retryRes = (await chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" })) as StatusResponse | undefined;
          if (retryRes && retryRes.supported) {
            siteBadge.textContent = "Workday Ready";
            siteBadge.className = "site-badge active";
            autofillBtn.disabled = false;
            learnPageBtn.style.display = "block";
            if (forgetPageBtn) forgetPageBtn.style.display = "block";
            pageInfo.style.display = "block";
            tenantName.textContent = `Tenant: ${retryRes.tenant || "Workday"}`;
            pageName.textContent = retryRes.currentPage || "Application Form";
            if (retryRes.outcomes && retryRes.outcomes.length > 0) {
              updateMetrics(retryRes);
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
      if (forgetPageBtn) forgetPageBtn.style.display = "block";
    } else {
      siteBadge.textContent = "Not Workday";
      siteBadge.className = "site-badge inactive";
      statusMsg.textContent = "Open a Workday application to begin.";
      autofillBtn.disabled = true;
      learnPageBtn.style.display = "none";
      if (forgetPageBtn) forgetPageBtn.style.display = "none";
    }
  }
}

async function triggerAutofill(): Promise<void> {
  const tab = await queryActiveTab();
  if (!tab || !tab.id) return;

  autofillBtn.disabled = true;
  insAutofillBtn.disabled = true;
  statusMsg.textContent = "Scanning and autofilling page...";
  showToast("Scanning and filling page...");

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
      showToast("✓ Autofill completed!");
    }
  } catch {
    statusMsg.textContent = "Could not connect to page. Please reload the Workday tab (F5) and try again.";
    showToast("Could not connect to page.", true);
  } finally {
    autofillBtn.disabled = false;
    insAutofillBtn.disabled = false;
  }
}

autofillBtn.addEventListener("click", () => void triggerAutofill());
insAutofillBtn.addEventListener("click", () => void triggerAutofill());

// Save to Profile in Popup Inspector
insSaveProfileBtn.addEventListener("click", async () => {
  const tab = await queryActiveTab();
  if (!tab || !tab.id) return;

  insSaveProfileBtn.disabled = true;
  insSaveProfileBtn.textContent = "Saving...";

  const inputs = popupFieldsList.querySelectorAll<HTMLInputElement>(".ins-field-input:not([disabled])");
  const entries: Array<{ fieldId: string; label: string; value: string }> = [];
  inputs.forEach((input) => {
    const val = input.value.trim();
    const label = input.getAttribute("data-label") || "";
    const fieldId = input.getAttribute("data-field-id") || "";
    if (val && label) {
      entries.push({ fieldId, label, value: val });
    }
  });

  try {
    let res: any;
    try {
      res = await chrome.tabs.sendMessage(tab.id, {
        type: "SAVE_PAGE_VALUES",
        entries
      });
    } catch {
      await ensureContentScript(tab.id);
      res = await chrome.tabs.sendMessage(tab.id, {
        type: "SAVE_PAGE_VALUES",
        entries
      });
    }

    showToast(`✓ Saved ${res?.count || entries.length} values to Profile!`);
  } catch {
    showToast("Error saving values.", true);
  } finally {
    insSaveProfileBtn.disabled = false;
    insSaveProfileBtn.textContent = "💾 Save to Profile";
  }
});

// Learn from page
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
      }, 1000);
    } else {
      statusMsg.textContent = "No filled values detected on page. Fill out your details on the form first, then click Learn!";
    }
  } catch {
    statusMsg.textContent = "Could not learn from page. Please refresh the page.";
  } finally {
    learnPageBtn.disabled = false;
  }
});

insLearnBtn.addEventListener("click", async () => {
  const tab = await queryActiveTab();
  if (!tab || !tab.id) return;

  insLearnBtn.disabled = true;
  insLearnBtn.textContent = "Extracting...";

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
      showToast(`✓ Extracted & saved ${res.learnedCount} fields!`);
      setTimeout(() => {
        void initPopup();
      }, 1000);
    } else {
      showToast("No filled values found on page.", true);
    }
  } catch {
    showToast("Error extracting values.", true);
  } finally {
    insLearnBtn.disabled = false;
    insLearnBtn.textContent = "📥 Extract from Form";
  }
});

if (forgetPageBtn) {
  forgetPageBtn.addEventListener("click", async () => {
    const tab = await queryActiveTab();
    if (!tab || !tab.id) return;

    forgetPageBtn.disabled = true;
    statusMsg.textContent = "Resetting and forgetting page mappings...";

    try {
      let res: ForgetPageResponse | undefined;
      try {
        res = (await chrome.tabs.sendMessage(tab.id, {
          type: "FORGET_PAGE"
        })) as ForgetPageResponse | undefined;
      } catch {
        await ensureContentScript(tab.id);
        res = (await chrome.tabs.sendMessage(tab.id, {
          type: "FORGET_PAGE"
        })) as ForgetPageResponse | undefined;
      }

      statusMsg.textContent = `✓ Reset inputs and cleared custom mappings for this page.`;
      setTimeout(() => {
        void initPopup();
      }, 1000);
    } catch {
      statusMsg.textContent = "Could not reset page mappings.";
    } finally {
      forgetPageBtn.disabled = false;
    }
  });
}

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
