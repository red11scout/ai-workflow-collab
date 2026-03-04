import type {
  ImportedUseCase,
  ImportedFriction,
  ImportedBenefit,
} from "@shared/types";

interface ParseResult {
  companyName: string;
  industry: string;
  description: string;
  useCases: ImportedUseCase[];
  frictionPoints: ImportedFriction[];
  benefits: ImportedBenefit[];
  warnings: string[];
}

export function parseImportedJson(raw: any): ParseResult {
  const warnings: string[] = [];

  // Extract company info
  const company = raw.company || {};
  const companyName = company.name || "Unknown Company";
  const industry = company.industry || "";
  const description = company.description || "";

  // Extract steps from analysis
  const steps = raw.analysis?.steps || [];

  // Step 0: Company Overview (text, skip)

  // Step 3: Friction Points
  const frictionStep = steps.find((s: any) => s.step === 3);
  const frictionPoints: ImportedFriction[] = (frictionStep?.data || []).map(
    (fp: any) => ({
      id: fp.id || "",
      frictionPoint: fp.frictionPoint || "",
      frictionType: fp.frictionType || "",
      severity: fp.severity || "Medium",
      annualHours: fp.annualHours || 0,
      hourlyRate: fp.hourlyRate || 0,
      loadedHourlyRate: fp.loadedHourlyRate || fp.hourlyRate || 0,
      estimatedAnnualCost: fp.estimatedAnnualCost || "0",
      function: fp.function || "",
      subFunction: fp.subFunction || "",
      strategicTheme: fp.strategicTheme || "",
      strategicThemeId: fp.strategicThemeId || "",
    }),
  );

  // Step 4: Use Cases
  const useCaseStep = steps.find((s: any) => s.step === 4);
  const useCases: ImportedUseCase[] = (useCaseStep?.data || []).map(
    (uc: any) => ({
      id: uc.id || "",
      name: uc.name || "",
      description: uc.description || "",
      function: uc.function || "",
      subFunction: uc.subFunction || "",
      aiPrimitives: uc.aiPrimitives || [],
      agenticPattern: uc.agenticPattern || uc.primaryPattern || "",
      patternRationale: uc.patternRationale || "",
      hitlCheckpoint: uc.hitlCheckpoint || "",
      targetFriction: uc.targetFriction || "",
      targetFrictionId: uc.targetFrictionId || "",
      strategicTheme: uc.strategicTheme || "",
      strategicThemeId: uc.strategicThemeId || "",
      desiredOutcomes: uc.desiredOutcomes || [],
      dataTypes: uc.dataTypes || [],
      integrations: uc.integrations || [],
    }),
  );

  // Step 5: Benefits
  const benefitStep = steps.find((s: any) => s.step === 5);
  const benefits: ImportedBenefit[] = (benefitStep?.data || []).map(
    (b: any) => ({
      id: b.id || b.useCaseId || "",
      useCaseId: b.useCaseId || b.id || "",
      useCaseName: b.useCaseName || "",
      totalAnnualValue: b.totalAnnualValue || "$0",
      expectedValue: b.expectedValue || "$0",
      costBenefit: b.costBenefit || "$0",
      revenueBenefit: b.revenueBenefit || "$0",
      riskBenefit: b.riskBenefit || "$0",
      cashFlowBenefit: b.cashFlowBenefit || "$0",
      probabilityOfSuccess: b.probabilityOfSuccess || 0.5,
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
  const mappedFrictionIds = new Set(useCases.map((uc) => uc.targetFrictionId));
  const unmapped = frictionPoints.filter((fp) => !mappedFrictionIds.has(fp.id));
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
