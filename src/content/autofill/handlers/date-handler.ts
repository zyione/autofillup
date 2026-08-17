import type { FieldDescriptor, FieldFillResult } from "../../../shared/types";
import { dispatchEventSequence, setReactValue } from "../react-helper";

export async function fillDateInput(
  field: FieldDescriptor,
  value: string,
  overwrite: boolean
): Promise<FieldFillResult> {
  const input = field.element as HTMLInputElement;

  if (!input || !(input instanceof HTMLInputElement)) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "date",
      outcome: "failed",
      detail: "Element is not a valid date input."
    };
  }

  if (input.value && !overwrite) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "date",
      outcome: "skipped",
      detail: "Skipped existing date value."
    };
  }

  // Normalize date string: handle YYYY-MM-DD, MM/DD/YYYY, MM/YYYY
  let formattedDate = value.trim();
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch && input.type !== "date") {
    // If text input in US Workday, format as MM/DD/YYYY
    const [, y, m, d] = isoMatch;
    formattedDate = `${m}/${d}/${y}`;
  }

  try {
    input.focus();
    setReactValue(input, formattedDate);
    dispatchEventSequence(input);

    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "date",
      outcome: "filled",
      detail: `Date set to "${formattedDate}".`,
      valueAttempted: formattedDate
    };
  } catch (err) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "date",
      outcome: "failed",
      detail: `Failed setting date: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
