import type { FieldFingerprint, FieldKind } from "./field";

export type MappingSource =
  | "profile"
  | "customField"
  | "applicationAnswer"
  | "fixedValue"
  | "ignore"
  | "repeatingRecord";

export type IgnoreScope = "once" | "application" | "permanent";

export interface FieldMapping {
  id: string;
  fingerprint: FieldFingerprint;
  source: MappingSource;
  sourcePath?: string;
  fixedValue?: string;
  confidence?: number;
  tenantScope: string; // "*" for all tenants or specific hostname e.g. "theapexgroup.wd3.myworkdayjobs.com"
  enabled: boolean;
  ignoreScope?: IgnoreScope;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchCandidate {
  mapping: FieldMapping | null;
  source: MappingSource | "builtin";
  sourcePath?: string;
  value?: string;
  confidence: number;
  reason: string;
}
