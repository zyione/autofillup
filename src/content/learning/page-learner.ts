import type { FieldDescriptor, UserProfile, FieldMapping } from "../../shared/types";
import { ProfileStore } from "../../storage/profile-store";
import { MappingStore } from "../../storage/mapping-store";
import { normalizeLabel, normalizeText } from "../fields/field-normalizer";
import { scanFields } from "../fields/field-detector";

export interface LearnResult {
  learnedCount: number;
  profileFieldsUpdated: string[];
  mappingsCreated: string[];
}

export function extractCurrentFieldValue(field: FieldDescriptor): string | undefined {
  const el = field.element;
  if (!el) return undefined;

  if (field.fingerprint.kind === "radioGroup") {
    const checkedRadio = el.querySelector<HTMLInputElement>("input[type='radio']:checked");
    if (checkedRadio) {
      const rawLabel = checkedRadio.closest("label")?.textContent?.trim() || checkedRadio.value;
      return rawLabel;
    }
    return undefined;
  }

  if (field.fingerprint.kind === "checkbox") {
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      return el.checked ? "Yes" : "No";
    }
    return undefined;
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const val = el.value.trim();
    return val.length > 0 ? val : undefined;
  }

  if (el instanceof HTMLSelectElement) {
    const option = el.options[el.selectedIndex];
    if (option && option.value && option.text) {
      const text = option.text.trim();
      return text !== "Select..." && text !== "Choose..." && text.length > 0 ? text : undefined;
    }
    return undefined;
  }

  // Workday custom dropdown or combobox
  const text = el.textContent?.replace(/\s+/g, " ").trim();
  if (text && text !== "Select..." && text !== "Choose..." && !text.startsWith("Select ") && text.length > 0) {
    return text;
  }

  return undefined;
}

const standardProfileMatchRules: Array<{ pattern: RegExp; section: keyof UserProfile; field: string; label: string }> = [
  { pattern: /\b(legal\s+)?(first|given)\s+name\b/i, section: "personal", field: "firstName", label: "First Name" },
  { pattern: /\bmiddle\s+name\b/i, section: "personal", field: "middleName", label: "Middle Name" },
  { pattern: /\b(legal\s+)?(last|family|surname)\s+name\b/i, section: "personal", field: "lastName", label: "Last Name" },
  { pattern: /\b(last|family|surname)\b/i, section: "personal", field: "lastName", label: "Last Name" },
  { pattern: /\bpreferred\s+(name|first\s+name)\b/i, section: "personal", field: "preferredName", label: "Preferred Name" },
  { pattern: /\be[- ]?mail(\s+address)?\b/i, section: "contact", field: "email", label: "Email Address" },
  { pattern: /\b(mobile|cell|telephone|phone)(\s+number)?\b/i, section: "contact", field: "phone", label: "Phone Number" },
  { pattern: /\b(mobile|cell)\s+phone\b/i, section: "contact", field: "phone", label: "Phone Number" },
  { pattern: /\b(street\s+)?address(\s+line\s+1)?\b/i, section: "contact", field: "address", label: "Address" },
  { pattern: /\bcity\b/i, section: "contact", field: "city", label: "City" },
  { pattern: /\bstate\s*(\/|\s+)?(province|region)?\b/i, section: "contact", field: "state", label: "State / Province" },
  { pattern: /\b(zip|postal)(\s+code)?\b/i, section: "contact", field: "postalCode", label: "Postal Code" },
  { pattern: /\bcountry(\s*\/\s*territory)?\b/i, section: "contact", field: "country", label: "Country" },
  { pattern: /\blinkedin\b/i, section: "professional", field: "linkedin", label: "LinkedIn" },
  { pattern: /\bgithub\b/i, section: "professional", field: "github", label: "GitHub" },
  { pattern: /\bportfolio\b/i, section: "professional", field: "portfolio", label: "Portfolio" },
  { pattern: /\b(website|personal\s+site)\b/i, section: "professional", field: "website", label: "Website" }
];

export async function learnCurrentPageValues(
  doc: Document = document,
  profileStore: ProfileStore = new ProfileStore(),
  mappingStore: MappingStore = new MappingStore()
): Promise<LearnResult> {
  const fields = scanFields(doc);
  const profile = await profileStore.get();
  const existingMappings = await mappingStore.list();

  const profileUpdated: string[] = [];
  const mappingsCreated: string[] = [];

  for (const field of fields) {
    const val = extractCurrentFieldValue(field);
    if (!val) continue;

    const label = field.fingerprint.label || field.rawLabel || "";
    const norm = normalizeLabel(label);

    // 1. Check if matches standard profile field
    let matchedProfile = false;
    for (const rule of standardProfileMatchRules) {
      if (rule.pattern.test(norm) || rule.pattern.test(label)) {
        const currentVal = (profile[rule.section] as any)?.[rule.field];
        if (!currentVal || currentVal !== val) {
          (profile[rule.section] as any)[rule.field] = val;
          profileUpdated.push(`${rule.label} ("${val}")`);
        }
        matchedProfile = true;
        break;
      }
    }

    if (matchedProfile) continue;

    // 2. Custom field or screening question -> Create/update learned mapping & application answer
    const existing = existingMappings.find(
      (m) => m.fingerprint.label.toLowerCase() === norm.toLowerCase()
    );

    const now = new Date().toISOString();
    if (!existing) {
      const newMapping: FieldMapping = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `mapping-${Date.now()}-${Math.random()}`,
        fingerprint: field.fingerprint,
        source: "fixedValue",
        fixedValue: val,
        tenantScope: "*",
        enabled: true,
        createdAt: now,
        updatedAt: now
      };
      await mappingStore.save(newMapping);
      mappingsCreated.push(`${label || norm} = "${val}"`);
    } else if (existing.fixedValue !== val) {
      existing.fixedValue = val;
      existing.updatedAt = now;
      await mappingStore.save(existing);
      mappingsCreated.push(`${label || norm} = "${val}"`);
    }

    // Also register in applicationAnswers so it is visible in the profile settings
    const ansIdx = profile.applicationAnswers.findIndex(
      (a) => a.name.toLowerCase() === (label || norm).toLowerCase()
    );
    if (ansIdx >= 0) {
      profile.applicationAnswers[ansIdx].value = val;
    } else if (label && label.length > 2) {
      profile.applicationAnswers.push({
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ans-${Date.now()}`,
        name: label,
        value: val,
        description: "Learned from application form"
      });
    }
  }

  if (profileUpdated.length > 0 || mappingsCreated.length > 0) {
    await profileStore.save(profile);
  }

  return {
    learnedCount: profileUpdated.length + mappingsCreated.length,
    profileFieldsUpdated: profileUpdated,
    mappingsCreated
  };
}
