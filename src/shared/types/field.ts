export type FieldKind =
  | "text"
  | "textarea"
  | "select"
  | "combobox"
  | "dropdown"
  | "radio"
  | "radioGroup"
  | "checkbox"
  | "date"
  | "unknown";

export type FieldOutcome = "filled" | "skipped" | "review" | "unknown" | "failed";

export interface FieldFingerprint {
  label: string;
  accessibleName: string;
  placeholder: string;
  kind: FieldKind;
  section: string;
  tenant: string;
  nearbyText?: string;
  role?: string;
}

export interface FieldOption {
  label: string;
  value: string;
  element?: HTMLElement;
}

export interface FieldDescriptor {
  id: string;
  element: HTMLElement;
  fingerprint: FieldFingerprint;
  required: boolean;
  visible: boolean;
  disabled?: boolean;
  options: string[] | FieldOption[];
  rawLabel?: string;
  sectionText?: string;
}

export interface FieldFillResult {
  fieldId: string;
  label: string;
  kind: FieldKind;
  outcome: FieldOutcome;
  detail: string;
  valueAttempted?: string;
  confidence?: number;
  mappingSource?: string;
}
