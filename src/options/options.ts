import "./options.css";
import { ProfileStore } from "../storage/profile-store";
import { MappingStore } from "../storage/mapping-store";
import { SettingsStore } from "../storage/settings-store";
import { validateExportData } from "../storage/migration";
import type {
  UserProfile,
  EducationRecord,
  EmploymentRecord,
  CustomField,
  ApplicationAnswer,
  FieldMapping,
  ExportData
} from "../shared/types";

const profileStore = new ProfileStore();
const mappingStore = new MappingStore();
const settingsStore = new SettingsStore();

let currentProfile: UserProfile;
let currentMappings: FieldMapping[] = [];

// Tab switching
const navItems = document.querySelectorAll<HTMLButtonElement>(".nav-item");
const tabPanes = document.querySelectorAll<HTMLElement>(".tab-pane");
const pageTitle = document.querySelector<HTMLHeadingElement>("#page-title")!;

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabName = btn.getAttribute("data-tab");
    navItems.forEach((b) => b.classList.remove("active"));
    tabPanes.forEach((p) => p.classList.remove("active"));

    btn.classList.add("active");
    const targetPane = document.getElementById(`tab-${tabName}`);
    if (targetPane) targetPane.classList.add("active");
    pageTitle.textContent = btn.textContent?.replace(/\s*\(\d+\)/, "") || "";
  });
});

// Helper for unique ID
function uuid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

// 1. Education UI Renderers
const educationList = document.querySelector<HTMLDivElement>("#education-list")!;
function renderEducationItem(edu: EducationRecord): HTMLElement {
  const card = document.createElement("div");
  card.className = "record-card";
  card.dataset.id = edu.id;
  card.innerHTML = `
    <div class="record-header">
      <span class="record-title">${edu.institution || "New School / University"}</span>
      <button type="button" class="btn btn-danger btn-sm remove-edu-btn">Remove</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Institution / University</label>
        <input type="text" class="edu-institution" value="${edu.institution}" placeholder="University of California" />
      </div>
      <div class="form-group">
        <label>Degree</label>
        <input type="text" class="edu-degree" value="${edu.degree}" placeholder="Bachelor of Science" />
      </div>
      <div class="form-group">
        <label>Field of Study / Major</label>
        <input type="text" class="edu-field" value="${edu.fieldOfStudy}" placeholder="Computer Science" />
      </div>
      <div class="form-group">
        <label>GPA</label>
        <input type="text" class="edu-gpa" value="${edu.gpa}" placeholder="3.8" />
      </div>
      <div class="form-group">
        <label>Start Date</label>
        <input type="text" class="edu-start" value="${edu.startDate}" placeholder="2018-09" />
      </div>
      <div class="form-group">
        <label>End Date (or Expected)</label>
        <input type="text" class="edu-end" value="${edu.endDate}" placeholder="2022-06" />
      </div>
    </div>
  `;

  card.querySelector(".remove-edu-btn")?.addEventListener("click", () => card.remove());
  return card;
}

// 2. Employment UI Renderers
const employmentList = document.querySelector<HTMLDivElement>("#employment-list")!;
function renderEmploymentItem(emp: EmploymentRecord): HTMLElement {
  const card = document.createElement("div");
  card.className = "record-card";
  card.dataset.id = emp.id;
  card.innerHTML = `
    <div class="record-header">
      <span class="record-title">${emp.company || "New Employer"}</span>
      <button type="button" class="btn btn-danger btn-sm remove-emp-btn">Remove</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Company / Employer</label>
        <input type="text" class="emp-company" value="${emp.company}" placeholder="Acme Corp" />
      </div>
      <div class="form-group">
        <label>Job Title</label>
        <input type="text" class="emp-title" value="${emp.jobTitle}" placeholder="Software Engineer" />
      </div>
      <div class="form-group">
        <label>Location</label>
        <input type="text" class="emp-location" value="${emp.location}" placeholder="San Francisco, CA" />
      </div>
      <div class="form-group">
        <label>Start Date</label>
        <input type="text" class="emp-start" value="${emp.startDate}" placeholder="2022-07" />
      </div>
      <div class="form-group">
        <label>End Date</label>
        <input type="text" class="emp-end" value="${emp.endDate}" placeholder="Present" />
      </div>
      <div class="form-group full-width">
        <label>Responsibilities & Summary</label>
        <input type="text" class="emp-resp" value="${emp.responsibilities}" placeholder="Led frontend migration, built scalable APIs..." />
      </div>
    </div>
  `;

  card.querySelector(".remove-emp-btn")?.addEventListener("click", () => card.remove());
  return card;
}

// 3. Custom Fields UI Renderers
const customFieldsList = document.querySelector<HTMLDivElement>("#custom-fields-list")!;
function renderCustomFieldItem(field: CustomField): HTMLElement {
  const card = document.createElement("div");
  card.className = "record-card";
  card.dataset.id = field.id;
  card.innerHTML = `
    <div class="record-header">
      <span class="record-title">${field.name || "Custom Field"}</span>
      <button type="button" class="btn btn-danger btn-sm remove-custom-btn">Remove</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Field Name</label>
        <input type="text" class="custom-name" value="${field.name}" placeholder="e.g. Expected Salary" />
      </div>
      <div class="form-group">
        <label>Type</label>
        <select class="custom-type">
          <option value="text" ${field.type === "text" ? "selected" : ""}>Text</option>
          <option value="number" ${field.type === "number" ? "selected" : ""}>Number</option>
          <option value="boolean" ${field.type === "boolean" ? "selected" : ""}>Boolean (Yes/No)</option>
          <option value="date" ${field.type === "date" ? "selected" : ""}>Date</option>
          <option value="select" ${field.type === "select" ? "selected" : ""}>Select</option>
        </select>
      </div>
      <div class="form-group full-width">
        <label>Value</label>
        <input type="text" class="custom-val" value="${String(field.value ?? "")}" placeholder="Value" />
      </div>
    </div>
  `;

  card.querySelector(".remove-custom-btn")?.addEventListener("click", () => card.remove());
  return card;
}

// 4. Application Answers UI Renderers
const answersList = document.querySelector<HTMLDivElement>("#answers-list")!;
function renderAnswerItem(ans: ApplicationAnswer): HTMLElement {
  const card = document.createElement("div");
  card.className = "record-card";
  card.dataset.id = ans.id;
  card.innerHTML = `
    <div class="record-header">
      <span class="record-title">${ans.name || "Question"}</span>
      <button type="button" class="btn btn-danger btn-sm remove-ans-btn">Remove</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Question / Screening Topic</label>
        <input type="text" class="ans-name" value="${ans.name}" placeholder="e.g. Will you require visa sponsorship?" />
      </div>
      <div class="form-group">
        <label>Answer</label>
        <input type="text" class="ans-val" value="${ans.value}" placeholder="e.g. No" />
      </div>
    </div>
  `;

  card.querySelector(".remove-ans-btn")?.addEventListener("click", () => card.remove());
  return card;
}

// 5. Mapping Library UI Renderers
const mappingsList = document.querySelector<HTMLDivElement>("#mappings-list")!;
function renderMappingItem(m: FieldMapping): HTMLElement {
  const card = document.createElement("div");
  card.className = "record-card";
  card.dataset.id = m.id;
  const targetLabel = m.fingerprint.label || m.fingerprint.accessibleName || "Unnamed Field";
  const sourceText = m.source === "fixedValue" ? `Fixed Value: "${m.fixedValue}"` : `${m.source}: ${m.sourcePath || ""}`;

  card.innerHTML = `
    <div class="record-header">
      <div>
        <span class="record-title">${targetLabel}</span>
        <span style="font-size:11px;color:#94a3b8;margin-left:8px;">(${m.fingerprint.kind})</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="checkbox" class="mapping-toggle" ${m.enabled ? "checked" : ""} /> Enabled
        </label>
        <button type="button" class="btn btn-danger btn-sm remove-mapping-btn">Delete</button>
      </div>
    </div>
    <div style="font-size:12px;color:#cbd5e1;margin-top:6px;">
      <strong>Fills with:</strong> <span style="color:#38bdf8;font-weight:600;">${sourceText}</span> &nbsp;|&nbsp; <strong>Scope:</strong> ${m.tenantScope === "*" ? "All Workday Sites" : m.tenantScope}
    </div>
  `;

  card.querySelector(".mapping-toggle")?.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    void mappingStore.toggleEnabled(m.id, checked);
  });

  card.querySelector(".remove-mapping-btn")?.addEventListener("click", () => {
    void mappingStore.remove(m.id).then(() => card.remove());
  });

  return card;
}

// Add buttons
document.querySelector("#add-edu-btn")?.addEventListener("click", () => {
  educationList.prepend(
    renderEducationItem({
      id: uuid(),
      institution: "",
      degree: "",
      fieldOfStudy: "",
      gpa: "",
      startDate: "",
      endDate: "",
      description: ""
    })
  );
});

document.querySelector("#add-emp-btn")?.addEventListener("click", () => {
  employmentList.prepend(
    renderEmploymentItem({
      id: uuid(),
      company: "",
      jobTitle: "",
      location: "",
      startDate: "",
      endDate: "",
      currentlyEmployed: false,
      responsibilities: "",
      achievements: ""
    })
  );
});

document.querySelector("#add-custom-btn")?.addEventListener("click", () => {
  customFieldsList.prepend(
    renderCustomFieldItem({
      id: uuid(),
      name: "",
      type: "text",
      value: "",
      description: ""
    })
  );
});

document.querySelector("#add-answer-btn")?.addEventListener("click", () => {
  answersList.prepend(
    renderAnswerItem({
      id: uuid(),
      name: "",
      value: "",
      description: ""
    })
  );
});

// Search filter for mappings
document.querySelector<HTMLInputElement>("#mapping-search")?.addEventListener("input", (e) => {
  const query = (e.target as HTMLInputElement).value.toLowerCase();
  mappingsList.querySelectorAll<HTMLElement>(".record-card").forEach((card) => {
    const text = card.textContent?.toLowerCase() || "";
    card.style.display = text.includes(query) ? "block" : "none";
  });
});

// Save settings immediately when toggled
async function autoSaveSettings(): Promise<void> {
  const settings = {
    autoFillHighConfidence: (document.querySelector("#set-autoFillHigh") as HTMLInputElement).checked,
    overwriteExisting: !(document.querySelector("#set-protectExisting") as HTMLInputElement).checked,
    showFloatingStatus: (document.querySelector("#set-floatingStatus") as HTMLInputElement).checked,
    confidenceThreshold: Number((document.querySelector("#set-threshold") as HTMLInputElement).value) || 80
  };
  await settingsStore.save(settings);

  const statusMsg = document.querySelector<HTMLSpanElement>("#save-status")!;
  statusMsg.textContent = "✓ Preferences updated";
  setTimeout(() => {
    statusMsg.textContent = "";
  }, 2000);
}

document.querySelector("#set-autoFillHigh")?.addEventListener("change", () => void autoSaveSettings());
document.querySelector("#set-protectExisting")?.addEventListener("change", () => void autoSaveSettings());
document.querySelector("#set-floatingStatus")?.addEventListener("change", () => void autoSaveSettings());
document.querySelector("#set-threshold")?.addEventListener("change", () => void autoSaveSettings());

// Load profile data into form
async function loadAllData(): Promise<void> {
  const [profile, mappings, settings] = await Promise.all([
    profileStore.get(),
    mappingStore.list(),
    settingsStore.get()
  ]);

  currentProfile = profile;
  currentMappings = mappings;

  // Update Nav Counts
  const answersNav = document.querySelector<HTMLButtonElement>('[data-tab="answers"]');
  if (answersNav) {
    answersNav.textContent = `Application Answers (${profile.applicationAnswers.length})`;
  }
  const mappingsNav = document.querySelector<HTMLButtonElement>('[data-tab="mappings"]');
  if (mappingsNav) {
    mappingsNav.textContent = `Mapping Library (${mappings.length})`;
  }
  const customNav = document.querySelector<HTMLButtonElement>('[data-tab="custom-fields"]');
  if (customNav) {
    customNav.textContent = `Custom Fields (${profile.customFields.length})`;
  }

  // Personal
  (document.querySelector("#p-firstName") as HTMLInputElement).value = profile.personal.firstName;
  (document.querySelector("#p-middleName") as HTMLInputElement).value = profile.personal.middleName;
  (document.querySelector("#p-lastName") as HTMLInputElement).value = profile.personal.lastName;
  (document.querySelector("#p-preferredName") as HTMLInputElement).value = profile.personal.preferredName;

  // Contact
  (document.querySelector("#c-email") as HTMLInputElement).value = profile.contact.email;
  (document.querySelector("#c-phone") as HTMLInputElement).value = profile.contact.phone;
  (document.querySelector("#c-country") as HTMLInputElement).value = profile.contact.country;
  (document.querySelector("#c-address") as HTMLInputElement).value = profile.contact.address;
  (document.querySelector("#c-city") as HTMLInputElement).value = profile.contact.city;
  (document.querySelector("#c-state") as HTMLInputElement).value = profile.contact.state;
  (document.querySelector("#c-postalCode") as HTMLInputElement).value = profile.contact.postalCode;

  // Professional
  (document.querySelector("#l-linkedin") as HTMLInputElement).value = profile.professional.linkedin;
  (document.querySelector("#l-github") as HTMLInputElement).value = profile.professional.github;
  (document.querySelector("#l-portfolio") as HTMLInputElement).value = profile.professional.portfolio;
  (document.querySelector("#l-website") as HTMLInputElement).value = profile.professional.website;

  // Education
  educationList.innerHTML = "";
  profile.education.forEach((edu) => educationList.append(renderEducationItem(edu)));

  // Employment
  employmentList.innerHTML = "";
  profile.employment.forEach((emp) => employmentList.append(renderEmploymentItem(emp)));

  // Skills
  (document.querySelector("#sk-languages") as HTMLInputElement).value = (profile.skills.programmingLanguages || []).join(", ");
  (document.querySelector("#sk-frameworks") as HTMLInputElement).value = (profile.skills.frameworks || []).join(", ");
  (document.querySelector("#sk-databases") as HTMLInputElement).value = (profile.skills.databases || []).join(", ");
  (document.querySelector("#sk-cloud") as HTMLInputElement).value = (profile.skills.cloud || []).join(", ");
  (document.querySelector("#sk-tools") as HTMLInputElement).value = (profile.skills.tools || []).join(", ");
  (document.querySelector("#sk-certifications") as HTMLInputElement).value = (profile.skills.certifications || []).join(", ");
  (document.querySelector("#sk-other") as HTMLInputElement).value = (profile.skills.other || []).join(", ");

  // Custom Fields
  customFieldsList.innerHTML = "";
  profile.customFields.forEach((f) => customFieldsList.append(renderCustomFieldItem(f)));

  // Application Answers
  answersList.innerHTML = "";
  profile.applicationAnswers.forEach((ans) => answersList.append(renderAnswerItem(ans)));

  // Mappings
  mappingsList.innerHTML = "";
  if (mappings.length === 0) {
    mappingsList.innerHTML = `<p style="color:#94a3b8;font-size:13px;">No learned mappings saved yet. They will appear here automatically when you teach fields on job applications or use the Page Inspector.</p>`;
  } else {
    mappings.forEach((m) => mappingsList.append(renderMappingItem(m)));
  }

  // Settings
  (document.querySelector("#set-autoFillHigh") as HTMLInputElement).checked = settings.autoFillHighConfidence;
  (document.querySelector("#set-protectExisting") as HTMLInputElement).checked = !settings.overwriteExisting;
  (document.querySelector("#set-floatingStatus") as HTMLInputElement).checked = settings.showFloatingStatus;
  (document.querySelector("#set-threshold") as HTMLInputElement).value = String(settings.confidenceThreshold || 80);
}

function parseCommaList(val: string): string[] {
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Collect and Save All
async function saveAll(): Promise<void> {
  const statusMsg = document.querySelector<HTMLSpanElement>("#save-status")!;

  const profile: UserProfile = {
    id: currentProfile?.id || uuid(),
    updatedAt: new Date().toISOString(),
    personal: {
      firstName: (document.querySelector("#p-firstName") as HTMLInputElement).value.trim(),
      middleName: (document.querySelector("#p-middleName") as HTMLInputElement).value.trim(),
      lastName: (document.querySelector("#p-lastName") as HTMLInputElement).value.trim(),
      preferredName: (document.querySelector("#p-preferredName") as HTMLInputElement).value.trim()
    },
    contact: {
      email: (document.querySelector("#c-email") as HTMLInputElement).value.trim(),
      phone: (document.querySelector("#c-phone") as HTMLInputElement).value.trim(),
      country: (document.querySelector("#c-country") as HTMLInputElement).value.trim(),
      address: (document.querySelector("#c-address") as HTMLInputElement).value.trim(),
      city: (document.querySelector("#c-city") as HTMLInputElement).value.trim(),
      state: (document.querySelector("#c-state") as HTMLInputElement).value.trim(),
      postalCode: (document.querySelector("#c-postalCode") as HTMLInputElement).value.trim()
    },
    professional: {
      linkedin: (document.querySelector("#l-linkedin") as HTMLInputElement).value.trim(),
      github: (document.querySelector("#l-github") as HTMLInputElement).value.trim(),
      portfolio: (document.querySelector("#l-portfolio") as HTMLInputElement).value.trim(),
      website: (document.querySelector("#l-website") as HTMLInputElement).value.trim()
    },
    education: Array.from(educationList.querySelectorAll<HTMLElement>(".record-card")).map((card) => ({
      id: card.dataset.id || uuid(),
      institution: (card.querySelector(".edu-institution") as HTMLInputElement).value.trim(),
      degree: (card.querySelector(".edu-degree") as HTMLInputElement).value.trim(),
      fieldOfStudy: (card.querySelector(".edu-field") as HTMLInputElement).value.trim(),
      gpa: (card.querySelector(".edu-gpa") as HTMLInputElement).value.trim(),
      startDate: (card.querySelector(".edu-start") as HTMLInputElement).value.trim(),
      endDate: (card.querySelector(".edu-end") as HTMLInputElement).value.trim(),
      description: ""
    })),
    employment: Array.from(employmentList.querySelectorAll<HTMLElement>(".record-card")).map((card) => ({
      id: card.dataset.id || uuid(),
      company: (card.querySelector(".emp-company") as HTMLInputElement).value.trim(),
      jobTitle: (card.querySelector(".emp-title") as HTMLInputElement).value.trim(),
      location: (card.querySelector(".emp-location") as HTMLInputElement).value.trim(),
      startDate: (card.querySelector(".emp-start") as HTMLInputElement).value.trim(),
      endDate: (card.querySelector(".emp-end") as HTMLInputElement).value.trim(),
      currentlyEmployed: (card.querySelector(".emp-end") as HTMLInputElement).value.trim().toLowerCase() === "present",
      responsibilities: (card.querySelector(".emp-resp") as HTMLInputElement).value.trim(),
      achievements: ""
    })),
    skills: {
      programmingLanguages: parseCommaList((document.querySelector("#sk-languages") as HTMLInputElement).value),
      frameworks: parseCommaList((document.querySelector("#sk-frameworks") as HTMLInputElement).value),
      databases: parseCommaList((document.querySelector("#sk-databases") as HTMLInputElement).value),
      cloud: parseCommaList((document.querySelector("#sk-cloud") as HTMLInputElement).value),
      tools: parseCommaList((document.querySelector("#sk-tools") as HTMLInputElement).value),
      certifications: parseCommaList((document.querySelector("#sk-certifications") as HTMLInputElement).value),
      other: parseCommaList((document.querySelector("#sk-other") as HTMLInputElement).value)
    },
    customFields: Array.from(customFieldsList.querySelectorAll<HTMLElement>(".record-card")).map((card) => ({
      id: card.dataset.id || uuid(),
      name: (card.querySelector(".custom-name") as HTMLInputElement).value.trim(),
      type: (card.querySelector(".custom-type") as HTMLSelectElement).value as any,
      value: (card.querySelector(".custom-val") as HTMLInputElement).value.trim(),
      description: ""
    })),
    applicationAnswers: Array.from(answersList.querySelectorAll<HTMLElement>(".record-card")).map((card) => ({
      id: card.dataset.id || uuid(),
      name: (card.querySelector(".ans-name") as HTMLInputElement).value.trim(),
      value: (card.querySelector(".ans-val") as HTMLInputElement).value.trim(),
      description: ""
    }))
  };

  const settings = {
    autoFillHighConfidence: (document.querySelector("#set-autoFillHigh") as HTMLInputElement).checked,
    overwriteExisting: !(document.querySelector("#set-protectExisting") as HTMLInputElement).checked,
    showFloatingStatus: (document.querySelector("#set-floatingStatus") as HTMLInputElement).checked,
    confidenceThreshold: Number((document.querySelector("#set-threshold") as HTMLInputElement).value) || 80
  };

  await Promise.all([profileStore.save(profile), settingsStore.save(settings)]);

  statusMsg.textContent = "✓ Saved locally";
  setTimeout(() => {
    statusMsg.textContent = "";
  }, 2500);
}

document.querySelector("#save-all-btn")?.addEventListener("click", () => {
  void saveAll();
});

// Auto-reload data whenever the Options window gains focus
window.addEventListener("focus", () => {
  void loadAllData();
});

// Export JSON Backup
document.querySelector("#export-json-btn")?.addEventListener("click", async () => {
  const [profile, mappings, settings] = await Promise.all([
    profileStore.get(),
    mappingStore.list(),
    settingsStore.get()
  ]);

  const exportData: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    fieldMappings: mappings,
    settings
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `autofillup-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// Import JSON Backup
document.querySelector("#import-json-btn")?.addEventListener("click", async () => {
  const fileInput = document.querySelector<HTMLInputElement>("#import-file")!;
  const msgEl = document.querySelector<HTMLDivElement>("#import-msg")!;

  const file = fileInput.files?.[0];
  if (!file) {
    msgEl.textContent = "Please select a .json backup file first.";
    msgEl.style.color = "#ef4444";
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const validation = validateExportData(parsed);

    if (!validation.valid || !validation.data) {
      msgEl.textContent = `Invalid backup file: ${validation.error || "Unknown format"}`;
      msgEl.style.color = "#ef4444";
      return;
    }

    const { data } = validation;
    await profileStore.save(data.profile);

    if (Array.isArray(data.fieldMappings)) {
      for (const m of data.fieldMappings as FieldMapping[]) {
        await mappingStore.save(m);
      }
    }

    if (data.settings) {
      await settingsStore.save(data.settings);
    }

    msgEl.textContent = "✓ Backup restored successfully!";
    msgEl.style.color = "#10b981";
    void loadAllData();
  } catch (err) {
    msgEl.textContent = `Failed parsing file: ${err instanceof Error ? err.message : String(err)}`;
    msgEl.style.color = "#ef4444";
  }
});

// Initial load
void loadAllData();

// Update snapshot UI
async function updateSnapshotInfo(): Promise<void> {
  const timeEl = document.querySelector<HTMLSpanElement>("#snapshot-time");
  if (!timeEl) return;

  try {
    const raw = await chrome.storage.local.get("autofillup_backup_snapshot");
    if (raw.autofillup_backup_snapshot?.savedAt) {
      const date = new Date(raw.autofillup_backup_snapshot.savedAt);
      timeEl.textContent = `Last Auto-Snapshot: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } else {
      timeEl.textContent = "No auto-snapshot found yet.";
    }
  } catch {
    timeEl.textContent = "Auto-Snapshot active.";
  }
}

void updateSnapshotInfo();

// Restore from Auto-Snapshot button
document.querySelector("#restore-snapshot-btn")?.addEventListener("click", async () => {
  const statusEl = document.querySelector<HTMLDivElement>("#snapshot-status")!;
  statusEl.textContent = "Restoring from snapshot...";
  statusEl.style.color = "#38bdf8";

  try {
    const raw = await chrome.storage.local.get("autofillup_backup_snapshot");
    const snap = raw.autofillup_backup_snapshot;
    if (!snap || !snap.profile) {
      statusEl.textContent = "No valid snapshot found to restore.";
      statusEl.style.color = "#ef4444";
      return;
    }

    if (snap.profile) await profileStore.save(snap.profile);
    if (Array.isArray(snap.fieldMappings)) {
      for (const m of snap.fieldMappings) {
        await mappingStore.save(m);
      }
    }
    if (snap.settings) await settingsStore.save(snap.settings);

    statusEl.textContent = "✓ Restored profile & settings from auto-snapshot!";
    statusEl.style.color = "#10b981";
    void loadAllData();
    void updateSnapshotInfo();
  } catch (err) {
    statusEl.textContent = `Restore failed: ${String(err)}`;
    statusEl.style.color = "#ef4444";
  }
});
