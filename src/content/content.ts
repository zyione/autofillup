import { detectWorkday } from "./detection/workday-detector";
import { detectPageFingerprint } from "./detection/page-detector";
import { PageObserver } from "./observation/page-observer";
import { scanFields } from "./fields/field-detector";
import { MappingEngine } from "./mapping/mapping-engine";
import { executeAutofillField } from "./autofill/autofill-engine";
import { TeachingController } from "./learning/teaching-controller";
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
  const detection = detectWorkday(location, document);
  if (!detection.isWorkday) {
    return { outcomes: [], unknown: [] };
  }

  if (observer) {
    observer.setProcessing(true);
  }

  try {
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

      if (candidate.source === "builtin" && candidate.confidence === 0) {
        teachingController.registerUnknown(field);
      }

      const result = await executeAutofillField(field, candidate, settings.overwriteExisting);
      outcomes.push(result);
    }

    lastOutcomes = outcomes;
    const unknownList = teachingController.getUnknownList();

    if (showOverlayUI && settings.showFloatingStatus) {
      overlay.show({
        outcomes,
        unknownFields: unknownList,
        profile,
        onTeach: async (fieldId, source, pathOrVal, fixedVal) => {
          await teachingController.teachField(fieldId, source, pathOrVal, fixedVal);
        },
        onClose: () => overlay.remove(),
        onRefill: () => void runAutofill(true)
      });
    }

    return { outcomes, unknown: unknownList };
  } finally {
    if (observer) {
      observer.setProcessing(false);
    }
  }
}

// Initialize content script
const detection = detectWorkday(location, document);
if (detection.isWorkday) {
  logger.info("Workday assistant initialized", {
    tenant: detection.tenant,
    isApplication: detection.isApplication
  });

  observer = new PageObserver({
    onPageChange: (fingerprint) => {
      logger.info("Application page transition detected", { heading: fingerprint.heading });
      void runAutofill(false);
    },
    onDynamicFields: () => {
      void runAutofill(false);
    }
  });

  observer.start();
}

// Runtime message listener
chrome.runtime.onMessage.addListener((message: { type?: string; showOverlay?: boolean }, _sender, sendResponse) => {
  const currentDetection = detectWorkday(location, document);

  if (message.type === messageTypes.runAutofill || message.type === "RUN_AUTOFILL") {
    void runAutofill(message.showOverlay ?? true).then(({ outcomes, unknown }) => {
      sendResponse({
        supported: currentDetection.isWorkday,
        isApplication: currentDetection.isApplication,
        tenant: currentDetection.tenant,
        currentPage: detectPageFingerprint(location, document).heading,
        outcomes,
        unknownFields: unknown
      });
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
});
