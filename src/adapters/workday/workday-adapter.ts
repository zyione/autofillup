import type { AtsAdapter } from "../ats-adapter";
import type { FieldDescriptor, FieldFillResult, PageFingerprint } from "../../shared/types";
import { detectWorkday } from "../../content/detection/workday-detector";
import { detectPageFingerprint } from "../../content/detection/page-detector";
import { scanFields } from "../../content/fields/field-detector";
import { executeAutofillField } from "../../content/autofill/autofill-engine";
import type { MatchCandidate } from "../../shared/types/mapping";

export class WorkdayAdapter implements AtsAdapter {
  readonly id = "workday";
  readonly name = "Workday";

  supports(url: URL | Location): boolean {
    return detectWorkday(url as Location, document).isWorkday;
  }

  isApplicationPage(): boolean {
    return detectWorkday(location, document).isApplication;
  }

  detectFields(): FieldDescriptor[] {
    return scanFields(document);
  }

  getPageFingerprint(): PageFingerprint {
    return detectPageFingerprint(location, document);
  }

  getCurrentPageName(): string {
    return this.getPageFingerprint().heading;
  }

  async fillField(field: FieldDescriptor, value: string, overwrite: boolean): Promise<FieldFillResult> {
    const syntheticCandidate: MatchCandidate = {
      mapping: null,
      source: "builtin",
      value,
      confidence: 100,
      reason: "Direct field fill"
    };
    return executeAutofillField(field, syntheticCandidate, overwrite);
  }
}
