import { detectWorkday } from "./detection/workday-detector";
import { detectPageFingerprint } from "./detection/page-detector";
import { PageObserver } from "./observation/page-observer";
import { scanFields } from "./fields/field-detector";
import { MappingEngine } from "./mapping/mapping-engine";
import { executeAutofillField } from "./autofill/autofill-engine";
import { TeachingController } from "./learning/teaching-controller";
import { learnCurrentPageValues, forgetCurrentPage } from "./learning/page-learner";
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

async function runAutofill(showOverlayUI = true): Promise<{ outcomes: FieldFillResult[]; unknown: UnknownFieldInfo[] }> {
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

    for (const field of fields) {
      const candidate = mappingEngine.resolve(field);
      const result = await executeAutofillField(field, candidate, settings.overwriteExisting);
      outcomes.push(result);

      // Register for teaching if unknown, review, confidence 0, or missing value
      if (
        result.outcome === "unknown" ||
        result.outcome === "review" ||
        candidate.confidence === 0 ||
        !candidate.value
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
        onTeach: async (fieldId, source, pathOrVal, fixedVal, enteredVal) => {
          await teachingController.teachField(fieldId, source, pathOrVal, fixedVal, enteredVal);
        },
        onLearnPage: async () => {
          return await learnCurrentPageValues(document, profileStore, mappingStore);
        },
        onForgetPage: async () => {
          return await forgetCurrentPage(document, profileStore, mappingStore);
        },
        onClose: () => overlay.remove(),
        onRefill: () => void runAutofill(true)
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
          void runAutofill(false);
        }
      },
      onDynamicFields: () => {
        const current = detectWorkday(location, document);
        if (current.isApplication) {
          void runAutofill(false);
        }
      }
    });

    observer.start();
  }
} catch (err) {
  logger.warn("Initialization guard notice", { error: String(err) });
}

// Runtime message listener
try {
  chrome.runtime.onMessage.addListener((message: { type?: string; showOverlay?: boolean }, _sender, sendResponse) => {
    try {
      const currentDetection = detectWorkday(location, document);

      if (message.type === messageTypes.runAutofill || message.type === "RUN_AUTOFILL") {
        void runAutofill(message.showOverlay ?? true).then(({ outcomes, unknown }) => {
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
