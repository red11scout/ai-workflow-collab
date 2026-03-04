import type {
  ImportedUseCase,
  ImportedFriction,
  ImportedBenefit,
} from "../shared/types";

interface ParseResult {
  companyName: string;
  industry: string;
  description: string;
  useCases: ImportedUseCase[];
  frictionPoints: ImportedFriction[];
  benefits: ImportedBenefit[];
  warnings: string[];
}

/**
 * Get a field from an object, trying camelCase first then Title Case alternatives.
 * Handles the two JSON export formats:
 *   - camelCase from the newer export (e.g. frictionPoint, annualHours)
 *   - Title Case from the original discover app (e.g. "Friction Point", "Annual Hours")
 */
function g(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

/**
 * Coerce AI Primitives to string array — the discover app sometimes
 * returns a comma-separated string instead of an array.
 */
function toStringArray(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim()) {
    return val.split(",").map((s: string) => s.trim());
  }
  return [];
}

/**
 * Strip dollar signs and parse cost strings like "$2.1M", "$238K", "1300000"
 */
function parseCostString(val: any): string {
  if (val == null) return "$0";
  return String(val);
}

export function parseImportedJson(raw: any): ParseResult {
  const warnings: string[] = [];

  // Extract company info — handle both { company: { name } } and { companyName }
  const company = raw.company || {};
  const companyName =
    company.name || raw.companyName || raw.company_name || "Unknown Company";
  const industry = company.industry || raw.industry || "";
  const description = company.description || raw.description || "";

  // Extract steps from analysis
  const steps = raw.analysis?.steps || [];

  // Step 3: Friction Points
  const frictionStep = steps.find((s: any) => s.step === 3);
  const frictionPoints: ImportedFriction[] = (frictionStep?.data || []).map(
    (fp: any, i: number) => ({
      id: g(fp, "id", "ID") || `FP-${String(i + 1).padStart(2, "0")}`,
      frictionPoint: g(fp, "frictionPoint", "Friction Point") || "",
      frictionType: g(fp, "frictionType", "Friction Type") || "",
      severity: g(fp, "severity", "Severity") || "Medium",
      annualHours: g(fp, "annualHours", "Annual Hours") || 0,
      hourlyRate: g(fp, "hourlyRate", "Hourly Rate") || 0,
      loadedHourlyRate:
        g(fp, "loadedHourlyRate", "Loaded Hourly Rate") ||
        g(fp, "hourlyRate", "Hourly Rate") ||
        0,
      estimatedAnnualCost: parseCostString(
        g(fp, "estimatedAnnualCost", "Estimated Annual Cost ($)"),
      ),
      function: g(fp, "function", "Function") || "",
      subFunction: g(fp, "subFunction", "Sub-Function") || "",
      strategicTheme: g(fp, "strategicTheme", "Strategic Theme") || "",
      strategicThemeId: g(fp, "strategicThemeId") || "",
    }),
  );

  // Step 4: Use Cases
  const useCaseStep = steps.find((s: any) => s.step === 4);
  const useCases: ImportedUseCase[] = (useCaseStep?.data || []).map(
    (uc: any) => ({
      id: g(uc, "id", "ID") || "",
      name: g(uc, "name", "Use Case Name") || "",
      description: g(uc, "description", "Description") || "",
      function: g(uc, "function", "Function") || "",
      subFunction: g(uc, "subFunction", "Sub-Function") || "",
      aiPrimitives: toStringArray(g(uc, "aiPrimitives", "AI Primitives")),
      agenticPattern:
        g(uc, "agenticPattern", "Agentic Pattern") ||
        g(uc, "primaryPattern", "Primary Pattern") ||
        "",
      patternRationale:
        g(uc, "patternRationale", "Pattern Rationale") || "",
      hitlCheckpoint:
        g(uc, "hitlCheckpoint", "Human-in-the-Loop Checkpoint") || "",
      targetFriction: g(uc, "targetFriction", "Target Friction") || "",
      targetFrictionId: g(uc, "targetFrictionId") || "",
      strategicTheme: g(uc, "strategicTheme", "Strategic Theme") || "",
      strategicThemeId: g(uc, "strategicThemeId") || "",
      desiredOutcomes: toStringArray(
        g(uc, "desiredOutcomes", "Desired Outcomes"),
      ),
      dataTypes: toStringArray(g(uc, "dataTypes", "Data Types")),
      integrations: toStringArray(g(uc, "integrations", "Integrations")),
    }),
  );

  // Step 5: Benefits
  const benefitStep = steps.find((s: any) => s.step === 5);
  const benefits: ImportedBenefit[] = (benefitStep?.data || []).map(
    (b: any) => ({
      id: g(b, "id", "ID") || g(b, "useCaseId") || "",
      useCaseId: g(b, "useCaseId") || g(b, "id", "ID") || "",
      useCaseName: g(b, "useCaseName", "Use Case") || "",
      totalAnnualValue: parseCostString(
        g(b, "totalAnnualValue", "Total Annual Value ($)"),
      ),
      expectedValue: parseCostString(
        g(b, "expectedValue", "Expected Value ($)"),
      ),
      costBenefit: parseCostString(g(b, "costBenefit", "Cost Benefit ($)")),
      revenueBenefit: parseCostString(
        g(b, "revenueBenefit", "Revenue Benefit ($)"),
      ),
      riskBenefit: parseCostString(g(b, "riskBenefit", "Risk Benefit ($)")),
      cashFlowBenefit: parseCostString(
        g(b, "cashFlowBenefit", "Cash Flow Benefit ($)"),
      ),
      probabilityOfSuccess:
        g(b, "probabilityOfSuccess", "Probability of Success") || 0.5,
    }),
  );

  // Validation
  if (useCases.length === 0) {
    warnings.push("No use cases found in imported data.");
  }
  if (frictionPoints.length === 0) {
    warnings.push("No friction points found in imported data.");
  }

  // Check for unmapped friction points
  const mappedFrictionIds = new Set(
    useCases.map((uc) => uc.targetFrictionId),
  );
  const unmapped = frictionPoints.filter(
    (fp) => !mappedFrictionIds.has(fp.id),
  );
  if (unmapped.length > 0) {
    warnings.push(
      `${unmapped.length} friction point(s) not mapped to any use case.`,
    );
  }

  return {
    companyName,
    industry,
    description,
    useCases,
    frictionPoints,
    benefits,
    warnings,
  };
}
