import { localStorageArea, type StorageArea } from "./storage";
export interface Settings { autoFillHighConfidence: boolean; overwriteExisting: boolean; }
const key = "settings"; const defaults: Settings = { autoFillHighConfidence: true, overwriteExisting: false };
export class SettingsStore { constructor(private readonly storage: StorageArea = localStorageArea) {} async get(): Promise<Settings> { return { ...defaults, ...(await this.storage.get<Partial<Settings>>(key)) }; } save(settings: Settings): Promise<void> { return this.storage.set(key, settings); } }
