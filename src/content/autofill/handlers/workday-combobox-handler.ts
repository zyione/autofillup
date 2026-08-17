import type { FieldDescriptor, FieldFillResult } from "../../../shared/types";
import { normalizeText } from "../../fields/field-normalizer";
import { dispatchEventSequence, setReactValue, waitMs } from "../react-helper";

export async function fillWorkdayCombobox(
  field: FieldDescriptor,
  value: string,
  overwrite: boolean
): Promise<FieldFillResult> {
  const input = field.element.matches("input")
    ? (field.element as HTMLInputElement)
    : field.element.querySelector<HTMLInputElement>("input");

  if (!input) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "combobox",
      outcome: "failed",
      detail: "Combobox input element not found."
    };
  }

  if (input.value.trim() && !overwrite) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "combobox",
      outcome: "skipped",
      detail: `Skipped existing combobox value: "${input.value}"`
    };
  }

  try {
    input.focus();
    setReactValue(input, value);
    dispatchEventSequence(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

    await waitMs(350);

    // Look for popup / listbox / options that opened
    const controlsId = input.getAttribute("aria-controls");
    const popup =
      (controlsId ? document.getElementById(controlsId) : null) ||
      document.querySelector("[role='listbox'], [data-automation-id='prompt-options'], [data-automation-id*='searchResults']") ||
      document.body;

    const targetNorm = normalizeText(value);
    const optionElements = Array.from(
      popup.querySelectorAll<HTMLElement>("[role='option'], li, [data-automation-id*='promptOption']")
    );

    const matched = optionElements.find((el) => {
      const textNorm = normalizeText(el.textContent);
      return textNorm === targetNorm || textNorm.includes(targetNorm);
    });

    if (matched) {
      matched.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      matched.click();
      await waitMs(100);
      return {
        fieldId: field.id,
        label: field.fingerprint.label,
        kind: "combobox",
        outcome: "filled",
        detail: `Selected combobox item: "${matched.textContent?.trim()}"`,
        valueAttempted: value
      };
    }

    // Press Enter to confirm typed search if option was not explicitly listed
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));

    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "combobox",
      outcome: "filled",
      detail: `Typed search query "${value}" into combobox.`,
      valueAttempted: value
    };
  } catch (err) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "combobox",
      outcome: "failed",
      detail: `Combobox interaction failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
