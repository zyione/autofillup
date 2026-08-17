export type FieldKind = "text" | "textarea" | "select" | "combobox" | "radio" | "checkbox" | "date" | "unknown";
export type FieldOutcome = "filled" | "skipped" | "review" | "unknown" | "failed";
export interface FieldFingerprint { label: string; accessibleName: string; placeholder: string; kind: FieldKind; section: string; tenant: string; }
export interface FieldDescriptor { id: string; element: HTMLElement; fingerprint: FieldFingerprint; required: boolean; visible: boolean; options: string[]; }
