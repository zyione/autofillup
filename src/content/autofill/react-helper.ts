/**
 * Sets native value for React-controlled form elements by invoking
 * the property setter from HTMLInputElement/HTMLTextAreaElement/HTMLSelectElement prototypes.
 * Also notifies React's internal _valueTracker if present.
 */
export function setReactValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
): void {
  const prototype =
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

  const valueDescriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  const setter = valueDescriptor?.set;

  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }

  // Notify React internal tracker if available
  const tracker = (element as any)._valueTracker;
  if (tracker && typeof tracker.setValue === "function") {
    tracker.setValue(value);
  }
}

/**
 * Dispatches the standard sequence of events that React listeners expect
 * (focus, input, change, blur).
 */
export function dispatchEventSequence(element: HTMLElement): void {
  element.dispatchEvent(new Event("focus", { bubbles: true }));
  element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}

/**
 * Checks if an element currently holds a non-empty user value.
 */
export function hasExistingValue(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") {
      return element.checked;
    }
    return element.value.trim().length > 0;
  }

  if (element instanceof HTMLTextAreaElement) {
    return element.value.trim().length > 0;
  }

  if (element instanceof HTMLSelectElement) {
    return element.selectedIndex > 0 && element.value.trim().length > 0;
  }

  return false;
}

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
