export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/['’]s\b/gi, "")
    .replace(/\(s\)/gi, "")
    .replace(/[*:]/g, " ")
    .replace(/[^a-z0-9\s/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const synonymMap: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(legal\s+)?(first|given)\s*name(\s*s)?\b/gi, replacement: "first name" },
  { pattern: /\bgiven\s*name(s)?\b/gi, replacement: "first name" },
  { pattern: /\b(legal\s+)?middle\s*name(\s*s)?\b/gi, replacement: "middle name" },
  { pattern: /\b(legal\s+)?(last|family|surname)\s*name(\s*s)?\b/gi, replacement: "last name" },
  { pattern: /\b(last|family|surname)\b/gi, replacement: "last name" },
  { pattern: /\bpreferred\s+(name|first\s+name)\b/gi, replacement: "preferred name" },
  { pattern: /\be[- ]?mail(\s+address)?\b/gi, replacement: "email" },
  { pattern: /\b(mobile|cell|telephone|phone)\s+number\b/gi, replacement: "phone" },
  { pattern: /\b(mobile|cell)\s+phone\b/gi, replacement: "phone" },
  { pattern: /\bstreet(\s+address)?\b/gi, replacement: "address" },
  { pattern: /\baddress(\s+line\s+1|\s+name)?\b/gi, replacement: "address" },
  { pattern: /\b(zip|postal)\s+code\b/gi, replacement: "postal code" },
  { pattern: /\bzip\b/gi, replacement: "postal code" },
  { pattern: /\bstate\s*\/\s*province\s*\/\s*region\b/gi, replacement: "state" },
  { pattern: /\bstate\s*\/\s*province\b/gi, replacement: "state" },
  { pattern: /\bcountry\s*\/\s*territory\b/gi, replacement: "country" },
  { pattern: /\bcountry\s+territory\b/gi, replacement: "country" },
  { pattern: /\blinkedin(\s+profile|\s+url)?\b/gi, replacement: "linkedin" },
  { pattern: /\bsocial\s+network\s+url(s)?\b/gi, replacement: "linkedin" },
  { pattern: /\bgithub(\s+profile)?\b/gi, replacement: "github" },
  { pattern: /\bportfolio\s+url|personal\s+portfolio\b/gi, replacement: "portfolio" },
  { pattern: /\bwebsite\s+url|personal\s+website\b/gi, replacement: "website" },
  { pattern: /\bphone\s+device\s+type|device\s+type\b/gi, replacement: "phone device type" },
  { pattern: /\bcountry\s+phone\s+code|country\s+dial\s+code\b/gi, replacement: "country phone code" }
];

export function normalizeLabel(raw: string): string {
  let normalized = normalizeText(raw);

  // Apply synonym rewrites
  for (const { pattern, replacement } of synonymMap) {
    normalized = normalized.replace(pattern, replacement);
  }

  // Clean trailing punctuation or helper labels like "(required)", "(optional)", single-letter fragments
  normalized = normalized
    .replace(/\b(required|optional)\b/gi, "")
    .replace(/\s+[a-z]\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Deduplicate accidental "last name name" or "first name name"
  normalized = normalized
    .replace(/\bfirst name name\b/gi, "first name")
    .replace(/\blast name name\b/gi, "last name")
    .replace(/\bmiddle name name\b/gi, "middle name")
    .replace(/\baddress name\b/gi, "address");

  return normalized;
}

export function areLabelsEquivalent(a: string, b: string): boolean {
  const normA = normalizeLabel(a);
  const normB = normalizeLabel(b);
  if (!normA || !normB) return false;
  return normA === normB;
}
