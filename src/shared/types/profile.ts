export type CustomFieldType = "text" | "number" | "boolean" | "date" | "select" | "multi-select";

export interface EducationRecord {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  gpa: string;
  description: string;
}

export interface EmploymentRecord {
  id: string;
  company: string;
  jobTitle: string;
  location: string;
  startDate: string;
  endDate: string;
  currentlyEmployed: boolean;
  responsibilities: string;
  achievements: string;
}

export interface CustomField {
  id: string;
  name: string;
  type: CustomFieldType;
  value: string | number | boolean | string[];
  description: string;
}

export interface ApplicationAnswer {
  id: string;
  name: string;
  value: string;
  description: string;
}

export interface SkillsData {
  programmingLanguages: string[];
  frameworks: string[];
  databases: string[];
  cloud: string[];
  tools: string[];
  certifications: string[];
  other: string[];
}

export interface PersonalInfo {
  firstName: string;
  middleName: string;
  lastName: string;
  preferredName: string;
}

export interface ContactInfo {
  email: string;
  phone: string;
  country: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface ProfessionalInfo {
  linkedin: string;
  github: string;
  portfolio: string;
  website: string;
}

export interface UserProfile {
  id: string;
  updatedAt: string;
  personal: PersonalInfo;
  contact: ContactInfo;
  professional: ProfessionalInfo;
  education: EducationRecord[];
  employment: EmploymentRecord[];
  skills: SkillsData;
  customFields: CustomField[];
  applicationAnswers: ApplicationAnswer[];
}

export interface ExportData {
  version: number;
  exportedAt: string;
  profile: UserProfile;
  customFields?: CustomField[];
  applicationAnswers?: ApplicationAnswer[];
  fieldMappings?: unknown[];
  settings?: unknown;
}

export const emptyProfile = (): UserProfile => ({
  id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "profile-default",
  updatedAt: new Date().toISOString(),
  personal: { firstName: "", middleName: "", lastName: "", preferredName: "" },
  contact: { email: "", phone: "", country: "", address: "", city: "", state: "", postalCode: "" },
  professional: { linkedin: "", github: "", portfolio: "", website: "" },
  education: [],
  employment: [],
  skills: {
    programmingLanguages: [],
    frameworks: [],
    databases: [],
    cloud: [],
    tools: [],
    certifications: [],
    other: []
  },
  customFields: [],
  applicationAnswers: []
});
