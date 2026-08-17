import { emptyProfile, type UserProfile } from "../shared/types";
import { localStorageArea, type StorageArea } from "./storage";

const profileKey = "profile";

export class ProfileStore {
  constructor(private readonly storage: StorageArea = localStorageArea) {}

  async get(): Promise<UserProfile> {
    return (await this.storage.get<UserProfile>(profileKey)) ?? emptyProfile();
  }

  save(profile: UserProfile): Promise<void> {
    return this.storage.set(profileKey, { ...profile, updatedAt: new Date().toISOString() });
  }
}
