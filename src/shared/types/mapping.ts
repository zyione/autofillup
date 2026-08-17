import type { FieldFingerprint } from "./field";
export type MappingSource = "profile" | "customField" | "applicationAnswer" | "fixedValue" | "ignore";
export interface FieldMapping { id: string; fingerprint: FieldFingerprint; source: MappingSource; sourcePath?: string; fixedValue?: string; tenantScope: string; enabled: boolean; createdAt: string; updatedAt: string; }
