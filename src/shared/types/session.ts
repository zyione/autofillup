import type { FieldDescriptor, FieldFillResult } from "./field";

export type ApplicationState =
  | "IDLE"
  | "WORKDAY_DETECTED"
  | "APPLICATION_DETECTED"
  | "SCANNING_PAGE"
  | "MAPPING_FIELDS"
  | "AUTOFILLING"
  | "VERIFYING"
  | "READY_FOR_REVIEW"
  | "WAITING_FOR_PAGE_CHANGE";

export interface PageFingerprint {
  url: string;
  pathname: string;
  heading: string;
  stepIndicator?: string;
  sections: string[];
  fieldCount: number;
}

export interface UnknownFieldInfo {
  fieldId: string;
  label: string;
  accessibleName: string;
  placeholder: string;
  kind: string;
  section: string;
  options?: string[];
  detectedAt: string;
}

export interface ApplicationSession {
  id: string;
  tabId?: number;
  tenant: string;
  applicationUrl: string;
  currentPage: string;
  pageFingerprint?: PageFingerprint;
  state: ApplicationState;
  startedAt: string;
  lastUpdatedAt: string;
  results: FieldFillResult[];
  unknownFields: UnknownFieldInfo[];
}
