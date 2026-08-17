import { localStorageArea, type StorageArea } from "./storage";

export interface Settings {
  autoFillHighConfidence: boolean;
  overwriteExisting: boolean;
  highlightFields: boolean;
  confidenceThreshold: number;
  showFloatingStatus: boolean;
}

const key = "settings";

const defaults: Settings = {
  autoFillHighConfidence: true,
  overwriteExisting: false,
  highlightFields: true,
  confidenceThreshold: 80,
  showFloatingStatus: true
};

export class SettingsStore {
  constructor(private readonly storage: StorageArea = localStorageArea) {}

  async get(): Promise<Settings> {
    return { ...defaults, ...(await this.storage.get<Partial<Settings>>(key)) };
  }

  async save(settings: Partial<Settings>): Promise<void> {
    const current = await this.get();
    const updated = { ...current, ...settings };
    await this.storage.set(key, updated);

    // Save safety snapshot for build updates
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const raw = await chrome.storage.local.get(["profile", "fieldMappings"]);
        await chrome.storage.local.set({
          autofillup_backup_snapshot: {
            profile: raw.profile || {},
            fieldMappings: raw.fieldMappings || [],
            settings: updated,
            savedAt: new Date().toISOString()
          }
        });
      }
    } catch {}
  }
}
