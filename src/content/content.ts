import { detectWorkday } from "./detection/workday-detector";
import { detectPageFingerprint } from "./detection/page-detector";
import { PageObserver } from "./observation/page-observer";
import { scanFields } from "./fields/field-detector";
import { MappingEngine } from "./mapping/mapping-engine";
import { executeAutofillField } from "./autofill/autofill-engine";
import { TeachingController } from "./learning/teaching-controller";
import { learnCurrentPageValues, savePageFieldValues, forgetCurrentPage } from "./learning/page-learner";
import { AssistantOverlay } from "./ui/overlay";
import { ProfileStore } from "../storage/profile-store";
import { MappingStore } from "../storage/mapping-store";
import { SettingsStore } from "../storage/settings-store";
import { logger } from "../shared/logger";
import type { FieldFillResult, UnknownFieldInfo } from "../shared/types";
import { messageTypes } from "../shared/messages";

const profileStore = new ProfileStore();
const mappingStore = new MappingStore();
const settingsStore = new SettingsStore();
const teachingController = new TeachingController(mappingStore, profileStore);
const overlay = new AssistantOverlay();

let lastOutcomes: FieldFillResult[] = [];
let observer: PageObserver | null = null;

async function runAutofill(showOverlayUI = true, isManual = false): Promise<{ outcomes: FieldFillResult[]; unknown: UnknownFieldInfo[] }> {
  try {
    const detection = detectWorkday(location, document);
    if (!detection.isWorkday) {
      return { outcomes: [], unknown: [] };
    }

    if (observer) {
      observer.setProcessing(true);
    }

    const [profile, mappings, settings] = await Promise.all([
      profileStore.get(),
      mappingStore.list(),
      settingsStore.get()
    ]);

    const fields = scanFields(document);
    const mappingEngine = new MappingEngine(profile, mappings);
    teachingController.clearQueue();

    const outcomes: FieldFillResult[] = [];
    const shouldWriteToDOM = isManual || settings.autoFillHighConfidence;

    for (const field of fields) {
      const candidate = mappingEngine.resolve(field);
      let result: FieldFillResult;

      if (candidate.source === "ignore") {
        result = {
          fieldId: field.id,
          label: field.fingerprint.label || field.rawLabel || "Unnamed field",
          kind: field.fingerprint.kind,
          outcome: "skipped",
          detail: "Permanently ignored by user rule.",
          confidence: 100,
          mappingSource: "ignore"
        };
      } else if (shouldWriteToDOM) {
        result = await executeAutofillField(field, candidate, settings.overwriteExisting);
      } else {
        // Inspection mode: do not write to DOM automatically without user consent
        const label = field.fingerprint.label || field.fingerprint.accessibleName || "Unnamed field";
        const hasVal = candidate.value !== undefined && candidate.value !== "";
        result = {
          fieldId: field.id,
          label,
          kind: field.fingerprint.kind,
          outcome: hasVal ? "filled" : "unknown",
          detail: hasVal ? "Ready to fill." : (candidate.reason || "No mapping value available."),
          valueAttempted: candidate.value,
          confidence: candidate.confidence,
          mappingSource: candidate.source
        };
      }

      outcomes.push(result);

      // Register for teaching ONLY if not ignored, not skipped, and missing/low-confidence value
      if (
        candidate.source !== "ignore" &&
        result.outcome !== "skipped" &&
        (result.outcome === "unknown" ||
         result.outcome === "review" ||
         candidate.confidence === 0 ||
         !candidate.value)
      ) {
        teachingController.registerUnknown(field);
      }
    }

    lastOutcomes = outcomes;
    const unknownList = teachingController.getUnknownList();

    if (showOverlayUI && settings.showFloatingStatus) {
      overlay.show({
        outcomes,
        unknownFields: unknownList,
        profile,
        onTeach: async (fieldId, source, pathOrVal, fixedVal, enteredVal, fallbackLabel) => {
          await teachingController.teachField(fieldId, source, pathOrVal, fixedVal, enteredVal, {
            fingerprint: { label: fallbackLabel || "", accessibleName: "", placeholder: "", kind: "text", section: "", tenant: "*" }
          });
          void runAutofill(true, false);
        },
        onLearnPage: async () => {
          return await learnCurrentPageValues(document, profileStore, mappingStore);
        },
        onSavePageValues: async (entries, autofillAfterSave = false) => {
          const count = await savePageFieldValues(entries, document, profileStore, mappingStore);
          if (autofillAfterSave) {
            void runAutofill(true, true);
          } else {
            void runAutofill(true, false);
          }
          return count;
        },
        onForgetPage: async () => {
          return await forgetCurrentPage(document, profileStore, mappingStore);
        },
        onClose: () => overlay.remove(),
        onRefill: () => void runAutofill(true, true)
      });
    }

    return { outcomes, unknown: unknownList };
  } catch (err) {
    logger.warn("Autofill pass completed with notice", { error: String(err) });
    return { outcomes: lastOutcomes, unknown: teachingController.getUnknownList() };
  } finally {
    if (observer) {
      observer.setProcessing(false);
    }
  }
}

// Initialize content script
try {
  const detection = detectWorkday(location, document);
  if (detection.isWorkday) {
    logger.info("Workday assistant initialized", {
      tenant: detection.tenant,
      isApplication: detection.isApplication
    });

    observer = new PageObserver({
      onPageChange: (fingerprint) => {
        logger.info("Application page transition detected", { heading: fingerprint.heading });
        const current = detectWorkday(location, document);
        if (current.isApplication) {
          void runAutofill(false, false);
        }
      },
      onDynamicFields: () => {
        const current = detectWorkday(location, document);
        if (current.isApplication) {
          void runAutofill(false, false);
        }
      }
    });

    observer.start();

    // Initial inspection pass on load
    if (detection.isApplication) {
      setTimeout(() => {
        void runAutofill(true, false);
      }, 500);
    }
  }
} catch (err) {
  logger.warn("Initialization guard notice", { error: String(err) });
}

// Runtime message listener
try {
  chrome.runtime.onMessage.addListener((message: { type?: string; showOverlay?: boolean; entries?: any[] }, _sender, sendResponse) => {
    try {
      const currentDetection = detectWorkday(location, document);

      if (message.type === messageTypes.runAutofill || message.type === "RUN_AUTOFILL") {
        void runAutofill(message.showOverlay ?? true, true).then(({ outcomes, unknown }) => {
          try {
            sendResponse({
              supported: currentDetection.isWorkday,
              isApplication: currentDetection.isApplication,
              tenant: currentDetection.tenant,
              currentPage: detectPageFingerprint(location, document).heading,
              outcomes,
              unknownFields: unknown
            });
          } catch {}
        });
        return true;
      }

      if (message.type === messageTypes.learnPage || message.type === "LEARN_PAGE") {
        void learnCurrentPageValues(document, profileStore, mappingStore).then((res) => {
          try {
            sendResponse({
              success: true,
              learnedCount: res.learnedCount,
              profileFieldsUpdated: res.profileFieldsUpdated,
              mappingsCreated: res.mappingsCreated
            });
          } catch {}
        });
        return true;
      }

      if (message.type === "SAVE_PAGE_VALUES") {
        void savePageFieldValues(message.entries || [], document, profileStore, mappingStore).then((count) => {
          try {
            sendResponse({
              success: true,
              count
            });
          } catch {}
        });
        return true;
      }

      if (message.type === messageTypes.forgetPage || message.type === "FORGET_PAGE") {
        void forgetCurrentPage(document, profileStore, mappingStore).then((res) => {
          try {
            sendResponse({
              success: true,
              removedCount: res.removedCount
            });
          } catch {}
        });
        return true;
      }

      if (message.type === messageTypes.getStatus || message.type === "GET_STATUS") {
        sendResponse({
          supported: currentDetection.isWorkday,
          isApplication: currentDetection.isApplication,
          tenant: currentDetection.tenant,
          currentPage: detectPageFingerprint(location, document).heading,
          outcomes: lastOutcomes,
          unknownFields: teachingController.getUnknownList()
        });
        return false;
      }
    } catch {}
    return false;
  });
} catch {}
