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
    await this.storage.set(key, { ...current, ...settings });
  }
}
