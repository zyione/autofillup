import type { FieldDescriptor, FieldFingerprint, FieldKind, FieldOption } from "../../shared/types";
import { normalizeLabel, normalizeText } from "./field-normalizer";

function getElementText(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;
  if (el.closest('[aria-hidden="true"]')) return false;
  const style = typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(el) : null;
  if (style && (style.display === "none" || style.visibility === "hidden" || style.opacity === "0")) {
    return false;
  }
  if (el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length > 0)) {
    return true;
  }
  // Fallback for jsdom / happy-dom environments where geometry is 0 by default
  return !(style && style.display === "none");
}

export function resolveLabelForElement(el: HTMLElement): { label: string; rawLabel: string } {
  // 1. Explicit label with for="id"
  if (el.id) {
    const explicitLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (explicitLabel) {
      const text = getElementText(explicitLabel);
      if (text) return { label: normalizeLabel(text), rawLabel: text };
    }
  }

  // 2. aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/);
    const texts = ids
      .map((id) => getElementText(document.getElementById(id)))
      .filter((t) => t.length > 0)
      .join(" ");
    if (texts) return { label: normalizeLabel(texts), rawLabel: texts };
  }

  // 3. Enclosing label
  const enclosingLabel = el.closest("label");
  if (enclosingLabel) {
    // Clone to remove the input's own text if any
    const clone = enclosingLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("input, select, textarea, button").forEach((n) => n.remove());
    const text = getElementText(clone);
    if (text) return { label: normalizeLabel(text), rawLabel: text };
  }

  // 4. aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) {
    return { label: normalizeLabel(ariaLabel), rawLabel: ariaLabel };
  }

  // 5. Nearby Workday Form Label (e.g. data-automation-id="formLabel" or container's label)
  const container = el.closest("[data-automation-id*='formField'], [data-automation-id*='form-group'], fieldset, .form-group, tr, td, div");
  if (container) {
    const formLabel = container.querySelector("label, [data-automation-id*='label'], [data-automation-id*='Label'], legend");
    if (formLabel && formLabel !== el) {
      const text = getElementText(formLabel);
      if (text) return { label: normalizeLabel(text), rawLabel: text };
    }
  }

  // 6. Placeholder
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) {
    return { label: normalizeLabel(placeholder), rawLabel: placeholder };
  }

  return { label: "", rawLabel: "" };
}

export function detectFieldKind(el: HTMLElement): FieldKind {
  if (el instanceof HTMLTextAreaElement) return "textarea";
  if (el instanceof HTMLSelectElement) return "select";

  const role = el.getAttribute("role");
  if (role === "combobox" || el.getAttribute("aria-autocomplete") || el.hasAttribute("data-automation-id-searchbox")) {
    return "combobox";
  }

  if (role === "radiogroup" || el.matches("fieldset:has(input[type='radio'])")) {
    return "radioGroup";
  }

  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase();
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "date" || type === "datetime-local") return "date";
    return "text";
  }

  if (el.getAttribute("data-automation-id")?.includes("select") || el.getAttribute("data-automation-id")?.includes("dropdown")) {
    return "dropdown";
  }

  return "unknown";
}

export function extractOptions(el: HTMLElement, kind: FieldKind): string[] {
  if (el instanceof HTMLSelectElement) {
    return Array.from(el.options)
      .map((o) => o.text.trim())
      .filter((t) => t.length > 0);
  }

  if (kind === "radioGroup" || el.matches("fieldset")) {
    const radios = el.querySelectorAll<HTMLInputElement>("input[type='radio']");
    const options: string[] = [];
    radios.forEach((radio) => {
      const { rawLabel } = resolveLabelForElement(radio);
      if (rawLabel) options.push(rawLabel);
      else if (radio.value) options.push(radio.value);
    });
    return options;
  }

  if (kind === "combobox" || kind === "dropdown") {
    // Check if dropdown items are already rendered in aria-controls or popup list
    const controls = el.getAttribute("aria-controls");
    if (controls) {
      const listEl = document.getElementById(controls);
      if (listEl) {
        return Array.from(listEl.querySelectorAll("[role='option'], li"))
          .map((item) => getElementText(item))
          .filter((t) => t.length > 0);
      }
    }
  }

  return [];
}

export function scanFields(root: HTMLElement | Document = document): FieldDescriptor[] {
  const allElements = Array.from(
    root.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]), textarea, select, [role="combobox"], [role="radiogroup"], [data-automation-id*="select-widget"], [data-automation-id*="dropdown"]'
    )
  );

  // Filter out child inputs that belong to a parent container with role="combobox" or role="radiogroup"
  const elements = allElements.filter((el) => {
    if (el instanceof HTMLInputElement) {
      const parentCombobox = el.closest('[role="combobox"], [data-automation-id*="select-widget"]');
      if (parentCombobox && parentCombobox !== el) {
        return false;
      }
    }
    return true;
  });

  const seenRadiogroupNames = new Set<string>();
  const descriptors: FieldDescriptor[] = [];

  for (let index = 0; index < elements.length; index++) {
    const el = elements[index];
    if (!isElementVisible(el)) continue;

    // Handle radio buttons grouped by name
    if (el instanceof HTMLInputElement && el.type === "radio") {
      const name = el.name;
      if (name) {
        if (seenRadiogroupNames.has(name)) continue;
        seenRadiogroupNames.add(name);

        const groupRadios = Array.from(root.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`));
        const groupContainer = el.closest("[role='radiogroup'], fieldset, [data-automation-id*='formField']") || el.parentElement || el;
        const { label, rawLabel } = resolveLabelForElement(groupContainer as HTMLElement);
        const options = groupRadios.map((r) => resolveLabelForElement(r).rawLabel || r.value).filter(Boolean);

        const section = getElementText(el.closest("section, fieldset, [data-automation-id*='section']")?.querySelector("h2, h3, legend"));

        descriptors.push({
          id: `radioGroup-${name}-${index}`,
          element: groupContainer as HTMLElement,
          fingerprint: {
            label: label || normalizeLabel(rawLabel || name),
            accessibleName: el.getAttribute("aria-label") ? normalizeLabel(el.getAttribute("aria-label")!) : "",
            placeholder: "",
            kind: "radioGroup",
            section: normalizeLabel(section),
            tenant: location.hostname
          },
          required: el.required || el.getAttribute("aria-required") === "true",
          visible: true,
          options,
          rawLabel: rawLabel || name,
          sectionText: section
        });
        continue;
      }
    }

    const kind = detectFieldKind(el);
    const { label, rawLabel } = resolveLabelForElement(el);
    const sectionEl = el.closest("section, fieldset, [data-automation-id*='section']");
    const sectionText = getElementText(sectionEl?.querySelector("h2, h3, legend, [data-automation-id*='heading']"));
    const options = extractOptions(el, kind);

    const placeholder = (el as HTMLInputElement).placeholder ? normalizeText((el as HTMLInputElement).placeholder) : "";
    const accessibleName = el.getAttribute("aria-label") ? normalizeText(el.getAttribute("aria-label")) : "";

    // Ignore submit, reset, and action buttons
    if (el instanceof HTMLInputElement && (el.type === "submit" || el.type === "button" || el.type === "reset")) {
      continue;
    }

    // Must have at least some identifiable attribute
    if (!label && !accessibleName && !placeholder && !el.id) {
      continue;
    }

    descriptors.push({
      id: el.id || `${kind}-${index}`,
      element: el,
      fingerprint: {
        label: label || accessibleName || placeholder,
        accessibleName,
        placeholder,
        kind,
        section: normalizeLabel(sectionText),
        tenant: location.hostname
      },
      required: el.matches("[required], [aria-required='true']"),
      visible: true,
      options,
      rawLabel,
      sectionText
    });
  }

  return descriptors;
}
