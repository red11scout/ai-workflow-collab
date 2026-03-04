import { useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatDuration } from "@/lib/utils";
import Layout from "@/components/Layout";
import WorkflowSelector from "@/components/workflow/WorkflowSelector";
import DraggableStepList from "@/components/workflow/DraggableStepList";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Sparkles,
  Clock,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import type {
  WorkflowWithSteps,
  ProjectWithWorkflows,
  WorkflowStepData,
} from "@shared/types";

export default function CurrentMapping() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);

  // ─── Queries ──────────────────────────────────────────────────────

  const { data: project } = useQuery<ProjectWithWorkflows>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: workflows = [], isLoading } = useQuery<WorkflowWithSteps[]>({
    queryKey: ["/api/projects", projectId, "workflows"],
    enabled: !!projectId,
  });

  // Set active workflow on first load
  const activeWf =
    workflows.find((wf) => wf.id === activeWorkflowId) ?? workflows[0] ?? null;
  if (activeWf && activeWorkflowId !== activeWf.id) {
    setActiveWorkflowId(activeWf.id);
  }

  // ─── Mutations ────────────────────────────────────────────────────

  const addStepMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const newStep = {
        phase: "current" as const,
        stepNumber: (activeWf?.currentSteps.length ?? 0) + 1,
        name: "",
        description: "",
        actorType: "human" as const,
        actorName: "",
        durationMinutes: 15,
        systems: [],
        painPoints: [],
        isBottleneck: false,
        isDecisionPoint: false,
        isAIEnabled: false,
        isHumanInTheLoop: false,
        aiCapabilities: [],
        automationLevel: "manual" as const,
        dataSources: [],
        dataOutputs: [],
      };
      const res = await apiRequest(
        "POST",
        `/api/workflows/${workflowId}/steps`,
        newStep,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "workflows"],
      });
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: async ({
      stepId,
      data,
    }: {
      stepId: string;
      data: Partial<WorkflowStepData>;
    }) => {
      await apiRequest("PUT", `/api/steps/${stepId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "workflows"],
      });
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      await apiRequest("DELETE", `/api/steps/${stepId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "workflows"],
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({
      workflowId,
      stepIds,
    }: {
      workflowId: string;
      stepIds: string[];
    }) => {
      await apiRequest("PUT", `/api/workflows/${workflowId}/reorder`, {
        phase: "current",
        stepIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "workflows"],
      });
    },
  });

  const aiDraftMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const res = await apiRequest("POST", `/api/ai/generate-current`, {
        workflowId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "workflows"],
      });
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────

  const handleUpdateStep = useCallback(
    (stepId: string, data: Partial<WorkflowStepData>) => {
      updateStepMutation.mutate({ stepId, data });
    },
    [updateStepMutation],
  );

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      deleteStepMutation.mutate(stepId);
    },
    [deleteStepMutation],
  );

  const handleReorder = useCallback(
    (stepIds: string[]) => {
      if (!activeWf) return;
      reorderMutation.mutate({ workflowId: activeWf.id, stepIds });
    },
    [activeWf, reorderMutation],
  );

  // ─── Derived state ───────────────────────────────────────────────

  const currentSteps = activeWf?.currentSteps ?? [];
  const totalDuration = currentSteps.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );
  const bottleneckCount = currentSteps.filter((s) => s.isBottleneck).length;
  const painPointCount = currentSteps.reduce(
    (sum, s) => sum + s.painPoints.length,
    0,
  );

  // Check if all workflows have at least 2 current steps
  const allReady = workflows.length > 0 && workflows.every((wf) => wf.currentSteps.length >= 2);

  // ─── Loading state ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Layout projectId={projectId} currentStep={1} companyName={project?.companyName}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (workflows.length === 0) {
    return (
      <Layout projectId={projectId} currentStep={1} companyName={project?.companyName}>
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Map Current Workflows
            </h1>
            <p className="text-muted-foreground mt-1">
              No workflows found. Go back and select use cases first.
            </p>
          </div>
          <button
            onClick={() => navigate(`/project/${projectId}/import`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Import
          </button>
        </div>
      </Layout>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <Layout projectId={projectId} currentStep={1} companyName={project?.companyName}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Map Current Workflows
          </h1>
          <p className="text-muted-foreground mt-1">
            Define how your processes work today. Step by step.
          </p>
        </div>

        {/* Workflow selector */}
        {workflows.length > 1 && (
          <WorkflowSelector
            workflows={workflows}
            activeId={activeWf?.id ?? ""}
            onSelect={setActiveWorkflowId}
          />
        )}

        {/* Active workflow header */}
        {activeWf && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground truncate">
                  {activeWf.useCaseName}
                </h2>
                {activeWf.useCaseDescription && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                    {activeWf.useCaseDescription}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {activeWf.businessFunction && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-[#001278]/5 text-[#001278] border-[#001278]/20"
                    >
                      {activeWf.businessFunction}
                    </Badge>
                  )}
                  {activeWf.strategicTheme && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-[#36bf78]/5 text-[#36bf78] border-[#36bf78]/20"
                    >
                      {activeWf.strategicTheme}
                    </Badge>
                  )}
                  {activeWf.targetFriction && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-500/5 text-amber-600 border-amber-500/20"
                    >
                      {activeWf.targetFriction}
                    </Badge>
                  )}
                </div>
              </div>

              {/* AI Draft button */}
              <button
                onClick={() => aiDraftMutation.mutate(activeWf.id)}
                disabled={aiDraftMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#001278] to-[#02a2fd] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
              >
                {aiDraftMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {aiDraftMutation.isPending ? "Drafting..." : "AI Draft"}
              </button>
            </div>

            {aiDraftMutation.isError && (
              <p className="text-xs text-destructive">
                {(aiDraftMutation.error as Error).message}
              </p>
            )}
          </div>
        )}

        {/* Draggable step list */}
        {activeWf && (
          <DraggableStepList
            steps={currentSteps}
            workflowId={activeWf.id}
            onReorder={handleReorder}
            onUpdateStep={handleUpdateStep}
            onDeleteStep={handleDeleteStep}
            phase="current"
          />
        )}

        {/* Add Step button */}
        {activeWf && (
          <button
            onClick={() => addStepMutation.mutate(activeWf.id)}
            disabled={addStepMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-[#02a2fd]/40 hover:bg-muted/30 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Step
          </button>
        )}

        {/* Bottom summary bar */}
        {activeWf && currentSteps.length > 0 && (
          <div className="flex items-center gap-6 rounded-xl border border-border bg-card px-5 py-3 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="font-semibold text-foreground">
                {currentSteps.length}
              </span>
              step{currentSteps.length !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground">
                {formatDuration(totalDuration)}
              </span>
              total
            </div>
            {bottleneckCount > 0 && (
              <div className="flex items-center gap-1.5 text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="font-semibold">{bottleneckCount}</span>
                bottleneck{bottleneckCount !== 1 ? "s" : ""}
              </div>
            )}
            {painPointCount > 0 && (
              <div className="flex items-center gap-1.5 text-red-500">
                <span className="font-semibold">{painPointCount}</span>
                pain point{painPointCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}

        {/* Navigation bar */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <button
            onClick={() => navigate(`/project/${projectId}/import`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            {!allReady && (
              <p className="text-xs text-muted-foreground">
                Each workflow needs at least 2 steps.
              </p>
            )}
            <button
              onClick={() => navigate(`/project/${projectId}/generate`)}
              disabled={!allReady}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#001278] text-white font-medium hover:bg-[#001278]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generate AI Workflows
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
