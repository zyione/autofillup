import { emptyProfile, type UserProfile, type ExportData } from "../shared/types";
import type { FieldMapping } from "../shared/types/mapping";

export const CURRENT_SCHEMA_VERSION = 1;

export interface StorageDataV1 {
  storageVersion: number;
  profile: UserProfile;
  fieldMappings: FieldMapping[];
  settings: {
    autoFillHighConfidence: boolean;
    overwriteExisting: boolean;
    highlightFields?: boolean;
    confidenceThreshold?: number;
  };
}

export function validateExportData(data: unknown): { valid: boolean; error?: string; data?: ExportData } {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Data is not a valid JSON object." };
  }

  const candidate = data as Record<string, unknown>;

  if (typeof candidate.version !== "number") {
    return { valid: false, error: "Missing or invalid schema version." };
  }

  if (!candidate.profile || typeof candidate.profile !== "object") {
    return { valid: false, error: "Profile data is missing or invalid." };
  }

  const profile = candidate.profile as Partial<UserProfile>;
  if (!profile.personal || !profile.contact) {
    return { valid: false, error: "Profile missing personal or contact sections." };
  }

  const exportData: ExportData = {
    version: candidate.version,
    exportedAt: typeof candidate.exportedAt === "string" ? candidate.exportedAt : new Date().toISOString(),
    profile: {
      ...emptyProfile(),
      ...profile,
      personal: { ...emptyProfile().personal, ...profile.personal },
      contact: { ...emptyProfile().contact, ...profile.contact },
      professional: { ...emptyProfile().professional, ...profile.professional },
      education: Array.isArray(profile.education) ? profile.education : [],
      employment: Array.isArray(profile.employment) ? profile.employment : [],
      skills: { ...emptyProfile().skills, ...profile.skills },
      customFields: Array.isArray(profile.customFields) ? profile.customFields : [],
      applicationAnswers: Array.isArray(profile.applicationAnswers) ? profile.applicationAnswers : []
    },
    customFields: Array.isArray(candidate.customFields) ? candidate.customFields as any : profile.customFields,
    applicationAnswers: Array.isArray(candidate.applicationAnswers) ? candidate.applicationAnswers as any : profile.applicationAnswers,
    fieldMappings: Array.isArray(candidate.fieldMappings) ? candidate.fieldMappings : [],
    settings: candidate.settings ?? {}
  };

  return { valid: true, data: exportData };
}

export function migrateData(raw: Record<string, unknown>): StorageDataV1 {
  const version = typeof raw.storageVersion === "number" ? raw.storageVersion : 1;
  const rawProfile = raw.profile as Partial<UserProfile> | undefined;

  const profile: UserProfile = {
    ...emptyProfile(),
    ...(rawProfile ?? {}),
    personal: { ...emptyProfile().personal, ...(rawProfile?.personal ?? {}) },
    contact: { ...emptyProfile().contact, ...(rawProfile?.contact ?? {}) },
    professional: { ...emptyProfile().professional, ...(rawProfile?.professional ?? {}) },
    education: Array.isArray(rawProfile?.education) ? rawProfile!.education : [],
    employment: Array.isArray(rawProfile?.employment) ? rawProfile!.employment : [],
    skills: { ...emptyProfile().skills, ...(rawProfile?.skills ?? {}) },
    customFields: Array.isArray(rawProfile?.customFields) ? rawProfile!.customFields : [],
    applicationAnswers: Array.isArray(rawProfile?.applicationAnswers) ? rawProfile!.applicationAnswers : []
  };

  const fieldMappings: FieldMapping[] = Array.isArray(raw.fieldMappings) ? (raw.fieldMappings as FieldMapping[]) : [];

  const rawSettings = (raw.settings ?? {}) as Record<string, unknown>;
  const settings = {
    autoFillHighConfidence: typeof rawSettings.autoFillHighConfidence === "boolean" ? rawSettings.autoFillHighConfidence : true,
    overwriteExisting: typeof rawSettings.overwriteExisting === "boolean" ? rawSettings.overwriteExisting : false,
    highlightFields: typeof rawSettings.highlightFields === "boolean" ? rawSettings.highlightFields : true,
    confidenceThreshold: typeof rawSettings.confidenceThreshold === "number" ? rawSettings.confidenceThreshold : 80
  };

  return {
    storageVersion: CURRENT_SCHEMA_VERSION,
    profile,
    fieldMappings,
    settings
  };
}
