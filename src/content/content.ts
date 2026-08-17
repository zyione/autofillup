import { MappingStore } from "../storage/mapping-store";
import { ProfileStore } from "../storage/profile-store";
import { SettingsStore } from "../storage/settings-store";
import { logger } from "../shared/logger";
import type { FieldDescriptor, FieldKind, FieldMapping, FieldOutcome, UserProfile } from "../shared/types";

const profileStore = new ProfileStore(); const mappingStore = new MappingStore(); const settingsStore = new SettingsStore();
let lastRun: Array<{ label: string; outcome: FieldOutcome; detail: string }> = [];
const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const text = (element: Element | null | undefined): string => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
const isVisible = (element: HTMLElement): boolean => !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length) && !element.closest('[aria-hidden="true"]');
const isWorkday = (): boolean => location.hostname.endsWith(".myworkdayjobs.com");

function labelFor(element: HTMLElement): string {
  const input = element as HTMLInputElement;
  const explicit = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
  const labelledBy = element.getAttribute("aria-labelledby")?.split(/\s+/).map((id) => text(document.getElementById(id))).join(" ");
  const nearby = element.closest("fieldset, [role=group], [data-automation-id], div")?.querySelector("label, legend, [data-automation-id*=label]");
  return text(explicit) || text(element.closest("label")) || element.getAttribute("aria-label") || labelledBy || text(nearby) || input.placeholder || "";
}
function fieldKind(element: HTMLElement): FieldKind {
  const input = element as HTMLInputElement;
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (element instanceof HTMLSelectElement) return "select";
  if (input.type === "checkbox") return "checkbox"; if (input.type === "radio") return "radio";
  if (input.type === "date") return "date"; if (element.getAttribute("role") === "combobox" || element.getAttribute("aria-autocomplete")) return "combobox";
  return element instanceof HTMLInputElement ? "text" : "unknown";
}
function describeFields(): FieldDescriptor[] {
  return [...document.querySelectorAll<HTMLElement>('input:not([type="hidden"]), textarea, select, [role="combobox"]')].filter(isVisible).map((element, index) => {
    const kind = fieldKind(element); const label = labelFor(element); const container = element.closest("fieldset, [role=group], section, [data-automation-id]");
    const options = element instanceof HTMLSelectElement ? [...element.options].map((option) => option.text) : [];
    return { id: element.id || `${kind}-${index}`, element, fingerprint: { label: normalize(label), accessibleName: normalize(element.getAttribute("aria-label") ?? ""), placeholder: normalize((element as HTMLInputElement).placeholder ?? ""), kind, section: normalize(text(container?.querySelector("h1,h2,h3,legend,[data-automation-id*=heading]"))), tenant: location.hostname }, required: element.matches("[required],[aria-required=true]"), visible: true, options };
  }).filter((field) => field.fingerprint.label || field.fingerprint.accessibleName || field.fingerprint.placeholder);
}
function profileValue(profile: UserProfile, path: string): string | undefined { const value = path.split(".").reduce<unknown>((current, part) => current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined, profile); return value === undefined || value === null || Array.isArray(value) ? undefined : String(value); }
function builtinMapping(field: FieldDescriptor): string | undefined {
  const label = `${field.fingerprint.label} ${field.fingerprint.accessibleName}`;
  const rules: Array<[RegExp, string]> = [[/\b(first|given) name\b/, "personal.firstName"], [/\bmiddle name\b/, "personal.middleName"], [/\b(last|family|surname)\b/, "personal.lastName"], [/\b(preferred|display) name\b/, "personal.preferredName"], [/\be mail\b|\bemail\b/, "contact.email"], [/\bphone|mobile\b/, "contact.phone"], [/\bcountry\b/, "contact.country"], [/\b(address|street)\b/, "contact.address"], [/\bcity\b/, "contact.city"], [/\b(state|province|region)\b/, "contact.state"], [/\b(zip|postal)\b/, "contact.postalCode"], [/\blinkedin\b/, "professional.linkedin"], [/\bgithub\b/, "professional.github"], [/\bportfolio\b/, "professional.portfolio"], [/\bwebsite|personal site\b/, "professional.website"]];
  return rules.find(([pattern]) => pattern.test(label))?.[1];
}
function mappingValue(mapping: FieldMapping, profile: UserProfile): string | undefined { if (mapping.source === "fixedValue") return mapping.fixedValue; if (mapping.source === "profile" && mapping.sourcePath) return profileValue(profile, mapping.sourcePath); if (mapping.source === "customField") return String(profile.customFields.find((item) => item.id === mapping.sourcePath)?.value ?? "") || undefined; if (mapping.source === "applicationAnswer") return profile.applicationAnswers.find((item) => item.id === mapping.sourcePath)?.value; return undefined; }
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void { const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true })); element.dispatchEvent(new Event("blur", { bubbles: true })); }
function fill(field: FieldDescriptor, value: string, overwrite: boolean): { outcome: FieldOutcome; detail: string } {
  const element = field.element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (field.fingerprint.kind === "combobox" || field.fingerprint.kind === "radio" || field.fingerprint.kind === "checkbox") return { outcome: "review", detail: "This component needs explicit review." };
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return { outcome: "failed", detail: "Unsupported element." };
  if (element.value && !overwrite) return { outcome: "skipped", detail: "Kept existing value." };
  if (element instanceof HTMLSelectElement) { const option = [...element.options].find((item) => normalize(item.text) === normalize(value) || normalize(item.value) === normalize(value)); if (!option) return { outcome: "review", detail: `No exact option for “${value}”.` }; setNativeValue(element, option.value); } else setNativeValue(element, value);
  return element.value ? { outcome: "filled", detail: "Filled and change events dispatched." } : { outcome: "failed", detail: "Value was not retained." };
}
function showOverlay(): void { document.getElementById("autofillup-status")?.remove(); const panel = document.createElement("aside"); panel.id = "autofillup-status"; panel.setAttribute("role", "status"); panel.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:330px;padding:14px;background:#172033;color:#fff;border-radius:10px;font:13px system-ui;box-shadow:0 6px 24px #0006"; const counts = lastRun.reduce<Record<string, number>>((all, item) => ({ ...all, [item.outcome]: (all[item.outcome] ?? 0) + 1 }), {}); panel.innerHTML = `<strong>AutoFillUp review</strong><p>${lastRun.length ? Object.entries(counts).map(([key, value]) => `${value} ${key}`).join(" · ") : "No eligible fields found."}</p><button type="button">Close</button>`; panel.querySelector("button")?.addEventListener("click", () => panel.remove()); document.documentElement.append(panel); }
async function runAutofill(showResults = true): Promise<void> { if (!isWorkday()) return; const [profile, mappings, settings] = await Promise.all([profileStore.get(), mappingStore.list(), settingsStore.get()]); lastRun = describeFields().map((field) => { const label = field.fingerprint.label || field.fingerprint.accessibleName || "Unnamed field"; const learned = mappings.find((item) => item.enabled && (item.tenantScope === "*" || item.tenantScope === location.hostname) && item.fingerprint.label === field.fingerprint.label && item.fingerprint.kind === field.fingerprint.kind); if (learned?.source === "ignore") return { label, outcome: "skipped" as const, detail: "Ignored by saved mapping." }; const value = learned ? mappingValue(learned, profile) : builtinMapping(field) ? profileValue(profile, builtinMapping(field)!) : undefined; if (!value) return { label, outcome: "unknown" as const, detail: "No conservative mapping found." }; return { label, ...fill(field, value, settings.overwriteExisting) }; }); if (showResults) showOverlay(); }
let queued = 0; const observer = new MutationObserver(() => { clearTimeout(queued); queued = window.setTimeout(() => void runAutofill(false), 700); });
chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, respond) => { if (message.type === "RUN_AUTOFILL") { void runAutofill(true).then(() => respond({ supported: isWorkday(), outcomes: lastRun })); return true; } if (message.type === "GET_STATUS") respond({ supported: isWorkday(), outcomes: lastRun }); });
if (isWorkday()) { logger.info("Workday assistant initialized", { hostname: location.hostname }); observer.observe(document.documentElement, { childList: true, subtree: true }); }
