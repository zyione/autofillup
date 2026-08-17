export interface WorkdayDetectionResult {
  isWorkday: boolean;
  isApplication: boolean;
  tenant: string;
  confidence: number;
  reasons: string[];
}

export function detectWorkday(loc: Location = location, doc: Document = document): WorkdayDetectionResult {
  const reasons: string[] = [];
  let score = 0;

  // Layer 1: Hostname patterns
  const host = loc.hostname.toLowerCase();
  const isWorkdayHost = host.endsWith(".myworkdayjobs.com") || host.includes("workday") || host.includes("myworkday");
  if (isWorkdayHost) {
    score += 50;
    reasons.push(`Hostname matched Workday domain pattern (${host})`);
  }

  // Extract tenant name from subdomain (e.g., theapexgroup.wd3.myworkdayjobs.com -> theapexgroup)
  let tenant = host;
  const parts = host.split(".");
  if (parts.length > 0) {
    tenant = parts[0];
  }

  // Layer 2: DOM Evidence (Workday attributes, automation IDs, React containers)
  const hasAutomationIds = !!doc.querySelector("[data-automation-id]");
  if (hasAutomationIds) {
    score += 30;
    reasons.push("Found Workday data-automation-id attributes");
  }

  const hasWorkdayRoots = !!doc.querySelector("#workdayApplication, [data-automation-id='job-apply-container'], [data-automation-id='applyFlow']");
  if (hasWorkdayRoots) {
    score += 20;
    reasons.push("Found Workday root application container");
  }

  const hasWorkdayScripts = Array.from(doc.scripts).some((s) => s.src.includes("workday") || s.src.includes("wd-"));
  if (hasWorkdayScripts) {
    score += 15;
    reasons.push("Found Workday bundle scripts");
  }

  // Layer 3: Application page structure
  const path = loc.pathname.toLowerCase();
  const isApplicationPath = path.includes("/apply") || path.includes("/job/") || path.includes("/application");
  const hasFormStructure = !!doc.querySelector("form, [role='main'], [data-automation-id='pageHeader']");
  const isApplication = (isWorkdayHost || score >= 40) && (isApplicationPath || hasAutomationIds || hasFormStructure);

  const confidence = Math.min(100, score);
  const isWorkday = confidence >= 40 || isWorkdayHost;

  return {
    isWorkday,
    isApplication,
    tenant,
    confidence,
    reasons
  };
}
