// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import { scanFields, resolveLabelForElement, detectFieldKind } from "../../src/content/fields/field-detector";
import { detectWorkday } from "../../src/content/detection/workday-detector";

describe("Workday DOM Fixtures & Detection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("detects Workday career site from DOM attributes and scripts", () => {
    document.body.innerHTML = `
      <div id="workdayApplication" data-automation-id="job-apply-container">
        <header data-automation-id="pageHeader">Job Application</header>
        <form>
          <div data-automation-id="formField-legalName">
            <label data-automation-id="formLabel">Legal First Name *</label>
            <input type="text" data-automation-id="legalName-first" required />
          </div>
        </form>
      </div>
    `;

    const result = detectWorkday(
      { hostname: "theapexgroup.wd3.myworkdayjobs.com", pathname: "/apply", href: "https://theapexgroup.wd3.myworkdayjobs.com/apply" } as Location,
      document
    );

    expect(result.isWorkday).toBe(true);
    expect(result.isApplication).toBe(true);
    expect(result.tenant).toBe("theapexgroup");
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });

  it("scans and resolves explicit and aria-labelled fields", () => {
    document.body.innerHTML = `
      <section data-automation-id="personalInfoSection">
        <h2 data-automation-id="sectionHeading">Personal Information</h2>
        
        <!-- Explicit label with for -->
        <div class="form-group">
          <label for="inp-email">Email Address *</label>
          <input id="inp-email" type="email" required />
        </div>

        <!-- aria-labelledby -->
        <div class="form-group">
          <span id="lbl-phone">Mobile Phone</span>
          <input id="inp-phone" aria-labelledby="lbl-phone" type="tel" />
        </div>

        <!-- Enclosing label -->
        <label>
          Street Address
          <input id="inp-address" type="text" />
        </label>
      </section>
    `;

    const fields = scanFields(document);
    expect(fields.length).toBe(3);

    const emailField = fields.find((f) => f.id === "inp-email");
    expect(emailField).toBeDefined();
    expect(emailField?.fingerprint.label).toBe("email");
    expect(emailField?.required).toBe(true);

    const phoneField = fields.find((f) => f.id === "inp-phone");
    expect(phoneField).toBeDefined();
    expect(phoneField?.fingerprint.label).toBe("phone");

    const addressField = fields.find((f) => f.id === "inp-address");
    expect(addressField).toBeDefined();
    expect(addressField?.fingerprint.label).toBe("address");
  });

  it("groups radio buttons with common name into a logical radioGroup descriptor", () => {
    document.body.innerHTML = `
      <fieldset data-automation-id="relocate-group">
        <legend>Are you willing to relocate?</legend>
        <label>
          <input type="radio" name="relocate_choice" value="yes" /> Yes
        </label>
        <label>
          <input type="radio" name="relocate_choice" value="no" /> No
        </label>
      </fieldset>
    `;

    const fields = scanFields(document);
    expect(fields.length).toBe(1);
    expect(fields[0].fingerprint.kind).toBe("radioGroup");
    expect(fields[0].fingerprint.label).toContain("relocate");
    expect(fields[0].options).toContain("Yes");
    expect(fields[0].options).toContain("No");
  });

  it("detects Workday custom combobox and dropdown controls", () => {
    document.body.innerHTML = `
      <div data-automation-id="formField-country">
        <label data-automation-id="formLabel">Country</label>
        <div role="combobox" aria-label="Country selection" data-automation-id="searchBox">
          <input type="text" placeholder="Search country..." />
        </div>
      </div>
    `;

    const fields = scanFields(document);
    expect(fields.length).toBe(1);
    expect(fields[0].fingerprint.kind).toBe("combobox");
  });
});
