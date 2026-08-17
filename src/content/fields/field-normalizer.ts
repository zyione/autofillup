export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[*:]/g, " ")
    .replace(/[^a-z0-9\s/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const synonymMap: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(legal\s+)?(first|given)\s+name\b/g, replacement: "first name" },
  { pattern: /\bgiven\s+name\b/g, replacement: "first name" },
  { pattern: /\b(legal\s+)?(last|family|surname)\s+name\b/g, replacement: "last name" },
  { pattern: /\b(last|family|surname)\b/g, replacement: "last name" },
  { pattern: /\bpreferred\s+(name|first\s+name)\b/g, replacement: "preferred name" },
  { pattern: /\be[- ]?mail(\s+address)?\b/g, replacement: "email" },
  { pattern: /\b(mobile|cell|telephone|phone)\s+number\b/g, replacement: "phone" },
  { pattern: /\b(mobile|cell)\s+phone\b/g, replacement: "phone" },
  { pattern: /\bstreet(\s+address)?\b/g, replacement: "address" },
  { pattern: /\baddress\s+line\s+1\b/g, replacement: "address" },
  { pattern: /\b(zip|postal)\s+code\b/g, replacement: "postal code" },
  { pattern: /\bzip\b/g, replacement: "postal code" },
  { pattern: /\bstate\s*\/\s*province\s*\/\s*region\b/g, replacement: "state" },
  { pattern: /\bstate\s*\/\s*province\b/g, replacement: "state" },
  { pattern: /\bcountry\s*\/\s*territory\b/g, replacement: "country" },
  { pattern: /\blinkedin(\s+profile)?\b/g, replacement: "linkedin" },
  { pattern: /\bgithub(\s+profile)?\b/g, replacement: "github" },
  { pattern: /\bportfolio\s+url|personal\s+portfolio\b/g, replacement: "portfolio" },
  { pattern: /\bwebsite\s+url|personal\s+website\b/g, replacement: "website" }
];

export function normalizeLabel(raw: string): string {
  let normalized = normalizeText(raw);

  // Apply synonym rewrites
  for (const { pattern, replacement } of synonymMap) {
    normalized = normalized.replace(pattern, replacement);
  }

  // Clean trailing punctuation or helper labels like "(required)", "(optional)"
  normalized = normalized
    .replace(/\b(required|optional)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Deduplicate accidental "last name name" or "first name name"
  normalized = normalized
    .replace(/\bfirst name name\b/g, "first name")
    .replace(/\blast name name\b/g, "last name");

  return normalized;
}

export function areLabelsEquivalent(a: string, b: string): boolean {
  const normA = normalizeLabel(a);
  const normB = normalizeLabel(b);
  if (!normA || !normB) return false;
  return normA === normB;
}
