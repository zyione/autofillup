import type { FieldMapping } from "../shared/types";
import { localStorageArea, type StorageArea } from "./storage";

const key = "fieldMappings";

export class MappingStore {
  constructor(private readonly storage: StorageArea = localStorageArea) {}

  async list(): Promise<FieldMapping[]> {
    return (await this.storage.get<FieldMapping[]>(key)) ?? [];
  }

  async save(mapping: FieldMapping): Promise<void> {
    const all = await this.list();
    const mappingLabel = mapping.fingerprint.label?.toLowerCase().trim();
    const now = new Date().toISOString();

    const prepared: FieldMapping = {
      ...mapping,
      updatedAt: now,
      createdAt: mapping.createdAt || now
    };

    // Match by ID or by exact label to replace previous rule
    const index = all.findIndex((item) => {
      if (item.id === mapping.id) return true;
      if (mappingLabel && item.fingerprint?.label?.toLowerCase().trim() === mappingLabel) {
        return true;
      }
      return false;
    });

    if (index < 0) {
      all.push(prepared);
    } else {
      all[index] = prepared;
    }

    await this.storage.set(key, all);

    // Update safety snapshot
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const raw = await chrome.storage.local.get(["profile", "settings"]);
        await chrome.storage.local.set({
          autofillup_backup_snapshot: {
            profile: raw.profile || {},
            fieldMappings: all,
            settings: raw.settings || {},
            savedAt: now
          }
        });
      }
    } catch {}
  }

  async remove(id: string): Promise<void> {
    const all = await this.list();
    await this.storage.set(key, all.filter((item) => item.id !== id));
  }

  async removeByLabels(labels: string[]): Promise<number> {
    const all = await this.list();
    const normalizedSet = new Set(labels.map((l) => l.toLowerCase().trim()));
    const remaining = all.filter((item) => !normalizedSet.has(item.fingerprint.label.toLowerCase().trim()));
    const removedCount = all.length - remaining.length;
    if (removedCount > 0) {
      await this.storage.set(key, remaining);
    }
    return removedCount;
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    const all = await this.list();
    const mapping = all.find((item) => item.id === id);
    if (mapping) {
      mapping.enabled = enabled;
      mapping.updatedAt = new Date().toISOString();
      await this.storage.set(key, all);
    }
  }

  async findMatch(label: string, kind: string, tenant: string): Promise<FieldMapping | undefined> {
    const all = await this.list();
    const normalizedTargetLabel = label.toLowerCase().trim();

    return all.find((item) => {
      if (!item.enabled) return false;
      if (item.tenantScope !== "*" && item.tenantScope !== tenant) return false;
      if (item.fingerprint.kind !== kind && item.fingerprint.kind !== "unknown" && kind !== "unknown") return false;
      return item.fingerprint.label.toLowerCase().trim() === normalizedTargetLabel;
    });
  }

  async clear(): Promise<void> {
    await this.storage.set(key, []);
  }
}
