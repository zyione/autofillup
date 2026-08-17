import type { FieldDescriptor, FieldFillResult, MatchCandidate } from "../../shared/types";
import { fillTextInput } from "./handlers/text-handler";
import { fillNativeSelect } from "./handlers/select-handler";
import { fillWorkdayDropdown } from "./handlers/workday-dropdown-handler";
import { fillWorkdayCombobox } from "./handlers/workday-combobox-handler";
import { fillRadioGroup } from "./handlers/radio-handler";
import { fillCheckbox } from "./handlers/checkbox-handler";
import { fillDateInput } from "./handlers/date-handler";

export async function executeAutofillField(
  field: FieldDescriptor,
  candidate: MatchCandidate,
  overwrite: boolean
): Promise<FieldFillResult> {
  const label = field.fingerprint.label || field.fingerprint.accessibleName || "Unnamed field";

  // Check if ignored
  if (candidate.source === "ignore") {
    return {
      fieldId: field.id,
      label,
      kind: field.fingerprint.kind,
      outcome: "skipped",
      detail: "Field ignored by user rule.",
      confidence: 100,
      mappingSource: "ignore"
    };
  }

  // If no value resolved
  if (candidate.value === undefined || candidate.value === "") {
    return {
      fieldId: field.id,
      label,
      kind: field.fingerprint.kind,
      outcome: "unknown",
      detail: candidate.reason || "No mapping value available in profile.",
      confidence: candidate.confidence,
      mappingSource: candidate.source
    };
  }

  // Low confidence review threshold (< 80)
  if (candidate.confidence < 80) {
    return {
      fieldId: field.id,
      label,
      kind: field.fingerprint.kind,
      outcome: "review",
      detail: `Low confidence match (${candidate.confidence}%): ${candidate.reason}`,
      valueAttempted: candidate.value,
      confidence: candidate.confidence,
      mappingSource: candidate.source
    };
  }

  let result: FieldFillResult;

  switch (field.fingerprint.kind) {
    case "text":
    case "textarea":
      result = await fillTextInput(field, candidate.value, overwrite);
      break;

    case "select":
      result = await fillNativeSelect(field, candidate.value, overwrite);
      break;

    case "dropdown":
      result = await fillWorkdayDropdown(field, candidate.value, overwrite);
      break;

    case "combobox":
      result = await fillWorkdayCombobox(field, candidate.value, overwrite);
      break;

    case "radioGroup":
      result = await fillRadioGroup(field, candidate.value, overwrite);
      break;

    case "checkbox":
      result = await fillCheckbox(field, candidate.value, overwrite);
      break;

    case "date":
      result = await fillDateInput(field, candidate.value, overwrite);
      break;

    default:
      result = {
        fieldId: field.id,
        label,
        kind: field.fingerprint.kind,
        outcome: "review",
        detail: "Unrecognized field kind needs review."
      };
  }

  result.confidence = candidate.confidence;
  result.mappingSource = candidate.source;
  return result;
}
