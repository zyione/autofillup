import type { UserProfile } from "../shared/types";
import { localStorageArea, type StorageArea } from "./storage";

const profileKey = "profile";

export class ProfileStore {
  constructor(private readonly storage: StorageArea = localStorageArea) {}

  get(): Promise<UserProfile | undefined> {
    return this.storage.get<UserProfile>(profileKey);
  }

  save(profile: UserProfile): Promise<void> {
    return this.storage.set(profileKey, profile);
  }
}
