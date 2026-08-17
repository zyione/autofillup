import type { FieldFillResult, FieldMapping, UnknownFieldInfo, UserProfile } from "./types";
import type { ApplicationSession } from "./types/session";

export const messageTypes = {
  ping: "FOUNDATION_PING",
  runAutofill: "RUN_AUTOFILL",
  getStatus: "GET_STATUS",
  statusResponse: "STATUS_RESPONSE",
  teachField: "TEACH_FIELD",
  learnPage: "LEARN_PAGE",
  saveMapping: "SAVE_MAPPING",
  pageChanged: "PAGE_CHANGED",
  getProfile: "GET_PROFILE",
  openOptions: "OPEN_OPTIONS"
} as const;

export interface PingMessage {
  type: typeof messageTypes.ping;
}

export interface RunAutofillMessage {
  type: typeof messageTypes.runAutofill;
  showOverlay?: boolean;
}

export interface GetStatusMessage {
  type: typeof messageTypes.getStatus;
}

export interface LearnPageMessage {
  type: typeof messageTypes.learnPage;
}

export interface TeachFieldMessage {
  type: typeof messageTypes.teachField;
  field: UnknownFieldInfo;
}

export interface SaveMappingMessage {
  type: typeof messageTypes.saveMapping;
  mapping: FieldMapping;
}

export interface StatusResponse {
  supported: boolean;
  isApplication: boolean;
  tenant: string;
  currentPage: string;
  outcomes: FieldFillResult[];
  unknownFields: UnknownFieldInfo[];
}

export interface LearnPageResponse {
  success: boolean;
  learnedCount: number;
  profileFieldsUpdated: string[];
  mappingsCreated: string[];
}

export type ExtensionMessage =
  | PingMessage
  | RunAutofillMessage
  | GetStatusMessage
  | LearnPageMessage
  | TeachFieldMessage
  | SaveMappingMessage;

export interface PingResponse {
  ok: true;
  version: string;
}
