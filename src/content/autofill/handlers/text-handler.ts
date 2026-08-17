import type { FieldDescriptor, FieldFillResult } from "../../../shared/types";
import { dispatchEventSequence, hasExistingValue, setReactValue } from "../react-helper";

export async function fillTextInput(
  field: FieldDescriptor,
  value: string,
  overwrite: boolean
): Promise<FieldFillResult> {
  const element = field.element as HTMLInputElement | HTMLTextAreaElement;

  if (!element || !(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: field.fingerprint.kind,
      outcome: "failed",
      detail: "Element is not a valid text input or textarea."
    };
  }

  if (hasExistingValue(element) && !overwrite) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: field.fingerprint.kind,
      outcome: "skipped",
      detail: "Skipped to preserve existing value."
    };
  }

  try {
    element.focus();
    setReactValue(element, value);
    dispatchEventSequence(element);

    // Verification
    const isRetained = element.value === value;
    if (isRetained) {
      return {
        fieldId: field.id,
        label: field.fingerprint.label,
        kind: field.fingerprint.kind,
        outcome: "filled",
        detail: "Filled successfully.",
        valueAttempted: value
      };
    } else {
      return {
        fieldId: field.id,
        label: field.fingerprint.label,
        kind: field.fingerprint.kind,
        outcome: "review",
        detail: "Value was not completely retained by component.",
        valueAttempted: value
      };
    }
  } catch (err) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: field.fingerprint.kind,
      outcome: "failed",
      detail: `Exception while filling text: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
