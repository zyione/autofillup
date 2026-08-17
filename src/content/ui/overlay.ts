import type { FieldFillResult, UnknownFieldInfo, UserProfile } from "../../shared/types";
import type { LearnResult } from "../learning/page-learner";
import { getProfileValueByPath } from "../mapping/mapping-engine";

export interface OverlayOptions {
  outcomes: FieldFillResult[];
  unknownFields: UnknownFieldInfo[];
  profile: UserProfile;
  onTeach: (fieldId: string, source: any, valueOrPath: string, fixedValue?: string, enteredValue?: string) => Promise<void>;
  onLearnPage: () => Promise<LearnResult>;
  onForgetPage: () => Promise<{ removedCount: number }>;
  onClose: () => void;
  onRefill: () => void;
}

export class AssistantOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;

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
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
        border: 1px solid #334155;
        width: 340px;
        overflow: hidden;
        animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(12px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .header {
        padding: 12px 16px;
        background: #1e293b;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #334155;
      }
      .header h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: #38bdf8;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .close-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 4px;
        border-radius: 4px;
      }
      .close-btn:hover {
        color: #fff;
        background: #334155;
      }
      .body {
        padding: 14px 16px;
      }
      .stats {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      .badge {
        font-size: 11px;
        font-weight: 500;
        padding: 3px 8px;
        border-radius: 9999px;
      }
      .badge-filled { background: #064e3b; color: #34d399; }
      .badge-review { background: #78350f; color: #fbbf24; }
      .badge-unknown { background: #4c1d95; color: #c084fc; }
      .badge-skipped { background: #334155; color: #94a3b8; }
      
      .learn-banner {
        background: #064e3b;
        border: 1px solid #059669;
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .learn-banner span {
        font-size: 11px;
        color: #a7f3d0;
      }
      .learn-btn {
        background: #10b981;
        color: #064e3b;
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .learn-btn:hover {
        background: #34d399;
      }

      .unknown-list {
        margin-top: 10px;
        border-top: 1px solid #334155;
        padding-top: 10px;
        max-height: 200px;
        overflow-y: auto;
      }
      .unknown-list-header {
        font-size: 11px;
        color: #94a3b8;
        margin-bottom: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .unknown-item {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 8px 10px;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        gap: 8px;
      }
      .unknown-item-label {
        max-width: 190px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #f1f5f9;
      }
      .teach-btn {
        background: #0284c7;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 600;
        white-space: nowrap;
      }
      .teach-btn:hover { background: #0369a1; }
      
      .toast {
        background: #065f46;
        color: #34d399;
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 11px;
        margin-bottom: 10px;
        border: 1px solid #059669;
        display: none;
      }

      .footer {
        padding: 10px 16px;
        background: #1e293b;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #334155;
        font-size: 11px;
        gap: 6px;
      }
      .footer-actions {
        display: flex;
        gap: 6px;
      }
      .refill-btn {
        background: #334155;
        color: #f8fafc;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
      }
      .refill-btn:hover { background: #475569; }

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
        <h3>⚡ AutoFillUp Assistant</h3>
        <button class="close-btn" title="Close status">×</button>
      </div>
      <div class="body">
        <div id="toast-msg" class="toast"></div>

        <div class="stats">
          ${counts.filled ? `<span class="badge badge-filled">✓ ${counts.filled} Filled</span>` : ""}
          ${counts.review ? `<span class="badge badge-review">⚠ ${counts.review} Review</span>` : ""}
          ${counts.unknown ? `<span class="badge badge-unknown">? ${counts.unknown} Unknown</span>` : ""}
          ${counts.skipped ? `<span class="badge badge-skipped">${counts.skipped} Skipped</span>` : ""}
          ${!options.outcomes.length ? `<span class="badge badge-skipped">No inputs found</span>` : ""}
        </div>

        <div class="learn-banner">
          <span>💡 Fill this form on the page once, then click below:</span>
          <button id="learn-page-btn" class="learn-btn">💾 Learn & Save Page to Profile</button>
        </div>

        ${
          options.unknownFields.length
            ? `<div class="unknown-list">
                <div class="unknown-list-header">
                  <strong>Unknown & Review Fields (${options.unknownFields.length}):</strong>
                </div>
                ${options.unknownFields
                  .map(
                    (f) => `
                    <div class="unknown-item">
                      <span class="unknown-item-label" title="${f.label}">${f.label}</span>
                      <button class="teach-btn" data-id="${f.fieldId}">Teach</button>
                    </div>
                  `
                  )
                  .join("")}
              </div>`
            : ""
        }
      </div>
      <div class="footer">
        <button class="forget-btn" id="forget-btn" title="Clear form inputs and forget custom mappings for this page">🔄 Forget Page</button>
        <div class="footer-actions">
          <button class="refill-btn" id="refill-btn">Rescan & Fill</button>
        </div>
      </div>
    `;

    this.shadow.appendChild(style);
    this.shadow.appendChild(card);

    const toast = card.querySelector<HTMLDivElement>("#toast-msg")!;
    const learnBtn = card.querySelector<HTMLButtonElement>("#learn-page-btn");
    const forgetBtn = card.querySelector<HTMLButtonElement>("#forget-btn");

    if (learnBtn) {
      learnBtn.addEventListener("click", async () => {
        learnBtn.disabled = true;
        learnBtn.textContent = "Scanning & Learning...";
        try {
          const res = await options.onLearnPage();
          if (res && res.learnedCount > 0) {
            toast.textContent = `✓ Successfully learned ${res.learnedCount} field(s) into your profile & mappings!`;
            toast.style.display = "block";
            setTimeout(() => {
              options.onRefill();
            }, 1000);
          } else {
            toast.textContent = "No filled values detected on page yet. Type in your details first!";
            toast.style.display = "block";
            learnBtn.textContent = "💾 Learn & Save Page to Profile";
            learnBtn.disabled = false;
          }
        } catch {
          toast.textContent = "Error learning from page.";
          toast.style.display = "block";
          learnBtn.disabled = false;
        }
      });
    }

    if (forgetBtn) {
      forgetBtn.addEventListener("click", async () => {
        forgetBtn.disabled = true;
        forgetBtn.textContent = "Resetting...";
        try {
          await options.onForgetPage();
          toast.textContent = "✓ Reset form and forgot custom mappings for this page.";
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
    card.querySelector("#refill-btn")?.addEventListener("click", () => options.onRefill());

    card.querySelectorAll<HTMLButtonElement>(".teach-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const unknownField = options.unknownFields.find((f) => f.fieldId === id);
        if (unknownField) {
          this.showTeachModal(unknownField, options);
        }
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
    else if (labelLower.includes("phone") || labelLower.includes("mobile") || labelLower.includes("cell")) defaultProfilePath = "contact.phone";
    else if (labelLower.includes("address") || labelLower.includes("street")) defaultProfilePath = "contact.address";
    else if (labelLower.includes("city")) defaultProfilePath = "contact.city";
    else if (labelLower.includes("state") || labelLower.includes("province")) defaultProfilePath = "contact.state";
    else if (labelLower.includes("zip") || labelLower.includes("postal")) defaultProfilePath = "contact.postalCode";
    else if (labelLower.includes("country")) defaultProfilePath = "contact.country";
    else if (labelLower.includes("linkedin")) defaultProfilePath = "professional.linkedin";
    else if (labelLower.includes("github")) defaultProfilePath = "professional.github";
    else if (labelLower.includes("portfolio")) defaultProfilePath = "professional.portfolio";
    else if (labelLower.includes("website")) defaultProfilePath = "professional.website";

    const currentProfileVal = getProfileValueByPath(options.profile, defaultProfilePath) || pageCurrentValue;

    const modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modal-backdrop";
    modalBackdrop.innerHTML = `
      <div class="modal">
        <h4>Teach Field: "${field.label}"</h4>
        <p style="font-size:12px;color:#94a3b8;margin:0 0 12px 0;">Configure how AutoFillUp should fill this field now and in future applications.</p>
        
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
          <button class="modal-btn modal-btn-save" id="modal-save">Save & Fill</button>
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
      } else {
        dynamicInputs.innerHTML = `<p style="font-size:12px;color:#94a3b8;margin-top:10px;">This field will be skipped automatically on future scans.</p>`;
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
      }

      void options.onTeach(field.fieldId, type, pathOrValue, fixedVal, enteredVal).then(() => {
        modalBackdrop.remove();
        options.onRefill();
      });
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
