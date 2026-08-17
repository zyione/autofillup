import type { FieldFillResult, UnknownFieldInfo, UserProfile } from "../../shared/types";
import type { LearnResult, FieldSaveEntry } from "../learning/page-learner";
import { getProfileValueByPath } from "../mapping/mapping-engine";

export interface OverlayOptions {
  outcomes: FieldFillResult[];
  unknownFields: UnknownFieldInfo[];
  profile: UserProfile;
  onTeach: (fieldId: string, source: any, valueOrPath: string, fixedValue?: string, enteredValue?: string) => Promise<void>;
  onLearnPage: () => Promise<LearnResult>;
  onSavePageValues: (entries: FieldSaveEntry[], autofillAfterSave?: boolean) => Promise<number>;
  onForgetPage: () => Promise<{ removedCount: number }>;
  onClose: () => void;
  onRefill: () => void;
}

export class AssistantOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private activeTab: "inspector" | "autofill" = "inspector";

  show(options: OverlayOptions): void {
    this.remove();

    this.host = document.createElement("div");
    this.host.id = "autofillup-host";
    this.host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;";
    this.shadow = this.host.attachShadow({ mode: "open" });

    const counts = options.outcomes.reduce<Record<string, number>>((acc, item) => {
      acc[item.outcome] = (acc[item.outcome] ?? 0) + 1;
      return acc;
    }, {});

    const style = document.createElement("style");
    style.textContent = `
      .card {
        background: #0f172a;
        color: #f8fafc;
        border-radius: 14px;
        box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.6), 0 10px 15px -6px rgba(0, 0, 0, 0.5);
        border: 1px solid #334155;
        width: 395px;
        overflow: hidden;
        animation: slideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(14px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .header {
        padding: 10px 14px;
        background: #1e293b;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #334155;
      }
      .tab-nav {
        display: flex;
        gap: 4px;
      }
      .tab-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .tab-btn.active {
        background: #0f172a;
        color: #38bdf8;
        border: 1px solid #334155;
      }
      .tab-btn:hover:not(.active) {
        color: #f1f5f9;
        background: rgba(255, 255, 255, 0.05);
      }
      .close-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 17px;
        line-height: 1;
        padding: 4px;
        border-radius: 4px;
      }
      .close-btn:hover {
        color: #fff;
        background: #334155;
      }
      .body {
        padding: 12px 14px;
        max-height: 470px;
        overflow-y: auto;
      }
      
      .tab-pane {
        display: none;
      }
      .tab-pane.active {
        display: block;
      }

      /* Inspector Tab Styles */
      .action-banner {
        display: flex;
        gap: 6px;
        margin-bottom: 10px;
      }
      .btn-quick-learn {
        flex: 1;
        background: #065f46;
        color: #34d399;
        border: 1px solid #059669;
        border-radius: 6px;
        padding: 6px 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
      .btn-quick-learn:hover {
        background: #047857;
        color: #fff;
      }
      .btn-save-profile {
        flex: 1;
        background: #0284c7;
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 6px 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
      .btn-save-profile:hover {
        background: #0369a1;
      }

      .fields-table-container {
        border: 1px solid #334155;
        border-radius: 8px;
        background: #131d31;
        overflow: hidden;
      }
      .fields-table-header {
        padding: 6px 10px;
        background: #1e293b;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        font-weight: 600;
        color: #94a3b8;
        border-bottom: 1px solid #334155;
      }
      .fields-list {
        max-height: 250px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      .field-item {
        padding: 8px 10px;
        border-bottom: 1px solid #1e293b;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .field-item.is-ignored {
        opacity: 0.6;
        background: rgba(0, 0, 0, 0.15);
      }
      .field-item:last-child {
        border-bottom: none;
      }
      .field-item:hover {
        background: rgba(255, 255, 255, 0.02);
      }
      .field-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
      }
      .field-label {
        font-weight: 600;
        color: #f1f5f9;
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .field-badges {
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .field-kind-badge {
        font-size: 9px;
        text-transform: uppercase;
        color: #64748b;
        background: #0f172a;
        padding: 1px 5px;
        border-radius: 4px;
      }
      .field-ignored-badge {
        font-size: 9px;
        font-weight: 700;
        color: #f87171;
        background: #450a0a;
        border: 1px solid #991b1b;
        padding: 1px 5px;
        border-radius: 4px;
      }
      .field-input-row {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .field-input {
        flex: 1;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 5px;
        padding: 5px 8px;
        color: #38bdf8;
        font-size: 12px;
        outline: none;
        box-sizing: border-box;
      }
      .field-input:focus {
        border-color: #0284c7;
        background: #172554;
      }
      .field-input:disabled {
        color: #64748b;
        background: #090e1a;
        cursor: not-allowed;
      }
      .field-input::placeholder {
        color: #64748b;
        font-style: italic;
      }
      .btn-row-save {
        background: #334155;
        color: #f8fafc;
        border: none;
        border-radius: 4px;
        padding: 5px 7px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 600;
      }
      .btn-row-save:hover:not(:disabled) {
        background: #0284c7;
      }
      .btn-row-teach {
        background: #4c1d95;
        color: #c084fc;
        border: none;
        border-radius: 4px;
        padding: 5px 7px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 600;
      }
      .btn-row-teach:hover {
        background: #6b21a8;
        color: #fff;
      }

      /* Autofill Tab Styles */
      .stats {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      .badge {
        font-size: 11px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 9999px;
      }
      .badge-filled { background: #064e3b; color: #34d399; }
      .badge-review { background: #78350f; color: #fbbf24; }
      .badge-unknown { background: #4c1d95; color: #c084fc; }
      .badge-skipped { background: #334155; color: #94a3b8; }

      .autofill-action-card {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 14px;
        text-align: center;
        margin-bottom: 12px;
      }
      .btn-autofill-main {
        width: 100%;
        background: #0284c7;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .btn-autofill-main:hover {
        background: #0369a1;
      }

      .toast {
        background: #065f46;
        color: #34d399;
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 11px;
        margin-bottom: 10px;
        border: 1px solid #059669;
        display: none;
        line-height: 1.4;
      }

      .footer {
        padding: 10px 14px;
        background: #1e293b;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #334155;
        font-size: 11px;
      }
      .forget-btn {
        background: transparent;
        color: #f87171;
        border: 1px solid #7f1d1d;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 11px;
      }
      .forget-btn:hover {
        background: #991b1b;
        color: #fff;
      }

      /* Modal for Teaching */
      .modal-backdrop {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
      }
      .modal {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 20px;
        width: 360px;
        color: #f8fafc;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.7);
      }
      .modal h4 { margin: 0 0 8px 0; color: #38bdf8; font-size: 15px; }
      .modal label { display: block; font-size: 12px; color: #94a3b8; margin-top: 10px; margin-bottom: 4px; }
      .modal select, .modal input {
        width: 100%;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 8px;
        color: #fff;
        font-size: 13px;
        box-sizing: border-box;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }
      .modal-btn {
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        border: none;
      }
      .modal-btn-cancel { background: #334155; color: #fff; }
      .modal-btn-save { background: #0284c7; color: #fff; font-weight: 600; }
    `;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="header">
        <div class="tab-nav">
          <button class="tab-btn ${this.activeTab === "inspector" ? "active" : ""}" data-tab="inspector">
            🔍 Page Inspector
          </button>
          <button class="tab-btn ${this.activeTab === "autofill" ? "active" : ""}" data-tab="autofill">
            ⚡ Autofill
          </button>
        </div>
        <button class="close-btn" title="Close status">×</button>
      </div>

      <div class="body">
        <div id="toast-msg" class="toast"></div>

        <!-- 1. Inspector Tab (Edit & Save to Profile first without autofilling) -->
        <div id="tab-inspector" class="tab-pane ${this.activeTab === "inspector" ? "active" : ""}">
          <div class="action-banner">
            <button id="learn-page-btn" class="btn-quick-learn" title="Pull values currently typed into the Workday form into this editor">
              📥 Extract from Form
            </button>
            <button id="save-profile-btn" class="btn-save-profile" title="Save all values to your profile & mappings without modifying the page">
              💾 Save to Profile
            </button>
          </div>

          <div class="fields-table-container">
            <div class="fields-table-header">
              <span>Detected Page Fields (${options.outcomes.length})</span>
              <span style="font-size:10px;color:#38bdf8;">Edit & Save Values</span>
            </div>
            <div class="fields-list" id="fields-list">
              ${options.outcomes
                .map((item) => {
                  let domVal = "";
                  try {
                    const el = document.getElementById(item.fieldId) || document.querySelector(`[name="${CSS.escape(item.fieldId)}"]`);
                    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                      domVal = el.value.trim();
                    } else if (el?.textContent) {
                      const txt = el.textContent.trim();
                      if (!txt.startsWith("Select") && txt !== "Choose...") domVal = txt;
                    }
                  } catch {}

                  const isIgnored = item.mappingSource === "ignore" || item.outcome === "skipped";
                  const initialVal = isIgnored ? "" : item.valueAttempted || domVal || "";
                  const isUnknown = !isIgnored && (item.outcome === "unknown" || item.outcome === "review" || !initialVal);

                  return `
                    <div class="field-item ${isIgnored ? 'is-ignored' : ''}" data-id="${item.fieldId}">
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
                          class="field-input" 
                          data-field-id="${item.fieldId}" 
                          data-label="${item.label}" 
                          placeholder="${isIgnored ? 'Permanently ignored (skipped)' : (isUnknown ? 'Type answer to save...' : 'Value to fill')}" 
                          value="${initialVal.replace(/"/g, "&quot;")}"
                          ${isIgnored ? 'disabled' : ''}
                        />
                        <button class="btn-row-save" data-field-id="${item.fieldId}" data-label="${item.label}" title="Save this value to Profile" ${isIgnored ? 'disabled' : ''}>💾</button>
                        <button class="btn-row-teach" data-field-id="${item.fieldId}" title="Advanced teach / map / ignore options">⚙</button>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
        </div>

        <!-- 2. Autofill Tab (Status overview & execute autofill) -->
        <div id="tab-autofill" class="tab-pane ${this.activeTab === "autofill" ? "active" : ""}">
          <div class="stats">
            ${counts.filled ? `<span class="badge badge-filled">✓ ${counts.filled} Filled</span>` : ""}
            ${counts.review ? `<span class="badge badge-review">⚠ ${counts.review} Review</span>` : ""}
            ${counts.unknown ? `<span class="badge badge-unknown">? ${counts.unknown} Unknown</span>` : ""}
            ${counts.skipped ? `<span class="badge badge-skipped">${counts.skipped} Skipped</span>` : ""}
            ${!options.outcomes.length ? `<span class="badge badge-skipped">No inputs found</span>` : ""}
          </div>

          <div class="autofill-action-card">
            <p style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Ready to populate all matching fields into the current application form.</p>
            <button id="autofill-main-btn" class="btn-autofill-main">⚡ Autofill Page Now</button>
          </div>
        </div>
      </div>

      <div class="footer">
        <button class="forget-btn" id="forget-btn" title="Clear form inputs and forget custom mappings for this page">🔄 Forget Page</button>
        <span style="color:#64748b;">Local & Privacy-Safe</span>
      </div>
    `;

    this.shadow.appendChild(style);
    this.shadow.appendChild(card);

    const toast = card.querySelector<HTMLDivElement>("#toast-msg")!;
    const learnBtn = card.querySelector<HTMLButtonElement>("#learn-page-btn");
    const saveProfileBtn = card.querySelector<HTMLButtonElement>("#save-profile-btn");
    const autofillMainBtn = card.querySelector<HTMLButtonElement>("#autofill-main-btn");
    const forgetBtn = card.querySelector<HTMLButtonElement>("#forget-btn");

    // Tab switching handlers
    card.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab") as "inspector" | "autofill";
        this.activeTab = tab;
        card.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        card.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));

        btn.classList.add("active");
        const targetPane = card.querySelector(`#tab-${tab}`);
        if (targetPane) targetPane.classList.add("active");
      });
    });

    // Handle "Save to Profile" (Saves to storage WITHOUT modifying the webpage)
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener("click", async () => {
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = "Saving to Profile...";

        const inputs = card.querySelectorAll<HTMLInputElement>(".field-input:not([disabled])");
        const entries: FieldSaveEntry[] = [];
        inputs.forEach((input) => {
          const val = input.value.trim();
          const label = input.getAttribute("data-label") || "";
          const fieldId = input.getAttribute("data-field-id") || "";
          if (val && label) {
            entries.push({ fieldId, label, value: val });
          }
        });

        try {
          const count = await options.onSavePageValues(entries, false);
          toast.textContent = `✓ Saved ${count} values to Profile & Mappings! (Page not modified)`;
          toast.style.display = "block";
          saveProfileBtn.disabled = false;
          saveProfileBtn.textContent = "💾 Save to Profile";
        } catch {
          toast.textContent = "Error saving values.";
          toast.style.display = "block";
          saveProfileBtn.disabled = false;
          saveProfileBtn.textContent = "💾 Save to Profile";
        }
      });
    }

    // Handle "Autofill Page Now"
    if (autofillMainBtn) {
      autofillMainBtn.addEventListener("click", () => {
        options.onRefill();
      });
    }

    // Handle individual row save button (💾)
    card.querySelectorAll<HTMLButtonElement>(".btn-row-save").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const fieldId = btn.getAttribute("data-field-id");
        const label = btn.getAttribute("data-label") || "";
        const input = card.querySelector<HTMLInputElement>(`.field-input[data-field-id="${CSS.escape(fieldId || "")}"]`);
        const val = input?.value.trim() || "";

        if (!val) {
          toast.textContent = `Please enter a value for "${label}" before saving.`;
          toast.style.display = "block";
          return;
        }

        btn.disabled = true;
        try {
          await options.onSavePageValues([{ fieldId: fieldId || "", label, value: val }], false);
          toast.textContent = `✓ Saved "${label}" = "${val}" to profile`;
          toast.style.display = "block";
          btn.disabled = false;
        } catch {
          toast.textContent = `Error saving ${label}`;
          toast.style.display = "block";
          btn.disabled = false;
        }
      });
    });

    // Handle "Extract from Form"
    if (learnBtn) {
      learnBtn.addEventListener("click", async () => {
        learnBtn.disabled = true;
        learnBtn.textContent = "Extracting...";
        try {
          const res = await options.onLearnPage();
          if (res && res.learnedCount > 0) {
            const allItems = res.profileFieldsUpdated.concat(res.mappingsCreated);
            const breakdown = allItems.slice(0, 5).map((item) => `• ${item}`).join("<br/>");
            const extra = allItems.length > 5 ? `<br/>...and ${allItems.length - 5} more` : "";

            toast.innerHTML = `<strong>✓ Extracted & Saved ${res.learnedCount} Field(s):</strong><br/>${breakdown}${extra}`;
            toast.style.display = "block";
            learnBtn.disabled = false;
            learnBtn.textContent = "📥 Extract from Form";
          } else {
            toast.textContent = "No filled values detected on form yet. Type values on the form first!";
            toast.style.display = "block";
            learnBtn.textContent = "📥 Extract from Form";
            learnBtn.disabled = false;
          }
        } catch {
          toast.textContent = "Error extracting from form.";
          toast.style.display = "block";
          learnBtn.disabled = false;
        }
      });
    }

    // Handle "Forget Page"
    if (forgetBtn) {
      forgetBtn.addEventListener("click", async () => {
        forgetBtn.disabled = true;
        forgetBtn.textContent = "Resetting...";
        try {
          await options.onForgetPage();
          toast.textContent = "✓ Reset form inputs and forgot custom mappings for this page.";
          toast.style.display = "block";
          setTimeout(() => {
            options.onRefill();
          }, 800);
        } catch {
          toast.textContent = "Error resetting page.";
          toast.style.display = "block";
          forgetBtn.disabled = false;
        }
      });
    }

    card.querySelector(".close-btn")?.addEventListener("click", () => this.remove());

    // Handle advanced teach button (⚙)
    card.querySelectorAll<HTMLButtonElement>(".btn-row-teach").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-field-id");
        const found = options.outcomes.find((o) => o.fieldId === id);
        const unknownField = options.unknownFields.find((f) => f.fieldId === id) || {
          fieldId: id || "",
          label: found?.label || btn.closest(".field-item")?.querySelector(".field-label")?.textContent || "Field",
          accessibleName: "",
          placeholder: "",
          kind: (found?.kind || "text") as any,
          section: "",
          options: [],
          detectedAt: new Date().toISOString()
        };
        this.showTeachModal(unknownField, options);
      });
    });

    const target = document.body || document.documentElement;
    if (target) {
      target.appendChild(this.host);
    }
  }

  private showTeachModal(field: UnknownFieldInfo, options: OverlayOptions): void {
    if (!this.shadow) return;

    let pageCurrentValue = "";
    try {
      const el = document.getElementById(field.fieldId) || document.querySelector(`[name="${CSS.escape(field.fieldId)}"]`);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        pageCurrentValue = el.value.trim();
      }
    } catch {}

    let defaultProfilePath = "personal.firstName";
    const labelLower = field.label.toLowerCase();
    if (labelLower.includes("last")) defaultProfilePath = "personal.lastName";
    else if (labelLower.includes("middle")) defaultProfilePath = "personal.middleName";
    else if (labelLower.includes("email") || labelLower.includes("e-mail")) defaultProfilePath = "contact.email";
    else if (labelLower.includes("phone") && !labelLower.includes("code")) defaultProfilePath = "contact.phone";
    else if (labelLower.includes("address") || labelLower.includes("street")) defaultProfilePath = "contact.address";
    else if (labelLower.includes("city")) defaultProfilePath = "contact.city";
    else if (labelLower.includes("state") || labelLower.includes("province")) defaultProfilePath = "contact.state";
    else if (labelLower.includes("zip") || labelLower.includes("postal")) defaultProfilePath = "contact.postalCode";
    else if (labelLower.includes("country") && !labelLower.includes("code") && !labelLower.includes("phone")) defaultProfilePath = "contact.country";
    else if (labelLower.includes("linkedin")) defaultProfilePath = "professional.linkedin";
    else if (labelLower.includes("github")) defaultProfilePath = "professional.github";
    else if (labelLower.includes("portfolio")) defaultProfilePath = "professional.portfolio";
    else if (labelLower.includes("website")) defaultProfilePath = "professional.website";

    const currentProfileVal = getProfileValueByPath(options.profile, defaultProfilePath) || pageCurrentValue;

    const modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modal-backdrop";
    modalBackdrop.innerHTML = `
      <div class="modal">
        <h4>Advanced Mapping: "${field.label}"</h4>
        <p style="font-size:12px;color:#94a3b8;margin:0 0 12px 0;">Configure custom profile mapping or fixed response rule.</p>
        
        <label>Mapping Target</label>
        <select id="source-type">
          <option value="profile">Personal / Contact Profile</option>
          <option value="fixedValue">Fixed Value (Exact Answer)</option>
          <option value="applicationAnswer">Application Answer</option>
          <option value="customField">Custom Profile Field</option>
          <option value="ignore">Ignore Permanently</option>
        </select>

        <div id="dynamic-inputs">
          <label>Profile Field</label>
          <select id="profile-path">
            <option value="personal.firstName" ${defaultProfilePath === "personal.firstName" ? "selected" : ""}>First Name</option>
            <option value="personal.middleName" ${defaultProfilePath === "personal.middleName" ? "selected" : ""}>Middle Name</option>
            <option value="personal.lastName" ${defaultProfilePath === "personal.lastName" ? "selected" : ""}>Last Name</option>
            <option value="personal.preferredName" ${defaultProfilePath === "personal.preferredName" ? "selected" : ""}>Preferred Name</option>
            <option value="contact.email" ${defaultProfilePath === "contact.email" ? "selected" : ""}>Email Address</option>
            <option value="contact.phone" ${defaultProfilePath === "contact.phone" ? "selected" : ""}>Phone Number</option>
            <option value="contact.address" ${defaultProfilePath === "contact.address" ? "selected" : ""}>Address Line</option>
            <option value="contact.city" ${defaultProfilePath === "contact.city" ? "selected" : ""}>City</option>
            <option value="contact.state" ${defaultProfilePath === "contact.state" ? "selected" : ""}>State / Province</option>
            <option value="contact.postalCode" ${defaultProfilePath === "contact.postalCode" ? "selected" : ""}>Postal Code</option>
            <option value="contact.country" ${defaultProfilePath === "contact.country" ? "selected" : ""}>Country</option>
            <option value="professional.linkedin" ${defaultProfilePath === "professional.linkedin" ? "selected" : ""}>LinkedIn</option>
            <option value="professional.github" ${defaultProfilePath === "professional.github" ? "selected" : ""}>GitHub</option>
            <option value="professional.portfolio" ${defaultProfilePath === "professional.portfolio" ? "selected" : ""}>Portfolio</option>
            <option value="professional.website" ${defaultProfilePath === "professional.website" ? "selected" : ""}>Website</option>
          </select>

          <label style="margin-top:8px;">Value to save for this profile field:</label>
          <input type="text" id="entered-val-input" placeholder="e.g. Jane" value="${currentProfileVal}"/>
        </div>

        <div class="modal-actions">
          <button class="modal-btn modal-btn-cancel" id="modal-cancel">Cancel</button>
          <button class="modal-btn modal-btn-save" id="modal-save">Save & Map</button>
        </div>
      </div>
    `;

    const sourceType = modalBackdrop.querySelector<HTMLSelectElement>("#source-type")!;
    const dynamicInputs = modalBackdrop.querySelector<HTMLDivElement>("#dynamic-inputs")!;

    const renderInputsForType = (type: string) => {
      if (type === "profile") {
        dynamicInputs.innerHTML = `
          <label>Profile Field</label>
          <select id="profile-path">
            <option value="personal.firstName" ${defaultProfilePath === "personal.firstName" ? "selected" : ""}>First Name</option>
            <option value="personal.middleName" ${defaultProfilePath === "personal.middleName" ? "selected" : ""}>Middle Name</option>
            <option value="personal.lastName" ${defaultProfilePath === "personal.lastName" ? "selected" : ""}>Last Name</option>
            <option value="personal.preferredName" ${defaultProfilePath === "personal.preferredName" ? "selected" : ""}>Preferred Name</option>
            <option value="contact.email" ${defaultProfilePath === "contact.email" ? "selected" : ""}>Email Address</option>
            <option value="contact.phone" ${defaultProfilePath === "contact.phone" ? "selected" : ""}>Phone Number</option>
            <option value="contact.address" ${defaultProfilePath === "contact.address" ? "selected" : ""}>Address Line</option>
            <option value="contact.city" ${defaultProfilePath === "contact.city" ? "selected" : ""}>City</option>
            <option value="contact.state" ${defaultProfilePath === "contact.state" ? "selected" : ""}>State / Province</option>
            <option value="contact.postalCode" ${defaultProfilePath === "contact.postalCode" ? "selected" : ""}>Postal Code</option>
            <option value="contact.country" ${defaultProfilePath === "contact.country" ? "selected" : ""}>Country</option>
            <option value="professional.linkedin" ${defaultProfilePath === "professional.linkedin" ? "selected" : ""}>LinkedIn</option>
            <option value="professional.github" ${defaultProfilePath === "professional.github" ? "selected" : ""}>GitHub</option>
            <option value="professional.portfolio" ${defaultProfilePath === "professional.portfolio" ? "selected" : ""}>Portfolio</option>
            <option value="professional.website" ${defaultProfilePath === "professional.website" ? "selected" : ""}>Website</option>
          </select>

          <label style="margin-top:8px;">Value to save for this profile field:</label>
          <input type="text" id="entered-val-input" placeholder="e.g. Jane" value="${currentProfileVal}"/>
        `;

        const pathSelect = dynamicInputs.querySelector<HTMLSelectElement>("#profile-path");
        const valInput = dynamicInputs.querySelector<HTMLInputElement>("#entered-val-input");
        if (pathSelect && valInput) {
          pathSelect.addEventListener("change", () => {
            const pathVal = getProfileValueByPath(options.profile, pathSelect.value);
            if (pathVal) {
              valInput.value = pathVal;
            }
          });
        }
      } else if (type === "customField") {
        const customOptions = options.profile.customFields
          .map((c) => `<option value="${c.id}">${c.name}</option>`)
          .join("");
        dynamicInputs.innerHTML = `
          <label>Custom Field</label>
          <select id="custom-field-id">
            ${customOptions || `<option value="">No custom fields created</option>`}
          </select>
        `;
      } else if (type === "applicationAnswer") {
        const answerOptions = options.profile.applicationAnswers
          .map((a) => `<option value="${a.id}">${a.name} (${a.value})</option>`)
          .join("");
        dynamicInputs.innerHTML = `
          <label>Application Answer</label>
          <select id="answer-id">
            ${answerOptions || `<option value="">No application answers created</option>`}
          </select>
          <label style="margin-top:8px;">Value / Answer:</label>
          <input type="text" id="entered-val-input" placeholder="e.g. Yes" value="${pageCurrentValue}"/>
        `;
      } else if (type === "fixedValue") {
        dynamicInputs.innerHTML = `
          <label>Fixed Value / Answer:</label>
          <input type="text" id="fixed-val-input" placeholder="e.g. Yes, No, or standard answer" value="${pageCurrentValue}"/>
        `;
      } else if (type === "ignore") {
        dynamicInputs.innerHTML = `
          <div style="background:#450a0a;border:1px solid #991b1b;border-radius:6px;padding:8px 10px;margin-top:10px;">
            <strong style="color:#f87171;font-size:12px;">🚫 Ignore Permanently</strong>
            <p style="font-size:11px;color:#fca5a5;margin:4px 0 0 0;">AutoFillUp will never autofill this field and will skip it across all job applications.</p>
          </div>
        `;
      }
    };

    sourceType.addEventListener("change", () => {
      renderInputsForType(sourceType.value);
    });

    modalBackdrop.querySelector("#modal-cancel")?.addEventListener("click", () => {
      modalBackdrop.remove();
    });

    modalBackdrop.querySelector("#modal-save")?.addEventListener("click", () => {
      const type = sourceType.value as any;
      let pathOrValue = "";
      let fixedVal: string | undefined;
      let enteredVal: string | undefined;

      if (type === "profile") {
        pathOrValue = modalBackdrop.querySelector<HTMLSelectElement>("#profile-path")?.value || "";
        enteredVal = modalBackdrop.querySelector<HTMLInputElement>("#entered-val-input")?.value || "";
      } else if (type === "customField") {
        pathOrValue = modalBackdrop.querySelector<HTMLSelectElement>("#custom-field-id")?.value || "";
      } else if (type === "applicationAnswer") {
        pathOrValue = modalBackdrop.querySelector<HTMLSelectElement>("#answer-id")?.value || "";
        enteredVal = modalBackdrop.querySelector<HTMLInputElement>("#entered-val-input")?.value || "";
      } else if (type === "fixedValue") {
        fixedVal = modalBackdrop.querySelector<HTMLInputElement>("#fixed-val-input")?.value || "";
        pathOrValue = fixedVal;
        enteredVal = fixedVal;
      } else if (type === "ignore") {
        pathOrValue = "";
      }

      modalBackdrop.remove();
      void options.onTeach(field.fieldId, type, pathOrValue, fixedVal, enteredVal);
    });

    this.shadow.appendChild(modalBackdrop);
  }

  remove(): void {
    if (this.host) {
      this.host.remove();
      this.host = null;
      this.shadow = null;
    }
  }
}
