import { describe, expect, it, beforeEach } from "vitest";
import { ProfileStore } from "../../src/storage/profile-store";
import { MappingStore } from "../../src/storage/mapping-store";
import { SettingsStore } from "../../src/storage/settings-store";
import { validateExportData, migrateData } from "../../src/storage/migration";
import type { StorageArea } from "../../src/storage/storage";
import { emptyProfile, type UserProfile } from "../../src/shared/types";

class MemoryStorageArea implements StorageArea {
  private data: Record<string, any> = {};

  async get<T>(key: string): Promise<T | undefined> {
    return this.data[key];
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.data[key] = value;
  }
  async remove(key: string): Promise<void> {
    delete this.data[key];
  }
  async clear(): Promise<void> {
    this.data = {};
  }
}

describe("Storage & Migration Tests", () => {
  let memoryStorage: MemoryStorageArea;
  let profileStore: ProfileStore;
  let mappingStore: MappingStore;
  let settingsStore: SettingsStore;

  beforeEach(() => {
    memoryStorage = new MemoryStorageArea();
    profileStore = new ProfileStore(memoryStorage);
    mappingStore = new MappingStore(memoryStorage);
    settingsStore = new SettingsStore(memoryStorage);
  });

  it("persists and retrieves profile with default fallback", async () => {
    const initial = await profileStore.get();
    expect(initial.personal.firstName).toBe("");

    const updated: UserProfile = {
      ...emptyProfile(),
      personal: { firstName: "Alice", middleName: "", lastName: "Smith", preferredName: "Ali" }
    };

    await profileStore.save(updated);
    const retrieved = await profileStore.get();
    expect(retrieved.personal.firstName).toBe("Alice");
    expect(retrieved.personal.lastName).toBe("Smith");
  });

  it("adds and removes education records", async () => {
    await profileStore.addEducation({
      id: "edu-1",
      institution: "MIT",
      degree: "B.S.",
      fieldOfStudy: "EECS",
      startDate: "2018",
      endDate: "2022",
      gpa: "4.0",
      description: ""
    });

    let profile = await profileStore.get();
    expect(profile.education.length).toBe(1);
    expect(profile.education[0].institution).toBe("MIT");

    await profileStore.removeEducation("edu-1");
    profile = await profileStore.get();
    expect(profile.education.length).toBe(0);
  });

  it("manages field mappings toggle and tenant search", async () => {
    await mappingStore.save({
      id: "map-1",
      fingerprint: {
        label: "relocate",
        accessibleName: "",
        placeholder: "",
        kind: "radioGroup",
        section: "Questions",
        tenant: "theapexgroup"
      },
      source: "applicationAnswer",
      sourcePath: "ans-1",
      tenantScope: "theapexgroup",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    let match = await mappingStore.findMatch("relocate", "radioGroup", "theapexgroup");
    expect(match).toBeDefined();
    expect(match?.id).toBe("map-1");

    // Disabled mapping test
    await mappingStore.toggleEnabled("map-1", false);
    match = await mappingStore.findMatch("relocate", "radioGroup", "theapexgroup");
    expect(match).toBeUndefined();
  });

  it("validates backup JSON import data correctly", () => {
    const invalidData = { version: 1 };
    const resultInvalid = validateExportData(invalidData);
    expect(resultInvalid.valid).toBe(false);

    const validData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: emptyProfile(),
      fieldMappings: [],
      settings: {}
    };
    const resultValid = validateExportData(validData);
    expect(resultValid.valid).toBe(true);
    expect(resultValid.data?.profile).toBeDefined();
  });

  it("migrates raw data gracefully", () => {
    const raw = {
      profile: {
        personal: { firstName: "Bob" }
      }
    };
    const migrated = migrateData(raw);
    expect(migrated.storageVersion).toBe(1);
    expect(migrated.profile.personal.firstName).toBe("Bob");
    expect(migrated.profile.contact.email).toBe("");
    expect(migrated.settings.autoFillHighConfidence).toBe(true);
  });
});
