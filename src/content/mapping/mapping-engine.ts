import type { FieldDescriptor, FieldMapping, MatchCandidate, UserProfile } from "../../shared/types";
import { calculateConfidence } from "./confidence-engine";
import { normalizeLabel } from "../fields/field-normalizer";

export function getProfileValueByPath(profile: UserProfile, path: string): string | undefined {
  if (!path) return undefined;
  const parts = path.split(".");

  let current: unknown = profile;
  for (const part of parts) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  if (current === undefined || current === null || Array.isArray(current)) {
    return undefined;
  }
  return String(current).trim();
}

interface BuiltinRule {
  pattern: RegExp;
  path: string;
  kind?: string;
  sectionHint?: RegExp;
}

const builtinRules: BuiltinRule[] = [
  // Personal
  { pattern: /\b(first|given) name\b/, path: "personal.firstName" },
  { pattern: /\bmiddle name\b/, path: "personal.middleName" },
  { pattern: /\b(last|family|surname)\b/, path: "personal.lastName" },
  { pattern: /\b(preferred|display) name\b/, path: "personal.preferredName" },

  // Contact
  { pattern: /\b(e[- ]?mail|email address)\b/, path: "contact.email" },
  { pattern: /\b(phone|mobile|cell|telephone)( number)?\b/, path: "contact.phone" },
  { pattern: /\bcountry\b(?!\s*phone|\s*dial|\s*code)/i, path: "contact.country" },
  { pattern: /\b(address|street address|address line 1)\b/, path: "contact.address" },
  { pattern: /\bcity\b/, path: "contact.city" },
  { pattern: /\b(state|province|region)\b/, path: "contact.state" },
  { pattern: /\b(zip|postal) code\b/, path: "contact.postalCode" },

  // Professional
  { pattern: /\blinkedin\b/, path: "professional.linkedin" },
  { pattern: /\bgithub\b/, path: "professional.github" },
  { pattern: /\bportfolio\b/, path: "professional.portfolio" },
  { pattern: /\b(website|personal site)\b/, path: "professional.website" },

  // Education (first record)
  { pattern: /\b(school|university|institution|college)\b/, path: "education.0.institution", sectionHint: /education/ },
  { pattern: /\bdegree\b/, path: "education.0.degree", sectionHint: /education/ },
  { pattern: /\b(field of study|major)\b/, path: "education.0.fieldOfStudy", sectionHint: /education/ },
  { pattern: /\bgpa\b/, path: "education.0.gpa", sectionHint: /education/ },

  // Employment (first record)
  { pattern: /\b(company|employer)\b/, path: "employment.0.company", sectionHint: /experience|employment|work/ },
  { pattern: /\b(job title|title|position)\b/, path: "employment.0.jobTitle", sectionHint: /experience|employment|work/ }
];

export class MappingEngine {
  constructor(
    private readonly profile: UserProfile,
    private readonly savedMappings: FieldMapping[] = []
  ) {}

  resolve(field: FieldDescriptor): MatchCandidate {
    const label = normalizeLabel(field.fingerprint.label);
    const accessibleName = normalizeLabel(field.fingerprint.accessibleName);
    const rawLabelLower = field.rawLabel ? normalizeLabel(field.rawLabel) : "";
    const combinedLabel = `${label} ${accessibleName}`.trim();
    const tenant = field.fingerprint.tenant;

    // 1. Check exact user saved mapping (highest priority)
    const userMapping = this.savedMappings.find((m) => {
      if (!m.enabled) return false;
      if (m.tenantScope !== "*" && m.tenantScope !== tenant) return false;
      const mappingLabel = normalizeLabel(m.fingerprint.label);
      return (
        mappingLabel === label ||
        mappingLabel === accessibleName ||
        (rawLabelLower && mappingLabel === rawLabelLower)
      );
    });

    if (userMapping) {
      if (userMapping.source === "ignore") {
        return {
          mapping: userMapping,
          source: "ignore",
          confidence: 100,
          reason: "Ignored permanently by user rule"
        };
      }

      if (userMapping.source === "fixedValue" && userMapping.fixedValue !== undefined) {
        return {
          mapping: userMapping,
          source: "fixedValue",
          value: userMapping.fixedValue,
          confidence: 100,
          reason: "User fixed-value mapping"
        };
      }

      if (userMapping.source === "profile" && userMapping.sourcePath) {
        const val = getProfileValueByPath(this.profile, userMapping.sourcePath);
        return {
          mapping: userMapping,
          source: "profile",
          sourcePath: userMapping.sourcePath,
          value: val,
          confidence: 100,
          reason: `User mapped to profile.${userMapping.sourcePath}`
        };
      }

      if (userMapping.source === "customField" && userMapping.sourcePath) {
        const customField = this.profile.customFields.find((c) => c.id === userMapping.sourcePath || c.name.toLowerCase() === userMapping.sourcePath?.toLowerCase());
        return {
          mapping: userMapping,
          source: "customField",
          sourcePath: userMapping.sourcePath,
          value: customField ? String(customField.value) : undefined,
          confidence: 100,
          reason: `User mapped to custom field "${customField?.name || userMapping.sourcePath}"`
        };
      }

      if (userMapping.source === "applicationAnswer" && userMapping.sourcePath) {
        const answer = this.profile.applicationAnswers.find((a) => a.id === userMapping.sourcePath || a.name.toLowerCase() === userMapping.sourcePath?.toLowerCase());
        return {
          mapping: userMapping,
          source: "applicationAnswer",
          sourcePath: userMapping.sourcePath,
          value: answer?.value,
          confidence: 100,
          reason: `User mapped to application answer "${answer?.name || userMapping.sourcePath}"`
        };
      }
    }

    // 2. Check Custom Fields matching by name
    for (const customField of this.profile.customFields) {
      if (normalizeLabel(customField.name) === label && customField.value !== undefined && customField.value !== "") {
        return {
          mapping: null,
          source: "customField",
          sourcePath: customField.id,
          value: String(customField.value),
          confidence: 90,
          reason: `Custom field name matches label: "${customField.name}"`
        };
      }
    }

    // 3. Check Application Answers matching by name
    for (const answer of this.profile.applicationAnswers) {
      if (normalizeLabel(answer.name) === label && answer.value) {
        return {
          mapping: null,
          source: "applicationAnswer",
          sourcePath: answer.id,
          value: answer.value,
          confidence: 90,
          reason: `Application answer matches question: "${answer.name}"`
        };
      }
    }

    // 4. Built-in Workday rules
    for (const rule of builtinRules) {
      if (rule.pattern.test(combinedLabel)) {
        if (rule.sectionHint && field.fingerprint.section) {
          if (!rule.sectionHint.test(field.fingerprint.section.toLowerCase())) {
            continue;
          }
        }

        const value = getProfileValueByPath(this.profile, rule.path);
        const confidence = calculateConfidence(field, { pattern: rule.pattern, path: rule.path });

        return {
          mapping: null,
          source: "builtin",
          sourcePath: rule.path,
          value,
          confidence: confidence.score,
          reason: `Built-in rule matched "${rule.path}" (${confidence.category})`
        };
      }
    }

    // 5. Unknown field
    return {
      mapping: null,
      source: "builtin",
      confidence: 0,
      reason: "No confident mapping found"
    };
  }
}
