import type { PageFingerprint } from "../../shared/types";

export function detectPageFingerprint(loc: Location = location, doc: Document = document): PageFingerprint {
  const url = loc.href;
  const pathname = loc.pathname;

  // Heading detection (Page header or current section header)
  const headingEl = doc.querySelector("h1, h2, [data-automation-id='pageHeader'], [data-automation-id='stepHeader'], [data-automation-id*='heading']");
  const heading = headingEl?.textContent?.replace(/\s+/g, " ").trim() || "Workday Application Page";

  // Step indicator detection (e.g., Step 1 of 4 or 'My Information', 'My Experience')
  const stepEl = doc.querySelector("[data-automation-id='stepIndicator'], [aria-current='step'], [data-automation-id*='progressBar']");
  const stepIndicator = stepEl?.textContent?.replace(/\s+/g, " ").trim();

  // Section headings
  const sectionEls = Array.from(doc.querySelectorAll("h2, h3, legend, [data-automation-id*='sectionHeader']"));
  const sections = sectionEls
    .map((el) => el.textContent?.replace(/\s+/g, " ").trim() || "")
    .filter((s) => s.length > 0 && s !== heading);

  // Field count
  const fields = doc.querySelectorAll("input:not([type='hidden']), textarea, select, [role='combobox'], [role='radiogroup']");
  const fieldCount = fields.length;

  return {
    url,
    pathname,
    heading,
    stepIndicator,
    sections,
    fieldCount
  };
}

export function areFingerprintsEqual(a?: PageFingerprint, b?: PageFingerprint): boolean {
  if (!a || !b) return false;
  if (a.url !== b.url) return false;
  if (a.heading !== b.heading) return false;
  if (a.stepIndicator !== b.stepIndicator) return false;
  return true;
}
