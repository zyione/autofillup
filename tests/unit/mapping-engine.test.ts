import { describe, expect, it } from "vitest";
import { MappingEngine, getProfileValueByPath } from "../../src/content/mapping/mapping-engine";
import { calculateConfidence } from "../../src/content/mapping/confidence-engine";
import type { FieldDescriptor, FieldMapping, UserProfile } from "../../src/shared/types";
import { emptyProfile } from "../../src/shared/types";

describe("Mapping Engine", () => {
  const sampleProfile: UserProfile = {
    ...emptyProfile(),
    personal: {
      firstName: "Jane",
      middleName: "Marie",
      lastName: "Doe",
      preferredName: "JD"
    },
    contact: {
      email: "jane.doe@example.com",
      phone: "+1 555 123 4567",
      country: "United States",
      address: "123 Market St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105"
    },
    professional: {
      linkedin: "https://linkedin.com/in/janedoe",
      github: "https://github.com/janedoe",
      portfolio: "https://janedoe.dev",
      website: "https://janedoe.me"
    },
    customFields: [
      {
        id: "cust-1",
        name: "Expected Salary",
        type: "text",
        value: "$150,000",
        description: ""
      }
    ],
    applicationAnswers: [
      {
        id: "ans-1",
        name: "Willing to relocate",
        value: "Yes",
        description: ""
      }
    ]
  };

  it("retrieves nested profile values by path", () => {
    expect(getProfileValueByPath(sampleProfile, "personal.firstName")).toBe("Jane");
    expect(getProfileValueByPath(sampleProfile, "contact.email")).toBe("jane.doe@example.com");
    expect(getProfileValueByPath(sampleProfile, "nonexistent.field")).toBeUndefined();
  });

  it("resolves built-in mappings with high confidence", () => {
    const engine = new MappingEngine(sampleProfile);
    const mockElement = {} as HTMLElement;

    const firstNameField: FieldDescriptor = {
      id: "f1",
      element: mockElement,
      fingerprint: {
        label: "Legal First Name",
        accessibleName: "",
        placeholder: "",
        kind: "text",
        section: "Information",
        tenant: "theapexgroup"
      },
      required: true,
      visible: true,
      options: []
    };

    const match = engine.resolve(firstNameField);
    expect(match.source).toBe("builtin");
    expect(match.sourcePath).toBe("personal.firstName");
    expect(match.value).toBe("Jane");
    expect(match.confidence).toBeGreaterThanOrEqual(80);
  });

  it("prioritizes user mappings over built-in mappings", () => {
    const userMapping: FieldMapping = {
      id: "m-1",
      fingerprint: {
        label: "first name",
        accessibleName: "",
        placeholder: "",
        kind: "text",
        section: "",
        tenant: "*"
      },
      source: "fixedValue",
      fixedValue: "Custom Override Name",
      tenantScope: "*",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const engine = new MappingEngine(sampleProfile, [userMapping]);
    const mockElement = {} as HTMLElement;

    const field: FieldDescriptor = {
      id: "f1",
      element: mockElement,
      fingerprint: {
        label: "First Name",
        accessibleName: "",
        placeholder: "",
        kind: "text",
        section: "",
        tenant: "theapexgroup"
      },
      required: true,
      visible: true,
      options: []
    };

    const match = engine.resolve(field);
    expect(match.source).toBe("fixedValue");
    expect(match.value).toBe("Custom Override Name");
    expect(match.confidence).toBe(100);
  });

  it("matches Custom Fields and Application Answers", () => {
    const engine = new MappingEngine(sampleProfile);
    const mockElement = {} as HTMLElement;

    const salaryField: FieldDescriptor = {
      id: "f2",
      element: mockElement,
      fingerprint: {
        label: "Expected Salary",
        accessibleName: "",
        placeholder: "",
        kind: "text",
        section: "General",
        tenant: "theapexgroup"
      },
      required: false,
      visible: true,
      options: []
    };

    const match = engine.resolve(salaryField);
    expect(match.source).toBe("customField");
    expect(match.value).toBe("$150,000");
  });

  it("penalizes ambiguous labels in confidence calculations", () => {
    const mockElement = {} as HTMLElement;
    const ambiguousField: FieldDescriptor = {
      id: "f3",
      element: mockElement,
      fingerprint: {
        label: "name",
        accessibleName: "",
        placeholder: "",
        kind: "text",
        section: "",
        tenant: "theapexgroup"
      },
      required: false,
      visible: true,
      options: []
    };

    const confidence = calculateConfidence(ambiguousField, { pattern: /name/, path: "personal.firstName" });
    expect(confidence.score).toBeLessThan(80);
    expect(confidence.category).not.toBe("AUTOMATIC");
  });
});
