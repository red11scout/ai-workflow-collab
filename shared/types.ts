// ─── Imported Data Types ─────────────────────────────────────────────────────

export interface ImportedUseCase {
  id: string;
  name: string;
  description: string;
  function: string;
  subFunction: string;
  aiPrimitives: string[];
  agenticPattern: string;
  patternRationale: string;
  hitlCheckpoint: string;
  targetFriction: string;
  targetFrictionId: string;
  strategicTheme: string;
  strategicThemeId: string;
  desiredOutcomes: string[];
  dataTypes: string[];
  integrations: string[];
}

export interface ImportedFriction {
  id: string;
  frictionPoint: string;
  frictionType: string;
  severity: string;
  annualHours: number;
  hourlyRate: number;
  loadedHourlyRate: number;
  estimatedAnnualCost: string;
  function: string;
  subFunction: string;
  strategicTheme: string;
  strategicThemeId: string;
}

export interface ImportedBenefit {
  id: string;
  useCaseId: string;
  useCaseName: string;
  totalAnnualValue: string;
  expectedValue: string;
  costBenefit: string;
  revenueBenefit: string;
  riskBenefit: string;
  cashFlowBenefit: string;
  probabilityOfSuccess: number;
}

// ─── Workflow Data Types ─────────────────────────────────────────────────────

export interface WorkflowStepData {
  id: string;
  workflowId: string;
  phase: "current" | "ai";
  stepNumber: number;
  name: string;
  description: string;
  actorType: "human" | "system" | "ai_agent";
  actorName: string;
  durationMinutes: number;
  systems: string[];
  painPoints: string[];
  isBottleneck: boolean;
  isDecisionPoint: boolean;
  isAIEnabled: boolean;
  isHumanInTheLoop: boolean;
  aiCapabilities: string[];
  automationLevel: "full" | "assisted" | "supervised" | "manual";
  dataSources: string[];
  dataOutputs: string[];
}

export interface WorkflowWithSteps {
  id: string;
  projectId: string;
  useCaseId: string;
  useCaseName: string;
  useCaseDescription: string | null;
  businessFunction: string | null;
  subFunction: string | null;
  strategicTheme: string | null;
  targetFriction: string | null;
  agenticPattern: string | null;
  patternRationale: string | null;
  aiPrimitives: string[];
  desiredOutcomes: string[];
  dataTypes: string[];
  integrations: string[];
  hourlyRateOverride: number | null;
  frictionAnnualCost: number;
  frictionAnnualHours: number;
  aiGenerated: boolean;
  sortOrder: number;
  currentSteps: WorkflowStepData[];
  aiSteps: WorkflowStepData[];
}

// ─── Metrics Types ───────────────────────────────────────────────────────────

export interface WorkflowMetrics {
  currentTotalMinutes: number;
  aiTotalMinutes: number;
  timeReductionPct: number;
  currentAnnualCost: number;
  aiAnnualCost: number;
  annualSavings: number;
  costReductionPct: number;
  automationRate: number;
  hitlStepCount: number;
  throughputMultiplier: number;
}

export interface AggregateMetrics {
  totalAnnualTimeSavedHours: number;
  totalAnnualSavings: number;
  avgAutomationRate: number;
  roi3Year: number;
  paybackMonths: number;
  workflowCount: number;
}

export interface FormulaTrace {
  metricName: string;
  formulaString: string;
  substituted: string;
  result: string;
  inputs: Array<{
    label: string;
    value: number;
    source: string;
  }>;
}

// ─── Project Types ───────────────────────────────────────────────────────────

export interface ProjectWithWorkflows {
  id: string;
  ownerToken: string;
  name: string;
  companyName: string;
  industry: string;
  description: string;
  status: string;
  avgHourlyRate: number;
  annualRevenue: number;
  headcount: number;
  adoptionRatePct: number;
  dataMaturityPct: number;
  selectedUseCaseIds: string[];
  importedUseCases: ImportedUseCase[] | null;
  importedFriction: ImportedFriction[] | null;
  importedBenefits: ImportedBenefit[] | null;
  currentStep: number;
  completedSteps: number[];
  workflows: WorkflowWithSteps[];
  createdAt: string;
  updatedAt: string;
}
