import type { FieldDescriptor, FieldFillResult } from "../../../shared/types";
import { dispatchEventSequence } from "../react-helper";

export async function fillCheckbox(
  field: FieldDescriptor,
  value: string,
  overwrite: boolean
): Promise<FieldFillResult> {
  const checkbox = field.element as HTMLInputElement;

  if (!checkbox || checkbox.type !== "checkbox") {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "checkbox",
      outcome: "failed",
      detail: "Element is not a checkbox input."
    };
  }

  // Check for legal / declaration / consent terms: do not auto-accept
  const label = field.fingerprint.label.toLowerCase();
  const isLegalConsent =
    label.includes("consent") ||
    label.includes("terms") ||
    label.includes("certify") ||
    label.includes("acknowledge") ||
    label.includes("declaration") ||
    label.includes("agree");

  if (isLegalConsent && value !== "true") {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "checkbox",
      outcome: "review",
      detail: "Legal acknowledgement or consent checkbox left for manual user review."
    };
  }

  if (checkbox.checked && !overwrite) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "checkbox",
      outcome: "skipped",
      detail: "Skipped to preserve existing checked state."
    };
  }

  const shouldBeChecked = value === "true" || value === "yes" || value === "1";

  try {
    if (checkbox.checked !== shouldBeChecked) {
      checkbox.focus();
      checkbox.checked = shouldBeChecked;
      dispatchEventSequence(checkbox);
      checkbox.click();
    }

    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "checkbox",
      outcome: "filled",
      detail: `Checkbox set to ${shouldBeChecked ? "checked" : "unchecked"}.`,
      valueAttempted: String(shouldBeChecked)
    };
  } catch (err) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "checkbox",
      outcome: "failed",
      detail: `Failed toggling checkbox: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
