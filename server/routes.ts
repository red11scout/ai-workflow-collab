import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { nanoid } from "nanoid";
import Anthropic from "@anthropic-ai/sdk";
import * as storage from "./storage";
import { parseImportedJson } from "./json-parser";
import {
  SYSTEM_PROMPTS,
  buildCurrentPrompt,
  buildAIWorkflowPrompt,
} from "./ai-prompts";
import { log } from "./log";

function getOwnerToken(req: Request): string {
  const token = req.headers["x-owner-token"] as string;
  if (!token) throw { status: 401, message: "Missing owner token" };
  return token;
}

export async function registerRoutes(server: Server, app: Express) {
  // ─── Projects ────────────────────────────────────────────────────────────

  app.get("/api/projects", async (req: Request, res: Response) => {
    const ownerToken = getOwnerToken(req);
    const projects = await storage.getProjectsByOwner(ownerToken);
    res.json(projects);
  });

  app.post("/api/projects", async (req: Request, res: Response) => {
    const ownerToken = getOwnerToken(req);
    const { name, companyName, industry, description } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });

    const project = await storage.createProject({
      ownerToken,
      name,
      companyName,
      industry,
      description,
    });
    res.json(project);
  });

  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    const project = await storage.getProjectWithWorkflows(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });

  app.put("/api/projects/:id", async (req: Request, res: Response) => {
    const updated = await storage.updateProject(req.params.id, req.body);
    if (!updated)
      return res.status(404).json({ message: "Project not found" });
    res.json(updated);
  });

  app.delete("/api/projects/:id", async (req: Request, res: Response) => {
    await storage.deleteProject(req.params.id);
    res.json({ success: true });
  });

  // ─── Import ──────────────────────────────────────────────────────────────

  app.post(
    "/api/projects/:id/import",
    async (req: Request, res: Response) => {
      const { rawJson } = req.body;
      if (!rawJson)
        return res.status(400).json({ message: "rawJson is required" });

      const parsed = parseImportedJson(rawJson);

      await storage.updateProject(req.params.id, {
        rawImport: rawJson,
        companyName: parsed.companyName,
        industry: parsed.industry,
        description: parsed.description,
        importedUseCases: parsed.useCases,
        importedFriction: parsed.frictionPoints,
        importedBenefits: parsed.benefits,
      });

      res.json({
        success: true,
        companyName: parsed.companyName,
        industry: parsed.industry,
        useCaseCount: parsed.useCases.length,
        frictionCount: parsed.frictionPoints.length,
        benefitCount: parsed.benefits.length,
        warnings: parsed.warnings,
        importedUseCases: parsed.useCases,
        importedFriction: parsed.frictionPoints,
        importedBenefits: parsed.benefits,
      });
    },
  );

  app.put(
    "/api/projects/:id/select-usecases",
    async (req: Request, res: Response) => {
      const { useCaseIds, useCases } = req.body;

      // Support both import flow (useCaseIds) and manual flow (useCases)
      const isManualFlow = Array.isArray(useCases);
      const isImportFlow = Array.isArray(useCaseIds);
      if (!isManualFlow && !isImportFlow)
        return res.status(400).json({ message: "useCaseIds or useCases array required" });

      const project = await storage.getProject(req.params.id);
      if (!project)
        return res.status(404).json({ message: "Project not found" });

      // Delete existing workflows for this project
      const existingWfs = await storage.getWorkflowsForProject(req.params.id);
      for (const wf of existingWfs) {
        await storage.deleteWorkflow(wf.id);
      }

      const createdWorkflows = [];

      if (isManualFlow) {
        // Manual creation: useCases are full objects from the form
        for (let i = 0; i < useCases.length; i++) {
          const uc = useCases[i];
          const ucId = uc.id || `manual_${i + 1}`;

          const wf = await storage.createWorkflow({
            projectId: req.params.id,
            useCaseId: ucId,
            useCaseName: uc.name,
            useCaseDescription: uc.description || "",
            businessFunction: uc.businessFunction || uc.function || "",
            targetFriction: uc.targetFriction || "",
            desiredOutcomes: uc.desiredOutcomes || [],
            sortOrder: i,
          });
          createdWorkflows.push(wf);
        }

        await storage.updateProject(req.params.id, {
          selectedUseCaseIds: useCases.map(
            (uc: any, i: number) => uc.id || `manual_${i + 1}`,
          ),
        });
      } else {
        // Import flow: look up use cases by ID from imported data
        const importedUseCases =
          (project.importedUseCases as any[]) || [];
        const importedFriction =
          (project.importedFriction as any[]) || [];

        for (let i = 0; i < useCaseIds.length; i++) {
          const ucId = useCaseIds[i];
          const uc = importedUseCases.find((u: any) => u.id === ucId);
          if (!uc) continue;

          const friction = importedFriction.find(
            (f: any) => f.id === uc.targetFrictionId,
          );

          const wf = await storage.createWorkflow({
            projectId: req.params.id,
            useCaseId: ucId,
            useCaseName: uc.name,
            useCaseDescription: uc.description,
            businessFunction: uc.function,
            subFunction: uc.subFunction,
            strategicTheme: uc.strategicTheme,
            targetFriction: uc.targetFriction || friction?.frictionPoint || "",
            agenticPattern: uc.agenticPattern,
            patternRationale: uc.patternRationale,
            aiPrimitives: uc.aiPrimitives,
            desiredOutcomes: uc.desiredOutcomes,
            dataTypes: uc.dataTypes,
            integrations: uc.integrations,
            frictionAnnualCost: friction
              ? parseInt(String(friction.estimatedAnnualCost).replace(/[,$]/g, "")) || 0
              : 0,
            frictionAnnualHours: friction?.annualHours || 0,
            sortOrder: i,
          });
          createdWorkflows.push(wf);
        }

        await storage.updateProject(req.params.id, {
          selectedUseCaseIds: useCaseIds,
        });
      }

      res.json({ success: true, workflows: createdWorkflows });
    },
  );

  // ─── Workflows ───────────────────────────────────────────────────────────

  app.get(
    "/api/projects/:id/workflows",
    async (req: Request, res: Response) => {
      const wfs = await storage.getWorkflowsForProject(req.params.id);
      res.json(wfs);
    },
  );

  app.get("/api/workflows/:wfId", async (req: Request, res: Response) => {
    const wf = await storage.getWorkflowWithSteps(req.params.wfId);
    if (!wf) return res.status(404).json({ message: "Workflow not found" });
    res.json(wf);
  });

  app.put("/api/workflows/:wfId", async (req: Request, res: Response) => {
    const updated = await storage.updateWorkflow(req.params.wfId, req.body);
    if (!updated)
      return res.status(404).json({ message: "Workflow not found" });
    res.json(updated);
  });

  app.delete("/api/workflows/:wfId", async (req: Request, res: Response) => {
    await storage.deleteWorkflow(req.params.wfId);
    res.json({ success: true });
  });

  // ─── Workflow Steps ──────────────────────────────────────────────────────

  app.get(
    "/api/workflows/:wfId/steps",
    async (req: Request, res: Response) => {
      const steps = await storage.getStepsForWorkflow(req.params.wfId);
      res.json(steps);
    },
  );

  app.post(
    "/api/workflows/:wfId/steps",
    async (req: Request, res: Response) => {
      const { phase, ...stepData } = req.body;
      if (!phase)
        return res.status(400).json({ message: "phase is required" });

      // Auto-assign step number
      const existing = await storage.getStepsForWorkflow(req.params.wfId);
      const phaseSteps = phase === "current" ? existing.current : existing.ai;
      const maxStep = phaseSteps.reduce(
        (max, s) => Math.max(max, s.stepNumber),
        0,
      );

      const step = await storage.createStep({
        workflowId: req.params.wfId,
        phase,
        stepNumber: maxStep + 1,
        name: stepData.name || "New Step",
        ...stepData,
      });
      res.json(step);
    },
  );

  app.put("/api/steps/:stepId", async (req: Request, res: Response) => {
    const updated = await storage.updateStep(req.params.stepId, req.body);
    if (!updated) return res.status(404).json({ message: "Step not found" });
    res.json(updated);
  });

  app.delete("/api/steps/:stepId", async (req: Request, res: Response) => {
    await storage.deleteStep(req.params.stepId);
    res.json({ success: true });
  });

  app.put(
    "/api/workflows/:wfId/reorder",
    async (req: Request, res: Response) => {
      const { phase, stepIds } = req.body;
      if (!phase || !Array.isArray(stepIds))
        return res
          .status(400)
          .json({ message: "phase and stepIds required" });

      for (let i = 0; i < stepIds.length; i++) {
        await storage.updateStep(stepIds[i], { stepNumber: i + 1 });
      }

      const steps = await storage.getStepsForWorkflow(req.params.wfId);
      res.json(phase === "current" ? steps.current : steps.ai);
    },
  );

  app.put(
    "/api/workflows/:wfId/steps/batch",
    async (req: Request, res: Response) => {
      const { updates } = req.body;
      if (!Array.isArray(updates))
        return res.status(400).json({ message: "updates array required" });

      const results = [];
      for (const { id, changes } of updates) {
        const updated = await storage.updateStep(id, changes);
        if (updated) results.push(updated);
      }
      res.json(results);
    },
  );

  // ─── Navigation ──────────────────────────────────────────────────────────

  app.put(
    "/api/projects/:id/navigation",
    async (req: Request, res: Response) => {
      const { currentStep, completedSteps } = req.body;
      const data: Record<string, any> = {};
      if (currentStep !== undefined) data.currentStep = currentStep;
      if (completedSteps !== undefined) data.completedSteps = completedSteps;

      const updated = await storage.updateProject(req.params.id, data);
      res.json(updated);
    },
  );

  // ─── AI Generation ───────────────────────────────────────────────────────

  const anthropic = new Anthropic();

  app.post(
    "/api/ai/generate-current",
    async (req: Request, res: Response) => {
      try {
        const { workflowId } = req.body;

        // Look up workflow + project for context
        const wf = workflowId ? await storage.getWorkflow(workflowId) : null;
        let project: any = null;
        if (wf) {
          project = await storage.getProject(wf.projectId);
        }

        const promptParams = {
          useCaseName: wf?.useCaseName || req.body.useCaseName || "",
          useCaseDescription: wf?.useCaseDescription || req.body.useCaseDescription || "",
          businessFunction: wf?.businessFunction || req.body.businessFunction || "",
          subFunction: wf?.subFunction || req.body.subFunction || "",
          targetFriction: wf?.targetFriction || req.body.targetFriction || "",
          frictionType: req.body.frictionType || "",
          frictionAnnualHours: wf?.frictionAnnualHours || req.body.frictionAnnualHours || 0,
          industry: project?.industry || req.body.industry || "",
          aiPrimitives: (wf?.aiPrimitives as string[]) || req.body.aiPrimitives || [],
        };

        const userPrompt = buildCurrentPrompt(promptParams);

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `${SYSTEM_PROMPTS.generateCurrent}\n\n${userPrompt}`,
            },
          ],
        });

        const text =
          message.content[0].type === "text" ? message.content[0].text : "";

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          return res
            .status(500)
            .json({ message: "AI did not return valid JSON" });
        }

        const steps = JSON.parse(jsonMatch[0]);

        // Save steps to DB if workflowId provided
        if (workflowId) {
          await storage.deleteStepsByWorkflowAndPhase(workflowId, "current");
          await storage.batchCreateSteps(
            steps.map((s: any, i: number) => ({
              workflowId,
              phase: "current",
              stepNumber: s.stepNumber || i + 1,
              name: s.name,
              description: s.description || "",
              actorType: s.actorType || "human",
              actorName: s.actorName || "",
              durationMinutes: s.durationMinutes || 15,
              systems: s.systems || [],
              painPoints: s.painPoints || [],
              isBottleneck: s.isBottleneck || false,
              isDecisionPoint: s.isDecisionPoint || false,
            })),
          );
        }

        res.json({ success: true, steps });
      } catch (error: any) {
        log(`AI generate-current error: ${error.message}`);
        res.status(500).json({ message: error.message });
      }
    },
  );

  app.post(
    "/api/ai/generate-ai-workflow",
    async (req: Request, res: Response) => {
      try {
        const { workflowId, ...params } = req.body;
        const userPrompt = buildAIWorkflowPrompt(params);

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `${SYSTEM_PROMPTS.generateAI}\n\n${userPrompt}`,
            },
          ],
        });

        const text =
          message.content[0].type === "text" ? message.content[0].text : "";

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          return res
            .status(500)
            .json({ message: "AI did not return valid JSON" });
        }

        const aiSteps = JSON.parse(jsonMatch[0]);

        // Clear existing AI steps and save new ones
        await storage.deleteStepsByWorkflowAndPhase(workflowId, "ai");
        const savedSteps = await storage.batchCreateSteps(
          aiSteps.map((s: any, i: number) => ({
            workflowId,
            phase: "ai",
            stepNumber: s.stepNumber || i + 1,
            name: s.name,
            description: s.description || "",
            actorType: s.actorType || "ai_agent",
            actorName: s.actorName || "",
            durationMinutes: s.durationMinutes || 5,
            systems: s.systems || [],
            painPoints: s.painPoints || [],
            isBottleneck: s.isBottleneck || false,
            isDecisionPoint: s.isDecisionPoint || false,
            isAIEnabled: s.isAIEnabled !== false,
            isHumanInTheLoop: s.isHumanInTheLoop || false,
            aiCapabilities: s.aiCapabilities || [],
            automationLevel: s.automationLevel || "full",
            dataSources: s.dataSources || [],
            dataOutputs: s.dataOutputs || [],
          })),
        );

        // Mark workflow as AI-generated
        await storage.updateWorkflow(workflowId, {
          aiGenerated: true,
          aiGeneratedAt: new Date(),
        });

        res.json({ success: true, steps: savedSteps });
      } catch (error: any) {
        log(`AI generate-ai-workflow error: ${error.message}`);
        res.status(500).json({ message: error.message });
      }
    },
  );

  app.post("/api/ai/generate-all", async (req: Request, res: Response) => {
    try {
      const { projectId } = req.body;
      const project = await storage.getProjectWithWorkflows(projectId);
      if (!project)
        return res.status(404).json({ message: "Project not found" });

      const results = [];
      for (const wf of project.workflows) {
        if (wf.currentSteps.length === 0) continue;

        // Find friction info
        const friction = (project.importedFriction || []).find(
          (f: any) => f.id === wf.useCaseId?.replace("UC", "FP"),
        );

        const params = {
          useCaseName: wf.useCaseName,
          useCaseDescription: wf.useCaseDescription,
          businessFunction: wf.businessFunction,
          subFunction: wf.subFunction,
          industry: project.industry || "",
          agenticPattern: wf.agenticPattern,
          aiPrimitives: wf.aiPrimitives,
          currentSteps: wf.currentSteps.map((s: any) => ({
            stepNumber: s.stepNumber,
            name: s.name,
            actorName: s.actorName,
            durationMinutes: s.durationMinutes,
            description: s.description,
            painPoints: s.painPoints,
          })),
          frictionPoints: [wf.targetFriction].filter(Boolean),
          desiredOutcomes: wf.desiredOutcomes,
        };

        const userPrompt = buildAIWorkflowPrompt(params);

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `${SYSTEM_PROMPTS.generateAI}\n\n${userPrompt}`,
            },
          ],
        });

        const text =
          message.content[0].type === "text"
            ? message.content[0].text
            : "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          const aiSteps = JSON.parse(jsonMatch[0]);
          await storage.deleteStepsByWorkflowAndPhase(wf.id, "ai");
          const saved = await storage.batchCreateSteps(
            aiSteps.map((s: any, i: number) => ({
              workflowId: wf.id,
              phase: "ai",
              stepNumber: s.stepNumber || i + 1,
              name: s.name,
              description: s.description || "",
              actorType: s.actorType || "ai_agent",
              actorName: s.actorName || "",
              durationMinutes: s.durationMinutes || 5,
              systems: s.systems || [],
              painPoints: s.painPoints || [],
              isBottleneck: s.isBottleneck || false,
              isDecisionPoint: s.isDecisionPoint || false,
              isAIEnabled: s.isAIEnabled !== false,
              isHumanInTheLoop: s.isHumanInTheLoop || false,
              aiCapabilities: s.aiCapabilities || [],
              automationLevel: s.automationLevel || "full",
              dataSources: s.dataSources || [],
              dataOutputs: s.dataOutputs || [],
            })),
          );

          await storage.updateWorkflow(wf.id, {
            aiGenerated: true,
            aiGeneratedAt: new Date(),
          });

          results.push({ workflowId: wf.id, stepCount: saved.length });
        }

        // Rate limit between calls
        await new Promise((r) => setTimeout(r, 500));
      }

      res.json({ success: true, count: results.length, results });
    } catch (error: any) {
      log(`AI generate-all error: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // ─── AI Assistant (SSE Streaming) ────────────────────────────────────────

  app.post("/api/ai/assist", async (req: Request, res: Response) => {
    const { section, context, userPrompt } = req.body;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const systemPrompt =
        SYSTEM_PROMPTS.assistSections[section] ||
        SYSTEM_PROMPTS.assistSections.mapping;

      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          ...(context
            ? [{ role: "user" as const, content: context }]
            : []),
          { role: "user" as const, content: userPrompt },
        ],
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      res.write(
        `data: ${JSON.stringify({ error: error.message })}\n\n`,
      );
      res.end();
    }
  });

  // ─── Share Links ─────────────────────────────────────────────────────────

  app.post(
    "/api/projects/:id/share",
    async (req: Request, res: Response) => {
      const shareCode = nanoid(10);
      const link = await storage.createShareLink(req.params.id, shareCode);
      res.json({ shareCode: link.shareCode, url: `/shared/${link.shareCode}` });
    },
  );

  app.get("/api/shared/:code", async (req: Request, res: Response) => {
    const link = await storage.getShareLink(req.params.code);
    if (!link)
      return res.status(404).json({ message: "Share link not found" });

    const project = await storage.getProjectWithWorkflows(link.projectId);
    if (!project)
      return res.status(404).json({ message: "Project not found" });

    // Strip owner token from shared data
    const { ownerToken, rawImport, ...safeProject } = project;
    res.json(safeProject);
  });

  // ─── Export ──────────────────────────────────────────────────────────────

  app.post(
    "/api/projects/:id/export/json",
    async (req: Request, res: Response) => {
      const project = await storage.getProjectWithWorkflows(req.params.id);
      if (!project)
        return res.status(404).json({ message: "Project not found" });

      const { ownerToken, ...safeProject } = project;
      res.json(safeProject);
    },
  );

  app.post(
    "/api/projects/:id/export/excel",
    async (req: Request, res: Response) => {
      const project = await storage.getProjectWithWorkflows(req.params.id);
      if (!project)
        return res.status(404).json({ message: "Project not found" });

      const { generateExcelBuffer } = await import("./export-service");
      const buffer = await generateExcelBuffer(project, project.workflows);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${project.companyName || "project"}-workflow-analysis.xlsx"`,
      );
      res.send(buffer);
    },
  );

  app.post(
    "/api/projects/:id/export/html",
    async (req: Request, res: Response) => {
      const project = await storage.getProjectWithWorkflows(req.params.id);
      if (!project)
        return res.status(404).json({ message: "Project not found" });

      const { generateHtmlReport } = await import("./export-service");
      const html = generateHtmlReport(project, project.workflows);
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    },
  );
}
