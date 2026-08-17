import type { FieldDescriptor, FieldMapping, UnknownFieldInfo } from "../../shared/types";
import { MappingStore } from "../../storage/mapping-store";
import { ProfileStore } from "../../storage/profile-store";

export class TeachingController {
  private unknownQueue: Map<string, { descriptor: FieldDescriptor; info: UnknownFieldInfo }> = new Map();

  constructor(
    private readonly mappingStore: MappingStore = new MappingStore(),
    private readonly profileStore: ProfileStore = new ProfileStore()
  ) {}

  registerUnknown(descriptor: FieldDescriptor): UnknownFieldInfo {
    const info: UnknownFieldInfo = {
      fieldId: descriptor.id,
      label: descriptor.fingerprint.label || descriptor.rawLabel || "Unnamed field",
      accessibleName: descriptor.fingerprint.accessibleName,
      placeholder: descriptor.fingerprint.placeholder,
      kind: descriptor.fingerprint.kind,
      section: descriptor.fingerprint.section,
      options: Array.isArray(descriptor.options)
        ? descriptor.options.map((o) => (typeof o === "string" ? o : o.label))
        : [],
      detectedAt: new Date().toISOString()
    };

    this.unknownQueue.set(descriptor.id, { descriptor, info });
    return info;
  }

  getUnknownList(): UnknownFieldInfo[] {
    return Array.from(this.unknownQueue.values()).map((item) => item.info);
  }

  getDescriptor(fieldId: string): FieldDescriptor | undefined {
    return this.unknownQueue.get(fieldId)?.descriptor;
  }

  clearQueue(): void {
    this.unknownQueue.clear();
  }

  async teachField(
    fieldId: string,
    mappingSource: "profile" | "customField" | "applicationAnswer" | "fixedValue" | "ignore",
    valueOrPath: string,
    fixedValue?: string,
    enteredValue?: string
  ): Promise<FieldMapping | null> {
    const entry = this.unknownQueue.get(fieldId);
    if (!entry) return null;

    const { descriptor } = entry;
    const now = new Date().toISOString();

    // 1. If mapping to personal/contact profile and a value was provided, persist to profile
    if (mappingSource === "profile" && enteredValue && enteredValue.trim().length > 0) {
      const profile = await this.profileStore.get();
      const parts = valueOrPath.split(".");
      if (parts.length === 2) {
        const [section, field] = parts as [keyof typeof profile, string];
        if (profile[section] && typeof profile[section] === "object") {
          (profile[section] as any)[field] = enteredValue.trim();
          await this.profileStore.save(profile);
        }
      }
    }

    // 2. If mapping to application answers and a value was provided, persist to application answers
    if (mappingSource === "applicationAnswer") {
      const profile = await this.profileStore.get();
      const existingIdx = profile.applicationAnswers.findIndex((a) => a.id === valueOrPath);
      if (existingIdx >= 0 && enteredValue && enteredValue.trim().length > 0) {
        profile.applicationAnswers[existingIdx].value = enteredValue.trim();
        await this.profileStore.save(profile);
      }
    }

    const newMapping: FieldMapping = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `mapping-${Date.now()}`,
      fingerprint: descriptor.fingerprint,
      source: mappingSource,
      sourcePath: mappingSource !== "fixedValue" && mappingSource !== "ignore" ? valueOrPath : undefined,
      fixedValue: mappingSource === "fixedValue" ? fixedValue || enteredValue || valueOrPath : undefined,
      tenantScope: "*",
      enabled: true,
      createdAt: now,
      updatedAt: now
    };

    await this.mappingStore.save(newMapping);
    this.unknownQueue.delete(fieldId);
    return newMapping;
  }
}
