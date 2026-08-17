export const messageTypes = {
  ping: "FOUNDATION_PING"
} as const;

export type ExtensionMessage =
  | { type: typeof messageTypes.ping };

export interface PingResponse {
  ok: true;
  version: string;
}
