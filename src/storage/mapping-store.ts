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
    const index = all.findIndex((item) => item.id === mapping.id);
    const now = new Date().toISOString();
    const prepared: FieldMapping = {
      ...mapping,
      updatedAt: now,
      createdAt: mapping.createdAt || now
    };

    if (index < 0) {
      all.push(prepared);
    } else {
      all[index] = prepared;
    }
    await this.storage.set(key, all);
  }

  async remove(id: string): Promise<void> {
    const all = await this.list();
    await this.storage.set(key, all.filter((item) => item.id !== id));
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
