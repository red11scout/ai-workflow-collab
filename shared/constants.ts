// ─── Steps ───────────────────────────────────────────────────────────────────

export const STEPS = [
  {
    path: "import",
    label: "Import & Select",
    shortLabel: "Import",
    step: 0,
  },
  {
    path: "mapping",
    label: "Map Current",
    shortLabel: "Mapping",
    step: 1,
  },
  {
    path: "generate",
    label: "Generate AI",
    shortLabel: "Generate",
    step: 2,
  },
  {
    path: "refine",
    label: "Review & Refine",
    shortLabel: "Refine",
    step: 3,
  },
  {
    path: "dashboard",
    label: "Dashboard",
    shortLabel: "Dashboard",
    step: 4,
  },
] as const;

// ─── Automation Levels ───────────────────────────────────────────────────────

export const AUTOMATION_LEVELS = [
  { value: "full", label: "Fully Automated", color: "green" },
  { value: "assisted", label: "AI-Assisted", color: "blue" },
  { value: "supervised", label: "Supervised", color: "amber" },
  { value: "manual", label: "Manual", color: "gray" },
] as const;

export const ACTOR_TYPES = [
  { value: "human", label: "Human" },
  { value: "system", label: "System" },
  { value: "ai_agent", label: "AI Agent" },
] as const;

// ─── Scenario Multipliers ────────────────────────────────────────────────────

export const SCENARIO_MULTIPLIERS = {
  conservative: 0.6,
  moderate: 1.0,
  aggressive: 1.3,
} as const;

// ─── Default Workforce Parameters ────────────────────────────────────────────

export const DEFAULT_PARAMS = {
  avgHourlyRate: 85,
  annualRevenue: 0,
  headcount: 0,
  adoptionRatePct: 90,
  dataMaturityPct: 75,
  implementationCost: 250000,
  annualRunsPerWorkflow: 2000,
} as const;
