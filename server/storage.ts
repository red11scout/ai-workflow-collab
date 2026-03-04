import { db } from "./db";
import {
  projects,
  workflows,
  workflowSteps,
  shareLinks,
  aiConversations,
} from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import type { WorkflowWithSteps, WorkflowStepData } from "@shared/types";

// ─── Projects ────────────────────────────────────────────────────────────────

export async function getProjectsByOwner(ownerToken: string) {
  return db
    .select()
    .from(projects)
    .where(eq(projects.ownerToken, ownerToken))
    .orderBy(asc(projects.createdAt));
}

export async function getProject(id: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id));
  return project || null;
}

export async function getProjectWithWorkflows(
  id: string,
): Promise<any | null> {
  const project = await getProject(id);
  if (!project) return null;

  const wfs = await getWorkflowsForProject(id);
  return { ...project, workflows: wfs };
}

export async function createProject(data: {
  ownerToken: string;
  name: string;
  companyName?: string;
  industry?: string;
  description?: string;
}) {
  const [project] = await db
    .insert(projects)
    .values({
      ownerToken: data.ownerToken,
      name: data.name,
      companyName: data.companyName || "",
      industry: data.industry || "",
      description: data.description || "",
    })
    .returning();
  return project;
}

export async function updateProject(id: string, data: Record<string, any>) {
  data.updatedAt = new Date();
  const [updated] = await db
    .update(projects)
    .set(data)
    .where(eq(projects.id, id))
    .returning();
  return updated;
}

export async function deleteProject(id: string) {
  await db.delete(projects).where(eq(projects.id, id));
}

// ─── Workflows ───────────────────────────────────────────────────────────────

export async function getWorkflowsForProject(
  projectId: string,
): Promise<WorkflowWithSteps[]> {
  const wfs = await db
    .select()
    .from(workflows)
    .where(eq(workflows.projectId, projectId))
    .orderBy(asc(workflows.sortOrder));

  const result: WorkflowWithSteps[] = [];
  for (const wf of wfs) {
    const steps = await getStepsForWorkflow(wf.id);
    result.push({
      ...wf,
      hourlyRateOverride: wf.hourlyRateOverride ?? null,
      frictionAnnualCost: wf.frictionAnnualCost ?? 0,
      frictionAnnualHours: wf.frictionAnnualHours ?? 0,
      aiPrimitives: (wf.aiPrimitives as string[]) || [],
      desiredOutcomes: (wf.desiredOutcomes as string[]) || [],
      dataTypes: (wf.dataTypes as string[]) || [],
      integrations: (wf.integrations as string[]) || [],
      aiGenerated: wf.aiGenerated ?? false,
      sortOrder: wf.sortOrder ?? 0,
      currentSteps: steps.current,
      aiSteps: steps.ai,
    });
  }
  return result;
}

export async function getWorkflow(id: string) {
  const [wf] = await db.select().from(workflows).where(eq(workflows.id, id));
  return wf || null;
}

export async function getWorkflowWithSteps(
  id: string,
): Promise<WorkflowWithSteps | null> {
  const wf = await getWorkflow(id);
  if (!wf) return null;

  const steps = await getStepsForWorkflow(id);
  return {
    ...wf,
    hourlyRateOverride: wf.hourlyRateOverride ?? null,
    frictionAnnualCost: wf.frictionAnnualCost ?? 0,
    frictionAnnualHours: wf.frictionAnnualHours ?? 0,
    aiPrimitives: (wf.aiPrimitives as string[]) || [],
    desiredOutcomes: (wf.desiredOutcomes as string[]) || [],
    dataTypes: (wf.dataTypes as string[]) || [],
    integrations: (wf.integrations as string[]) || [],
    aiGenerated: wf.aiGenerated ?? false,
    sortOrder: wf.sortOrder ?? 0,
    currentSteps: steps.current,
    aiSteps: steps.ai,
  };
}

export async function createWorkflow(data: {
  projectId: string;
  useCaseId: string;
  useCaseName: string;
  useCaseDescription?: string;
  businessFunction?: string;
  subFunction?: string;
  strategicTheme?: string;
  targetFriction?: string;
  agenticPattern?: string;
  patternRationale?: string;
  aiPrimitives?: string[];
  desiredOutcomes?: string[];
  dataTypes?: string[];
  integrations?: string[];
  frictionAnnualCost?: number;
  frictionAnnualHours?: number;
  sortOrder?: number;
}) {
  const [wf] = await db
    .insert(workflows)
    .values({
      projectId: data.projectId,
      useCaseId: data.useCaseId,
      useCaseName: data.useCaseName,
      useCaseDescription: data.useCaseDescription || "",
      businessFunction: data.businessFunction || "",
      subFunction: data.subFunction || "",
      strategicTheme: data.strategicTheme || "",
      targetFriction: data.targetFriction || "",
      agenticPattern: data.agenticPattern || "",
      patternRationale: data.patternRationale || "",
      aiPrimitives: data.aiPrimitives || [],
      desiredOutcomes: data.desiredOutcomes || [],
      dataTypes: data.dataTypes || [],
      integrations: data.integrations || [],
      frictionAnnualCost: data.frictionAnnualCost || 0,
      frictionAnnualHours: data.frictionAnnualHours || 0,
      sortOrder: data.sortOrder || 0,
    })
    .returning();
  return wf;
}

export async function updateWorkflow(id: string, data: Record<string, any>) {
  data.updatedAt = new Date();
  const [updated] = await db
    .update(workflows)
    .set(data)
    .where(eq(workflows.id, id))
    .returning();
  return updated;
}

export async function deleteWorkflow(id: string) {
  await db.delete(workflows).where(eq(workflows.id, id));
}

// ─── Workflow Steps ──────────────────────────────────────────────────────────

export async function getStepsForWorkflow(
  workflowId: string,
): Promise<{ current: WorkflowStepData[]; ai: WorkflowStepData[] }> {
  const allSteps = await db
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.workflowId, workflowId))
    .orderBy(asc(workflowSteps.stepNumber));

  const current: WorkflowStepData[] = [];
  const ai: WorkflowStepData[] = [];

  for (const s of allSteps) {
    const step: WorkflowStepData = {
      id: s.id,
      workflowId: s.workflowId,
      phase: s.phase as "current" | "ai",
      stepNumber: s.stepNumber,
      name: s.name,
      description: s.description || "",
      actorType: s.actorType as "human" | "system" | "ai_agent",
      actorName: s.actorName || "",
      durationMinutes: s.durationMinutes,
      systems: (s.systems as string[]) || [],
      painPoints: (s.painPoints as string[]) || [],
      isBottleneck: s.isBottleneck ?? false,
      isDecisionPoint: s.isDecisionPoint ?? false,
      isAIEnabled: s.isAIEnabled ?? false,
      isHumanInTheLoop: s.isHumanInTheLoop ?? false,
      aiCapabilities: (s.aiCapabilities as string[]) || [],
      automationLevel: (s.automationLevel as any) || "manual",
      dataSources: (s.dataSources as string[]) || [],
      dataOutputs: (s.dataOutputs as string[]) || [],
    };
    if (s.phase === "current") current.push(step);
    else ai.push(step);
  }

  return { current, ai };
}

export async function createStep(data: {
  workflowId: string;
  phase: string;
  stepNumber: number;
  name: string;
  description?: string;
  actorType?: string;
  actorName?: string;
  durationMinutes?: number;
  systems?: string[];
  painPoints?: string[];
  isBottleneck?: boolean;
  isDecisionPoint?: boolean;
  isAIEnabled?: boolean;
  isHumanInTheLoop?: boolean;
  aiCapabilities?: string[];
  automationLevel?: string;
  dataSources?: string[];
  dataOutputs?: string[];
}) {
  const [step] = await db
    .insert(workflowSteps)
    .values({
      workflowId: data.workflowId,
      phase: data.phase,
      stepNumber: data.stepNumber,
      name: data.name,
      description: data.description || "",
      actorType: data.actorType || "human",
      actorName: data.actorName || "",
      durationMinutes: data.durationMinutes || 60,
      systems: data.systems || [],
      painPoints: data.painPoints || [],
      isBottleneck: data.isBottleneck || false,
      isDecisionPoint: data.isDecisionPoint || false,
      isAIEnabled: data.isAIEnabled || false,
      isHumanInTheLoop: data.isHumanInTheLoop || false,
      aiCapabilities: data.aiCapabilities || [],
      automationLevel: data.automationLevel || "manual",
      dataSources: data.dataSources || [],
      dataOutputs: data.dataOutputs || [],
    })
    .returning();
  return step;
}

export async function updateStep(id: string, data: Record<string, any>) {
  data.updatedAt = new Date();
  const [updated] = await db
    .update(workflowSteps)
    .set(data)
    .where(eq(workflowSteps.id, id))
    .returning();
  return updated;
}

export async function deleteStep(id: string) {
  await db.delete(workflowSteps).where(eq(workflowSteps.id, id));
}

export async function deleteStepsByWorkflowAndPhase(
  workflowId: string,
  phase: string,
) {
  await db
    .delete(workflowSteps)
    .where(
      and(
        eq(workflowSteps.workflowId, workflowId),
        eq(workflowSteps.phase, phase),
      ),
    );
}

export async function batchCreateSteps(
  steps: Array<{
    workflowId: string;
    phase: string;
    stepNumber: number;
    name: string;
    description?: string;
    actorType?: string;
    actorName?: string;
    durationMinutes?: number;
    systems?: string[];
    painPoints?: string[];
    isBottleneck?: boolean;
    isDecisionPoint?: boolean;
    isAIEnabled?: boolean;
    isHumanInTheLoop?: boolean;
    aiCapabilities?: string[];
    automationLevel?: string;
    dataSources?: string[];
    dataOutputs?: string[];
  }>,
) {
  if (steps.length === 0) return [];
  const values = steps.map((s) => ({
    workflowId: s.workflowId,
    phase: s.phase,
    stepNumber: s.stepNumber,
    name: s.name,
    description: s.description || "",
    actorType: s.actorType || "human",
    actorName: s.actorName || "",
    durationMinutes: s.durationMinutes || 60,
    systems: s.systems || [],
    painPoints: s.painPoints || [],
    isBottleneck: s.isBottleneck || false,
    isDecisionPoint: s.isDecisionPoint || false,
    isAIEnabled: s.isAIEnabled || false,
    isHumanInTheLoop: s.isHumanInTheLoop || false,
    aiCapabilities: s.aiCapabilities || [],
    automationLevel: s.automationLevel || "manual",
    dataSources: s.dataSources || [],
    dataOutputs: s.dataOutputs || [],
  }));
  return db.insert(workflowSteps).values(values).returning();
}

// ─── Share Links ─────────────────────────────────────────────────────────────

export async function createShareLink(projectId: string, shareCode: string) {
  const [link] = await db
    .insert(shareLinks)
    .values({ projectId, shareCode })
    .returning();
  return link;
}

export async function getShareLink(code: string) {
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.shareCode, code));
  return link || null;
}

// ─── AI Conversations ────────────────────────────────────────────────────────

export async function getConversation(
  projectId: string,
  section: string,
  workflowId?: string,
) {
  const conditions = [
    eq(aiConversations.projectId, projectId),
    eq(aiConversations.section, section),
  ];
  if (workflowId) {
    conditions.push(eq(aiConversations.workflowId, workflowId));
  }
  const [conv] = await db
    .select()
    .from(aiConversations)
    .where(and(...conditions));
  return conv || null;
}

export async function upsertConversation(data: {
  projectId: string;
  section: string;
  workflowId?: string;
  messages: Array<{ role: string; content: string }>;
}) {
  const existing = await getConversation(
    data.projectId,
    data.section,
    data.workflowId,
  );
  if (existing) {
    const [updated] = await db
      .update(aiConversations)
      .set({ messages: data.messages })
      .where(eq(aiConversations.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(aiConversations)
    .values({
      projectId: data.projectId,
      workflowId: data.workflowId || null,
      section: data.section,
      messages: data.messages,
    })
    .returning();
  return created;
}
