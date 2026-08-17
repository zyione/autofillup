import type { FieldDescriptor, FieldFillResult } from "../../../shared/types";
import { normalizeText } from "../../fields/field-normalizer";
import { dispatchEventSequence } from "../react-helper";
import { resolveLabelForElement } from "../../fields/field-detector";

export async function fillRadioGroup(
  field: FieldDescriptor,
  value: string,
  overwrite: boolean
): Promise<FieldFillResult> {
  const container = field.element;
  const radios = Array.from(container.querySelectorAll<HTMLInputElement>("input[type='radio']"));

  if (radios.length === 0) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "radioGroup",
      outcome: "failed",
      detail: "No radio button elements found in group."
    };
  }

  // Check if any radio is currently checked
  const checkedRadio = radios.find((r) => r.checked);
  if (checkedRadio && !overwrite) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "radioGroup",
      outcome: "skipped",
      detail: `Skipped existing selected radio option.`
    };
  }

  const targetNorm = normalizeText(value);
  const isTargetAffirmative = targetNorm === "yes" || targetNorm === "true" || targetNorm === "1";
  const isTargetNegative = targetNorm === "no" || targetNorm === "false" || targetNorm === "0";

  let matchedRadio: HTMLInputElement | undefined;

  for (const radio of radios) {
    const { rawLabel } = resolveLabelForElement(radio);
    const radioTextNorm = normalizeText(rawLabel || radio.value);

    // Exact text match
    if (radioTextNorm === targetNorm || radioTextNorm.includes(targetNorm)) {
      matchedRadio = radio;
      break;
    }

    // Boolean affirmative/negative match
    if (isTargetAffirmative && (radioTextNorm === "yes" || radioTextNorm === "true" || radio.value === "yes")) {
      matchedRadio = radio;
      break;
    }
    if (isTargetNegative && (radioTextNorm === "no" || radioTextNorm === "false" || radio.value === "no")) {
      matchedRadio = radio;
      break;
    }
  }

  if (!matchedRadio) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "radioGroup",
      outcome: "review",
      detail: `Could not match radio option for value "${value}".`
    };
  }

  try {
    matchedRadio.focus();
    matchedRadio.checked = true;
    dispatchEventSequence(matchedRadio);
    matchedRadio.click();

    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "radioGroup",
      outcome: "filled",
      detail: `Selected radio option for "${value}".`,
      valueAttempted: value
    };
  } catch (err) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "radioGroup",
      outcome: "failed",
      detail: `Failed selecting radio button: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
