import { areFingerprintsEqual, detectPageFingerprint } from "../detection/page-detector";
import type { PageFingerprint } from "../../shared/types";

export interface ObserverCallbacks {
  onPageChange: (fingerprint: PageFingerprint) => void;
  onDynamicFields: () => void;
}

export class PageObserver {
  private lastFingerprint: PageFingerprint;
  private mutationObserver: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private isProcessing = false;

  constructor(private readonly callbacks: ObserverCallbacks) {
    this.lastFingerprint = detectPageFingerprint(location, document);
  }

  start(): void {
    // 1. Monitor SPA History navigation
    const checkNavigation = () => {
      try {
        const current = detectPageFingerprint(location, document);
        if (!areFingerprintsEqual(this.lastFingerprint, current)) {
          this.lastFingerprint = current;
          this.callbacks.onPageChange(current);
        }
      } catch {}
    };

    window.addEventListener("popstate", checkNavigation);

    // Patch pushState and replaceState safely to catch SPA page switches
    try {
      const originalPushState = history.pushState;
      if (typeof originalPushState === "function") {
        history.pushState = function (...args) {
          try {
            const result = originalPushState.apply(window.history, args);
            window.dispatchEvent(new Event("locationchange"));
            return result;
          } catch {
            return originalPushState.apply(this, args);
          }
        };
      }
    } catch {}

    try {
      const originalReplaceState = history.replaceState;
      if (typeof originalReplaceState === "function") {
        history.replaceState = function (...args) {
          try {
            const result = originalReplaceState.apply(window.history, args);
            window.dispatchEvent(new Event("locationchange"));
            return result;
          } catch {
            return originalReplaceState.apply(this, args);
          }
        };
      }
    } catch {}

    window.addEventListener("locationchange", checkNavigation);

    // 2. MutationObserver with debouncing and loop-filtering
    try {
      this.mutationObserver = new MutationObserver((mutations) => {
        if (this.isProcessing) return;

        // Filter mutations: ignore our own overlay or irrelevant attribute changes
        const hasRelevantMutation = mutations.some((m) => {
          try {
            if (m.target && m.target instanceof HTMLElement) {
              if (m.target.closest("#autofillup-host, #autofillup-status")) {
                return false;
              }
            }
            return m.type === "childList" || (m.type === "attributes" && m.attributeName === "aria-hidden");
          } catch {
            return false;
          }
        });

        if (!hasRelevantMutation) return;

        if (this.debounceTimer !== null) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = window.setTimeout(() => {
          try {
            checkNavigation();
            this.callbacks.onDynamicFields();
          } catch {}
        }, 600);
      });

      if (document.documentElement) {
        this.mutationObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["aria-hidden", "class", "style"]
        });
      }
    } catch {}
  }

  setProcessing(processing: boolean): void {
    this.isProcessing = processing;
  }

  stop(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
