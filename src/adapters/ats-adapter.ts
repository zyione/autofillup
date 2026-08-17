import type { FieldDescriptor, FieldFillResult, PageFingerprint, UserProfile } from "../shared/types";

export interface AtsAdapter {
  readonly id: string;
  readonly name: string;
  supports(url: URL | Location): boolean;
  isApplicationPage(): boolean;
  detectFields(): FieldDescriptor[];
  getPageFingerprint(): PageFingerprint;
  getCurrentPageName(): string;
  fillField(field: FieldDescriptor, value: string, overwrite: boolean): Promise<FieldFillResult>;
}
