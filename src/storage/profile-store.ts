import { emptyProfile, type UserProfile, type EducationRecord, type EmploymentRecord, type CustomField, type ApplicationAnswer } from "../shared/types";
import { localStorageArea, type StorageArea } from "./storage";

const profileKey = "profile";

export class ProfileStore {
  constructor(private readonly storage: StorageArea = localStorageArea) {}

  async get(): Promise<UserProfile> {
    const raw = await this.storage.get<UserProfile>(profileKey);
    if (!raw) return emptyProfile();

    return {
      ...emptyProfile(),
      ...raw,
      personal: { ...emptyProfile().personal, ...(raw.personal ?? {}) },
      contact: { ...emptyProfile().contact, ...(raw.contact ?? {}) },
      professional: { ...emptyProfile().professional, ...(raw.professional ?? {}) },
      education: Array.isArray(raw.education) ? raw.education : [],
      employment: Array.isArray(raw.employment) ? raw.employment : [],
      skills: { ...emptyProfile().skills, ...(raw.skills ?? {}) },
      customFields: Array.isArray(raw.customFields) ? raw.customFields : [],
      applicationAnswers: Array.isArray(raw.applicationAnswers) ? raw.applicationAnswers : []
    };
  }

  async save(profile: UserProfile): Promise<void> {
    await this.storage.set(profileKey, { ...profile, updatedAt: new Date().toISOString() });
  }

  async addEducation(record: EducationRecord): Promise<void> {
    const profile = await this.get();
    profile.education.push(record);
    await this.save(profile);
  }

  async removeEducation(id: string): Promise<void> {
    const profile = await this.get();
    profile.education = profile.education.filter((r) => r.id !== id);
    await this.save(profile);
  }

  async addEmployment(record: EmploymentRecord): Promise<void> {
    const profile = await this.get();
    profile.employment.push(record);
    await this.save(profile);
  }

  async removeEmployment(id: string): Promise<void> {
    const profile = await this.get();
    profile.employment = profile.employment.filter((r) => r.id !== id);
    await this.save(profile);
  }

  async addCustomField(field: CustomField): Promise<void> {
    const profile = await this.get();
    const existingIndex = profile.customFields.findIndex((f) => f.id === field.id || f.name.toLowerCase() === field.name.toLowerCase());
    if (existingIndex >= 0) {
      profile.customFields[existingIndex] = field;
    } else {
      profile.customFields.push(field);
    }
    await this.save(profile);
  }

  async removeCustomField(id: string): Promise<void> {
    const profile = await this.get();
    profile.customFields = profile.customFields.filter((f) => f.id !== id);
    await this.save(profile);
  }

  async addApplicationAnswer(answer: ApplicationAnswer): Promise<void> {
    const profile = await this.get();
    const existingIndex = profile.applicationAnswers.findIndex((a) => a.id === answer.id || a.name.toLowerCase() === answer.name.toLowerCase());
    if (existingIndex >= 0) {
      profile.applicationAnswers[existingIndex] = answer;
    } else {
      profile.applicationAnswers.push(answer);
    }
    await this.save(profile);
  }

  async removeApplicationAnswer(id: string): Promise<void> {
    const profile = await this.get();
    profile.applicationAnswers = profile.applicationAnswers.filter((a) => a.id !== id);
    await this.save(profile);
  }
}
