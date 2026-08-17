export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
