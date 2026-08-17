import type { FieldMapping } from "../shared/types";
import { localStorageArea, type StorageArea } from "./storage";
const key = "fieldMappings";
export class MappingStore {
  constructor(private readonly storage: StorageArea = localStorageArea) {}
  async list(): Promise<FieldMapping[]> { return (await this.storage.get<FieldMapping[]>(key)) ?? []; }
  async save(mapping: FieldMapping): Promise<void> { const all = await this.list(); const index = all.findIndex((item) => item.id === mapping.id); if (index < 0) all.push(mapping); else all[index] = mapping; await this.storage.set(key, all); }
  async remove(id: string): Promise<void> { await this.storage.set(key, (await this.list()).filter((item) => item.id !== id)); }
}
