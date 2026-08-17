import type { FieldFillResult, UnknownFieldInfo, UserProfile } from "../../shared/types";

export interface OverlayOptions {
  outcomes: FieldFillResult[];
  unknownFields: UnknownFieldInfo[];
  profile: UserProfile;
  onTeach: (fieldId: string, source: any, valueOrPath: string, fixedValue?: string) => Promise<void>;
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
        width: 320px;
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
      
      .unknown-list {
        margin-top: 10px;
        border-top: 1px solid #334155;
        padding-top: 10px;
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
      }
      .teach-btn {
        background: #0284c7;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 500;
      }
      .teach-btn:hover { background: #0369a1; }
      .footer {
        padding: 10px 16px;
        background: #1e293b;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #334155;
        font-size: 11px;
      }
      .footer a {
        color: #38bdf8;
        text-decoration: none;
      }
      .footer a:hover { text-decoration: underline; }
      .refill-btn {
        background: #334155;
        color: #f8fafc;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
      }
      .refill-btn:hover { background: #475569; }

      /* Modal for Teaching */
      .modal-backdrop {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.6);
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
      .modal-btn-save { background: #0284c7; color: #fff; font-weight: 500; }
    `;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="header">
        <h3>AutoFillUp Assistant</h3>
        <button class="close-btn" title="Close status">×</button>
      </div>
      <div class="body">
        <div class="stats">
          ${counts.filled ? `<span class="badge badge-filled">✓ ${counts.filled} Filled</span>` : ""}
          ${counts.review ? `<span class="badge badge-review">⚠ ${counts.review} Review</span>` : ""}
          ${counts.unknown ? `<span class="badge badge-unknown">? ${counts.unknown} Unknown</span>` : ""}
          ${counts.skipped ? `<span class="badge badge-skipped">${counts.skipped} Skipped</span>` : ""}
          ${!options.outcomes.length ? `<span class="badge badge-skipped">No inputs found</span>` : ""}
        </div>
        ${
          options.unknownFields.length
            ? `<div class="unknown-list">
                <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Unknown fields to teach:</div>
                ${options.unknownFields
                  .slice(0, 3)
                  .map(
                    (f) => `
                    <div class="unknown-item">
                      <span title="${f.label}" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.label}</span>
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
        <button class="refill-btn" id="refill-btn">Rescan & Fill</button>
        <span style="color:#64748b;">Privacy-First Local</span>
      </div>
    `;

    this.shadow.appendChild(style);
    this.shadow.appendChild(card);

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

    const modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modal-backdrop";
    modalBackdrop.innerHTML = `
      <div class="modal">
        <h4>Teach Field: "${field.label}"</h4>
        <p style="font-size:12px;color:#94a3b8;margin:0 0 12px 0;">Select what profile value or answer should fill this Workday field in the future.</p>
        
        <label>Mapping Type</label>
        <select id="source-type">
          <option value="profile">Personal / Contact Profile</option>
          <option value="customField">Custom Profile Field</option>
          <option value="applicationAnswer">Application Answer</option>
          <option value="fixedValue">Fixed Value</option>
          <option value="ignore">Ignore Permanently</option>
        </select>

        <div id="dynamic-inputs">
          <label>Profile Field</label>
          <select id="profile-path">
            <option value="personal.firstName">First Name</option>
            <option value="personal.lastName">Last Name</option>
            <option value="personal.preferredName">Preferred Name</option>
            <option value="contact.email">Email Address</option>
            <option value="contact.phone">Phone Number</option>
            <option value="contact.address">Address Line</option>
            <option value="contact.city">City</option>
            <option value="contact.state">State / Province</option>
            <option value="contact.postalCode">Postal Code</option>
            <option value="contact.country">Country</option>
            <option value="professional.linkedin">LinkedIn</option>
            <option value="professional.github">GitHub</option>
            <option value="professional.portfolio">Portfolio</option>
            <option value="professional.website">Website</option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="modal-btn modal-btn-cancel" id="modal-cancel">Cancel</button>
          <button class="modal-btn modal-btn-save" id="modal-save">Save & Map</button>
        </div>
      </div>
    `;

    const sourceType = modalBackdrop.querySelector<HTMLSelectElement>("#source-type")!;
    const dynamicInputs = modalBackdrop.querySelector<HTMLDivElement>("#dynamic-inputs")!;

    sourceType.addEventListener("change", () => {
      const type = sourceType.value;
      if (type === "profile") {
        dynamicInputs.innerHTML = `
          <label>Profile Field</label>
          <select id="profile-path">
            <option value="personal.firstName">First Name</option>
            <option value="personal.lastName">Last Name</option>
            <option value="personal.preferredName">Preferred Name</option>
            <option value="contact.email">Email Address</option>
            <option value="contact.phone">Phone Number</option>
            <option value="contact.address">Address Line</option>
            <option value="contact.city">City</option>
            <option value="contact.state">State / Province</option>
            <option value="contact.postalCode">Postal Code</option>
            <option value="contact.country">Country</option>
            <option value="professional.linkedin">LinkedIn</option>
            <option value="professional.github">GitHub</option>
            <option value="professional.portfolio">Portfolio</option>
            <option value="professional.website">Website</option>
          </select>
        `;
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
        `;
      } else if (type === "fixedValue") {
        dynamicInputs.innerHTML = `
          <label>Fixed Value</label>
          <input type="text" id="fixed-val-input" placeholder="e.g. Yes, No, or standard text"/>
        `;
      } else {
        dynamicInputs.innerHTML = `<p style="font-size:12px;color:#94a3b8;margin-top:10px;">This field will be skipped automatically on future scans.</p>`;
      }
    });

    modalBackdrop.querySelector("#modal-cancel")?.addEventListener("click", () => {
      modalBackdrop.remove();
    });

    modalBackdrop.querySelector("#modal-save")?.addEventListener("click", () => {
      const type = sourceType.value as any;
      let pathOrValue = "";
      let fixedVal: string | undefined;

      if (type === "profile") {
        pathOrValue = modalBackdrop.querySelector<HTMLSelectElement>("#profile-path")?.value || "";
      } else if (type === "customField") {
        pathOrValue = modalBackdrop.querySelector<HTMLSelectElement>("#custom-field-id")?.value || "";
      } else if (type === "applicationAnswer") {
        pathOrValue = modalBackdrop.querySelector<HTMLSelectElement>("#answer-id")?.value || "";
      } else if (type === "fixedValue") {
        fixedVal = modalBackdrop.querySelector<HTMLInputElement>("#fixed-val-input")?.value || "";
        pathOrValue = fixedVal;
      }

      void options.onTeach(field.fieldId, type, pathOrValue, fixedVal).then(() => {
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
