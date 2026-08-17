export type CustomFieldType = "text" | "number" | "boolean" | "date" | "select" | "multi-select";
export interface EducationRecord { id: string; institution: string; degree: string; fieldOfStudy: string; startDate: string; endDate: string; gpa: string; description: string; }
export interface EmploymentRecord { id: string; company: string; jobTitle: string; location: string; startDate: string; endDate: string; currentlyEmployed: boolean; responsibilities: string; achievements: string; }
export interface CustomField { id: string; name: string; type: CustomFieldType; value: string | number | boolean | string[]; description: string; }
export interface ApplicationAnswer { id: string; name: string; value: string; description: string; }
export interface UserProfile {
  id: string; updatedAt: string;
  personal: { firstName: string; middleName: string; lastName: string; preferredName: string };
  contact: { email: string; phone: string; country: string; address: string; city: string; state: string; postalCode: string };
  professional: { linkedin: string; github: string; portfolio: string; website: string };
  education: EducationRecord[]; employment: EmploymentRecord[];
  skills: { programmingLanguages: string[]; frameworks: string[]; databases: string[]; cloud: string[]; tools: string[]; certifications: string[]; other: string[] };
  customFields: CustomField[]; applicationAnswers: ApplicationAnswer[];
}
export const emptyProfile = (): UserProfile => ({
  id: crypto.randomUUID(), updatedAt: new Date().toISOString(),
  personal: { firstName: "", middleName: "", lastName: "", preferredName: "" },
  contact: { email: "", phone: "", country: "", address: "", city: "", state: "", postalCode: "" },
  professional: { linkedin: "", github: "", portfolio: "", website: "" }, education: [], employment: [],
  skills: { programmingLanguages: [], frameworks: [], databases: [], cloud: [], tools: [], certifications: [], other: [] }, customFields: [], applicationAnswers: []
});
