import type { FieldDescriptor } from "../../shared/types";

export interface ConfidenceAssessment {
  score: number;
  category: "AUTOMATIC" | "REVIEW" | "UNKNOWN";
  penaltyReasons: string[];
}

const ambiguousLabels = new Set([
  "name",
  "title",
  "date",
  "number",
  "type",
  "status",
  "information",
  "description",
  "other",
  "details"
]);

export function calculateConfidence(
  field: FieldDescriptor,
  matchedRule: { pattern: RegExp | string; path: string },
  exactUserMapping = false
): ConfidenceAssessment {
  if (exactUserMapping) {
    return {
      score: 100,
      category: "AUTOMATIC",
      penaltyReasons: []
    };
  }

  let score = 90;
  const penalties: string[] = [];
  const label = field.fingerprint.label.toLowerCase().trim();

  // Ambiguity penalty: if the label is just a single generic word like "name"
  if (ambiguousLabels.has(label)) {
    score -= 35;
    penalties.push(`Label "${label}" is ambiguous and requires contextual clarity`);
  }

  // Kind mismatch or uncertainty
  if (field.fingerprint.kind === "unknown") {
    score -= 20;
    penalties.push("Unknown component type");
  }

  // Section context bonus or penalty
  if (field.fingerprint.section) {
    const section = field.fingerprint.section.toLowerCase();
    if (section.includes("experience") && matchedRule.path.startsWith("education")) {
      score -= 40;
      penalties.push("Field in Experience section mapped to Education profile path");
    } else if (section.includes("education") && matchedRule.path.startsWith("employment")) {
      score -= 40;
      penalties.push("Field in Education section mapped to Employment profile path");
    }
  }

  // Ensure score stays within 0..100
  score = Math.max(0, Math.min(100, score));

  let category: "AUTOMATIC" | "REVIEW" | "UNKNOWN" = "UNKNOWN";
  if (score >= 80) {
    category = "AUTOMATIC";
  } else if (score >= 60) {
    category = "REVIEW";
  }

  return {
    score,
    category,
    penaltyReasons: penalties
  };
}
