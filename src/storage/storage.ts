export interface StorageArea {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear?(): Promise<void>;
}

export const localStorageArea: StorageArea = {
  async get<T>(key: string): Promise<T | undefined> {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      const value = localStorage.getItem(key);
      return value ? (JSON.parse(value) as T) : undefined;
    }
    const values = await chrome.storage.local.get(key);
    return values[key] as T | undefined;
  },
  async set<T>(key: string, value: T): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      localStorage.setItem(key, JSON.stringify(value));
      return;
    }
    await chrome.storage.local.set({ [key]: value });
  },
  async remove(key: string): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      localStorage.removeItem(key);
      return;
    }
    await chrome.storage.local.remove(key);
  },
  async clear(): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      localStorage.clear();
      return;
    }
    await chrome.storage.local.clear();
  }
};
