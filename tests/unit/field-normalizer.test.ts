import { describe, expect, it } from "vitest";
import { normalizeLabel, normalizeText, areLabelsEquivalent } from "../../src/content/fields/field-normalizer";

describe("Field Normalizer", () => {
  it("normalizes text by lowercasing and removing punctuation", () => {
    expect(normalizeText("Legal First Name *:")).toBe("legal first name");
    expect(normalizeText("Address (Line 1):")).toBe("address line 1");
  });

  it("handles common Workday label synonyms", () => {
    expect(normalizeLabel("Legal First Name")).toBe("first name");
    expect(normalizeLabel("Given Name")).toBe("first name");
    expect(normalizeLabel("Family Name")).toBe("last name");
    expect(normalizeLabel("Surname")).toBe("last name");
    expect(normalizeLabel("Mobile Phone Number")).toBe("phone");
    expect(normalizeLabel("Cell Phone")).toBe("phone");
    expect(normalizeLabel("Zip Code")).toBe("postal code");
    expect(normalizeLabel("Country / Territory")).toBe("country");
  });

  it("strips trailing required and optional indicators", () => {
    expect(normalizeLabel("Email Address (required)")).toBe("email");
    expect(normalizeLabel("Preferred Name (optional)")).toBe("preferred name");
  });

  it("preserves critical semantic distinctions", () => {
    expect(normalizeLabel("Current Employer")).toBe("current employer");
    expect(normalizeLabel("Previous Employer")).toBe("previous employer");
    expect(areLabelsEquivalent("Current Employer", "Previous Employer")).toBe(false);

    expect(normalizeLabel("Start Date")).toBe("start date");
    expect(normalizeLabel("End Date")).toBe("end date");
    expect(areLabelsEquivalent("Start Date", "End Date")).toBe(false);
  });
});
