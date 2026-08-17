import type { FieldDescriptor, FieldFillResult } from "../../../shared/types";
import { normalizeText } from "../../fields/field-normalizer";
import { waitMs } from "../react-helper";

export async function fillWorkdayDropdown(
  field: FieldDescriptor,
  value: string,
  overwrite: boolean
): Promise<FieldFillResult> {
  const trigger = field.element;

  if (!trigger) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "dropdown",
      outcome: "failed",
      detail: "Trigger element not found."
    };
  }

  // Check if already selected
  const currentText = trigger.textContent?.trim() || "";
  if (currentText && currentText !== "Select..." && currentText !== "Choose..." && !overwrite) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "dropdown",
      outcome: "skipped",
      detail: `Skipped existing selection: "${currentText}"`
    };
  }

  try {
    // Open dropdown popup
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    trigger.click();
    await waitMs(200);

    // Look for popup menu in document
    const popup =
      document.querySelector("[role='listbox'], [data-automation-id='popup-menu'], ul[data-automation-id*='list']") ||
      document.body;

    const targetNorm = normalizeText(value);
    const optionElements = Array.from(popup.querySelectorAll<HTMLElement>("[role='option'], li, [data-automation-id*='menuItem']"));

    const matched = optionElements.find((el) => {
      const textNorm = normalizeText(el.textContent);
      return textNorm === targetNorm || textNorm.includes(targetNorm);
    });

    if (!matched) {
      // Close dropdown
      document.body.click();
      return {
        fieldId: field.id,
        label: field.fingerprint.label,
        kind: "dropdown",
        outcome: "review",
        detail: `No matching dropdown option for "${value}".`
      };
    }

    matched.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    matched.click();
    await waitMs(100);

    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "dropdown",
      outcome: "filled",
      detail: `Selected: "${matched.textContent?.trim()}"`,
      valueAttempted: value
    };
  } catch (err) {
    return {
      fieldId: field.id,
      label: field.fingerprint.label,
      kind: "dropdown",
      outcome: "failed",
      detail: `Failed interacting with Workday dropdown: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
