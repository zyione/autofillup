import type { FieldDescriptor, FieldFillResult } from "../../../shared/types";
import { normalizeText } from "../../fields/field-normalizer";
import { dispatchEventSequence, hasExistingValue, setReactValue } from "../react-helper";

export async function fillNativeSelect(
  field: FieldDescriptor,
  value: string,
  overwrite: boolean
): Promise<FieldFillResult> {
  const element = field.element as HTMLSelectElement;

  if (!element || !(element instanceof HTMLSelectElement)) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "select",
      outcome: "failed",
      detail: "Element is not a valid HTMLSelectElement."
    };
  }

  if (hasExistingValue(element) && !overwrite) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "select",
      outcome: "skipped",
      detail: "Skipped to preserve existing selected option."
    };
  }

  const targetNorm = normalizeText(value);
  const options = Array.from(element.options);

  // Exact or normalized match
  const matched = options.find((opt) => {
    const textNorm = normalizeText(opt.text);
    const valNorm = normalizeText(opt.value);
    return textNorm === targetNorm || valNorm === targetNorm || textNorm.includes(targetNorm);
  });

  if (!matched) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "select",
      outcome: "review",
      detail: `No matching option found for "${value}". Available options: ${options.map((o) => o.text).filter(Boolean).slice(0, 5).join(", ")}`
    };
  }

  try {
    element.focus();
    matched.selected = true;
    setReactValue(element, matched.value);
    dispatchEventSequence(element);

    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "select",
      outcome: "filled",
      detail: `Selected option: "${matched.text}"`,
      valueAttempted: matched.value
    };
  } catch (err) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "select",
      outcome: "failed",
      detail: `Failed to select option: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
