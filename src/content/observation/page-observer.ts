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
      const current = detectPageFingerprint(location, document);
      if (!areFingerprintsEqual(this.lastFingerprint, current)) {
        this.lastFingerprint = current;
        this.callbacks.onPageChange(current);
      }
    };

    window.addEventListener("popstate", checkNavigation);

    // Patch pushState and replaceState to catch SPA page switches
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      window.dispatchEvent(new Event("locationchange"));
      return result;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      window.dispatchEvent(new Event("locationchange"));
      return result;
    };

    window.addEventListener("locationchange", checkNavigation);

    // 2. MutationObserver with debouncing and loop-filtering
    this.mutationObserver = new MutationObserver((mutations) => {
      if (this.isProcessing) return;

      // Filter mutations: ignore our own overlay or irrelevant attribute changes
      const hasRelevantMutation = mutations.some((m) => {
        if (m.target instanceof HTMLElement && m.target.closest("#autofillup-host, #autofillup-status")) {
          return false;
        }
        return m.type === "childList" || (m.type === "attributes" && m.attributeName === "aria-hidden");
      });

      if (!hasRelevantMutation) return;

      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = window.setTimeout(() => {
        checkNavigation();
        this.callbacks.onDynamicFields();
      }, 600);
    });

    this.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "class", "style"]
    });
  }

  setProcessing(processing: boolean): void {
    this.isProcessing = processing;
  }

  stop(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }
}
