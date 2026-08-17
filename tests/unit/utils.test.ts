import { describe, expect, it } from "vitest";
import { isRecord } from "../../src/shared/utils";

describe("isRecord", () => {
  it("accepts plain objects and rejects arrays and null", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });
});
