import type { FieldOutcome } from "./field";
export interface ApplicationSession { id: string; tenant: string; url: string; startedAt: string; lastUpdatedAt: string; outcomes: Array<{ label: string; outcome: FieldOutcome; detail: string }>; }
