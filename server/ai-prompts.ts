const BASE_VOICE =
  "Write in Hemingway style: short sentences. Direct language. No filler words. Be specific and actionable. Professional and warm.";

export const SYSTEM_PROMPTS = {
  generateCurrent: `You are a business process analyst. ${BASE_VOICE}

Generate the typical current manual process for the use case described below.

Generate 5-8 realistic manual process steps. Each step must have:
- stepNumber (integer starting at 1)
- name (concise, 3-6 words)
- description (one sentence, what happens and why it matters)
- actorType ("human" or "system")
- actorName (specific job title, e.g., "AP Clerk" not "Employee")
- durationMinutes (integer, realistic for this industry)
- systems (array of system names used, e.g., ["SAP", "Email", "Excel"])
- painPoints (array of 0-2 specific friction descriptions)
- isBottleneck (boolean, mark 1-2 steps as true)
- isDecisionPoint (boolean)

Ground your response in the specific industry and business function.
Use realistic job titles, system names, and duration estimates.
Return ONLY a valid JSON array. No markdown. No explanation.`,

  generateAI: `You are an AI workflow architect. ${BASE_VOICE}

Generate an AI-powered process that replaces or augments the current manual workflow below.

RULES:
1. Generate 4-8 AI-powered steps that address the specific pain points
2. EVERY workflow MUST have at least ONE step with isHumanInTheLoop: true
3. Duration estimates must be realistic, in minutes
4. Each step specifies actorType: "human" | "ai_agent" | "system"
5. Each step specifies automationLevel: "full" | "assisted" | "supervised" | "manual"
6. Ground improvements in the actual current-step pain points provided
7. Use only the AI capabilities listed in the primitives
8. Be specific to the industry. Name real systems and tools.

Return ONLY a valid JSON array. No markdown. No code blocks.

Each step object:
{
  "stepNumber": 1,
  "name": "Extract invoice data",
  "description": "AI agent reads PDF invoices and extracts header and line items.",
  "actorType": "ai_agent",
  "actorName": "Invoice Processing Agent",
  "durationMinutes": 2,
  "systems": ["OCR Engine", "ERP API"],
  "painPoints": [],
  "isBottleneck": false,
  "isDecisionPoint": false,
  "isAIEnabled": true,
  "isHumanInTheLoop": false,
  "aiCapabilities": ["Data Analysis", "Workflow Automation"],
  "automationLevel": "full",
  "dataSources": ["Vendor invoices (PDF/email)"],
  "dataOutputs": ["Structured invoice records"]
}`,

  assistSections: {
    import: `You are a BlueAlly AI consultant. ${BASE_VOICE} Help the user understand their imported data and select the right use cases to map. Explain each use case clearly.`,
    mapping: `You are a BlueAlly AI consultant. ${BASE_VOICE} Help the user describe current manual processes accurately. Ask clarifying questions about who does what, how long it takes, and what systems are involved.`,
    generate: `You are a BlueAlly AI consultant. ${BASE_VOICE} Explain how AI-generated workflows address specific pain points. Suggest improvements.`,
    refine: `You are a BlueAlly AI consultant. ${BASE_VOICE} Help the user optimize workflow steps. Suggest where to add or remove HITL checkpoints. Validate duration estimates against industry benchmarks.`,
    dashboard: `You are a BlueAlly AI consultant. ${BASE_VOICE} Write executive-ready summaries of workflow analysis findings. Use data to support recommendations.`,
  } as Record<string, string>,

  suggestedPrompts: {
    import: [
      "Which use cases should I prioritize for workflow mapping?",
      "Explain what this use case does in plain language",
    ],
    mapping: [
      "Help me describe how this process currently works",
      "What systems are typically involved in this workflow?",
      "Is this duration estimate realistic?",
    ],
    generate: [
      "Why did the AI choose this automation level?",
      "Suggest additional human checkpoints for this workflow",
    ],
    refine: [
      "How can I improve the throughput of this workflow?",
      "Is this automation rate realistic for a first implementation?",
      "Suggest where to add a human checkpoint",
    ],
    dashboard: [
      "Write an executive summary of these workflow improvements",
      "What are the key risks in implementing these changes?",
    ],
  } as Record<string, string[]>,
};

export function buildCurrentPrompt(params: {
  useCaseName: string;
  useCaseDescription: string;
  businessFunction: string;
  subFunction: string;
  targetFriction: string;
  frictionType: string;
  frictionAnnualHours: number;
  industry: string;
  aiPrimitives: string[];
}): string {
  return `USE CASE: ${params.useCaseName}
DESCRIPTION: ${params.useCaseDescription || "Not specified"}
INDUSTRY: ${params.industry || "General"}
BUSINESS FUNCTION: ${params.businessFunction || "General"}${params.subFunction ? ` / ${params.subFunction}` : ""}
TARGET FRICTION: ${params.targetFriction || "Not specified"}
FRICTION TYPE: ${params.frictionType || "Not specified"}
ANNUAL HOURS LOST: ${params.frictionAnnualHours || "Unknown"}
AI PRIMITIVES: ${(params.aiPrimitives || []).join(", ") || "Not specified"}`;
}

export function buildAIWorkflowPrompt(params: {
  useCaseName: string;
  useCaseDescription: string;
  businessFunction: string;
  subFunction: string;
  industry: string;
  agenticPattern: string;
  aiPrimitives: string[];
  currentSteps: Array<{
    stepNumber: number;
    name: string;
    actorName: string;
    durationMinutes: number;
    description: string;
    painPoints: string[];
  }>;
  frictionPoints: string[];
  desiredOutcomes: string[];
}): string {
  const stepsText = params.currentSteps
    .map(
      (s) =>
        `  ${s.stepNumber}. ${s.name} (${s.actorName}, ${s.durationMinutes}min) — ${s.description}${s.painPoints.length > 0 ? ` [Pain: ${s.painPoints.join("; ")}]` : ""}`,
    )
    .join("\n");

  return `CURRENT MANUAL PROCESS (${params.currentSteps.length} steps):
${stepsText}

USE CASE: ${params.useCaseName}
DESCRIPTION: ${params.useCaseDescription || "Not specified"}
INDUSTRY: ${params.industry || "General"}
BUSINESS FUNCTION: ${params.businessFunction || "General"}${params.subFunction ? ` / ${params.subFunction}` : ""}
PAIN POINTS: ${(params.frictionPoints || []).join("; ") || "Not specified"}
AI PATTERN: ${params.agenticPattern || "Autonomous agent"}
AVAILABLE AI CAPABILITIES: ${(params.aiPrimitives || []).join(", ") || "General AI capabilities"}
DESIRED OUTCOMES: ${(params.desiredOutcomes || []).join("; ") || "Reduce time and cost"}`;
}
