import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import WorkflowSelector from "@/components/workflow/WorkflowSelector";
import DraggableStepList from "@/components/workflow/DraggableStepList";
import SortableAIStepCard from "@/components/workflow/SortableAIStepCard";
import MetricsDashboard from "@/components/workflow/MetricsDashboard";
import FormulaInspector from "@/components/workflow/FormulaInspector";
import { FormulaProvider, useFormula } from "@/contexts/FormulaContext";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Save,
  CheckCircle2,
  Search,
  Clock,
  Layers,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import { DEFAULT_PARAMS } from "@shared/constants";
import type {
  WorkflowWithSteps,
  WorkflowStepData,
  ProjectWithWorkflows,
} from "@shared/types";

// ─── Inner page (inside FormulaProvider) ─────────────────────────────────────

function ReviewRefineInner() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const formula = useFormula();

  const [activeWorkflowId, setActiveWorkflowId] = useState<string>("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [autoSaveTs, setAutoSaveTs] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Queries ────────────────────────────────────────────────

  const { data: project } = useQuery<ProjectWithWorkflows>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId,
  });

  const {
    data: workflows = [],
    isLoading,
    isError,
  } = useQuery<WorkflowWithSteps[]>({
    queryKey: ["/api/projects", projectId, "workflows"],
    enabled: !!projectId,
  });

  // Set active workflow on load
  const activeId = activeWorkflowId || workflows[0]?.id || "";
  const activeWorkflow = workflows.find((wf) => wf.id === activeId);

  // ─── Rebuild HyperFormula sheets when workflows load ────────

  useEffect(() => {
    if (workflows.length === 0) return;

    for (const wf of workflows) {
      const currentDurations = (wf.currentSteps || [])
        .sort((a, b) => a.stepNumber - b.stepNumber)
        .map((s) => s.durationMinutes);
      const aiDurations = (wf.aiSteps || [])
        .sort((a, b) => a.stepNumber - b.stepNumber)
        .map((s) => s.durationMinutes);

      const aiSteps = wf.aiSteps || [];
      const aiEnabled = aiSteps.filter((s) => s.isAIEnabled).length;
      const automationRate =
        aiSteps.length > 0 ? aiEnabled / aiSteps.length : 0;
      const hitlCount = aiSteps.filter((s) => s.isHumanInTheLoop).length;

      const hourlyRate = wf.hourlyRateOverride || project?.avgHourlyRate || DEFAULT_PARAMS.avgHourlyRate;
      const adoptionRate = (project?.adoptionRatePct ?? DEFAULT_PARAMS.adoptionRatePct) / 100;
      const dataMaturity = (project?.dataMaturityPct ?? DEFAULT_PARAMS.dataMaturityPct) / 100;

      formula.rebuildWorkflowSheet(
        wf.id,
        {
          hourlyRate,
          adoptionRate,
          dataMaturity,
          annualRuns: DEFAULT_PARAMS.annualRunsPerWorkflow,
          implementCost: DEFAULT_PARAMS.implementationCost,
        },
        currentDurations,
        aiDurations,
        automationRate,
        hitlCount,
      );
    }
  }, [workflows, project, formula.rebuildWorkflowSheet]);

  // ─── Mutations ──────────────────────────────────────────────

  const invalidateWorkflows = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["/api/projects", projectId, "workflows"],
    });
  }, [queryClient, projectId]);

  // Update step
  const updateStepMutation = useMutation({
    mutationFn: async ({
      stepId,
      data,
    }: {
      stepId: string;
      data: Partial<WorkflowStepData>;
    }) => {
      setSaving(true);
      await apiRequest("PUT", `/api/steps/${stepId}`, data);
    },
    onSuccess: () => {
      invalidateWorkflows();
      setSaving(false);
      setAutoSaveTs(new Date());
    },
    onError: (err: Error) => {
      setSaving(false);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err.message,
      });
    },
  });

  // Delete step
  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      await apiRequest("DELETE", `/api/steps/${stepId}`);
    },
    onSuccess: () => {
      invalidateWorkflows();
    },
  });

  // Reorder steps
  const reorderMutation = useMutation({
    mutationFn: async ({
      workflowId,
      phase,
      stepIds,
    }: {
      workflowId: string;
      phase: "current" | "ai";
      stepIds: string[];
    }) => {
      await apiRequest("PUT", `/api/workflows/${workflowId}/reorder`, {
        phase,
        stepIds,
      });
    },
    onSuccess: () => {
      invalidateWorkflows();
    },
  });

  // Add step
  const addStepMutation = useMutation({
    mutationFn: async ({
      workflowId,
      phase,
    }: {
      workflowId: string;
      phase: "current" | "ai";
    }) => {
      const steps =
        phase === "current"
          ? activeWorkflow?.currentSteps || []
          : activeWorkflow?.aiSteps || [];

      const newStep = {
        phase,
        stepNumber: steps.length + 1,
        name: "",
        description: "",
        actorType: phase === "ai" ? ("ai_agent" as const) : ("human" as const),
        actorName: "",
        durationMinutes: phase === "ai" ? 5 : 15,
        systems: [],
        painPoints: [],
        isBottleneck: false,
        isDecisionPoint: false,
        isAIEnabled: phase === "ai",
        isHumanInTheLoop: false,
        aiCapabilities: [],
        automationLevel: phase === "ai" ? ("assisted" as const) : ("manual" as const),
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
      invalidateWorkflows();
    },
  });

  // ─── Handlers ──────────────────────────────────────────────

  const handleUpdateStep = useCallback(
    (stepId: string, data: Partial<WorkflowStepData>) => {
      updateStepMutation.mutate({ stepId, data });

      // Live-update HyperFormula when duration changes
      if (data.durationMinutes != null && activeWorkflow) {
        const currentStep = activeWorkflow.currentSteps.find(
          (s) => s.id === stepId,
        );
        const aiStep = activeWorkflow.aiSteps.find((s) => s.id === stepId);
        const step = currentStep || aiStep;
        if (!step) return;

        const phase: "current" | "ai" = currentStep ? "current" : "ai";
        const stepsForPhase =
          phase === "current"
            ? activeWorkflow.currentSteps
            : activeWorkflow.aiSteps;
        const sorted = [...stepsForPhase].sort(
          (a, b) => a.stepNumber - b.stepNumber,
        );
        const idx = sorted.findIndex((s) => s.id === stepId);

        if (idx !== -1) {
          formula.updateStepDuration(
            activeWorkflow.id,
            phase,
            idx,
            data.durationMinutes,
          );
        }
      }
    },
    [updateStepMutation, activeWorkflow, formula],
  );

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      deleteStepMutation.mutate(stepId);
      // Sheet will rebuild after query invalidation triggers re-render
    },
    [deleteStepMutation],
  );

  const handleReorderCurrent = useCallback(
    (stepIds: string[]) => {
      if (!activeWorkflow) return;
      reorderMutation.mutate({
        workflowId: activeWorkflow.id,
        phase: "current",
        stepIds,
      });
    },
    [activeWorkflow, reorderMutation],
  );

  const handleReorderAI = useCallback(
    (stepIds: string[]) => {
      if (!activeWorkflow) return;
      reorderMutation.mutate({
        workflowId: activeWorkflow.id,
        phase: "ai",
        stepIds,
      });
    },
    [activeWorkflow, reorderMutation],
  );

  const handleAddStep = useCallback(
    (phase: "current" | "ai") => {
      if (!activeWorkflow) return;
      addStepMutation.mutate({ workflowId: activeWorkflow.id, phase });
    },
    [activeWorkflow, addStepMutation],
  );

  // ─── Derived state ─────────────────────────────────────────

  const currentSteps = useMemo(
    () =>
      [...(activeWorkflow?.currentSteps || [])].sort(
        (a, b) => a.stepNumber - b.stepNumber,
      ),
    [activeWorkflow],
  );

  const aiSteps = useMemo(
    () =>
      [...(activeWorkflow?.aiSteps || [])].sort(
        (a, b) => a.stepNumber - b.stepNumber,
      ),
    [activeWorkflow],
  );

  const currentTotal = currentSteps.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );
  const aiTotal = aiSteps.reduce((sum, s) => sum + s.durationMinutes, 0);

  const hitlStepIds = useMemo(
    () => new Set(aiSteps.filter((s) => s.isHumanInTheLoop).map((s) => s.id)),
    [aiSteps],
  );
  const hitlCount = hitlStepIds.size;

  // ─── Loading & error states ────────────────────────────────

  if (isLoading) {
    return (
      <Layout projectId={projectId} currentStep={3} companyName={project?.companyName}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#02a2fd]" />
          <span className="ml-2 text-muted-foreground">Loading workflows...</span>
        </div>
      </Layout>
    );
  }

  if (isError || workflows.length === 0) {
    return (
      <Layout projectId={projectId} currentStep={3} companyName={project?.companyName}>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Review &amp; Refine
          </h1>
          <p className="text-muted-foreground">
            No workflows found. Generate AI workflows first.
          </p>
        </div>
        <div className="mt-8">
          <button
            onClick={() => navigate(`/project/${projectId}/generate`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#001278] text-white font-medium hover:bg-[#001278]/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to AI Generation
          </button>
        </div>
      </Layout>
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <Layout projectId={projectId} currentStep={3} companyName={project?.companyName}>
      <div className="space-y-6 pb-36">
        {/* ─── Header with auto-save indicator ──────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              Review &amp; Refine
            </h1>
            <p className="text-muted-foreground">
              Fine-tune every step. Watch the numbers move in real time.
            </p>
          </div>

          {/* Auto-save indicator */}
          <div className="flex items-center gap-2 shrink-0">
            {saving ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Save className="h-3.5 w-3.5 animate-pulse" />
                Saving...
              </span>
            ) : autoSaveTs ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#36bf78]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </span>
            ) : null}
          </div>
        </div>

        {/* ─── Workflow Tabs ────────────────────────────────── */}
        {workflows.length > 1 && (
          <WorkflowSelector
            workflows={workflows}
            activeId={activeId}
            onSelect={setActiveWorkflowId}
          />
        )}

        {/* ─── Active Workflow Metadata ─────────────────────── */}
        {activeWorkflow && (
          <div className="flex flex-wrap items-center gap-2">
            {activeWorkflow.businessFunction && (
              <Badge
                variant="outline"
                className="text-xs bg-[#001278]/5 text-[#001278] border-[#001278]/20"
              >
                {activeWorkflow.businessFunction}
              </Badge>
            )}
            {activeWorkflow.agenticPattern && (
              <Badge
                variant="outline"
                className="text-xs bg-[#02a2fd]/5 text-[#02a2fd] border-[#02a2fd]/20"
              >
                {activeWorkflow.agenticPattern}
              </Badge>
            )}
            {activeWorkflow.targetFriction && (
              <span className="text-xs text-muted-foreground">
                Friction: {activeWorkflow.targetFriction}
              </span>
            )}
          </div>
        )}

        {/* ─── Split Pane Editor ────────────────────────────── */}
        {activeWorkflow && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* ── Left: Current Process ──────────────────────── */}
            <div className="rounded-lg border border-border overflow-hidden">
              <PaneHeader
                title="Current Process"
                stepCount={currentSteps.length}
                totalMinutes={currentTotal}
                variant="current"
              />
              <div className="p-3">
                <DraggableStepList
                  steps={currentSteps}
                  workflowId={activeWorkflow.id}
                  onReorder={handleReorderCurrent}
                  onUpdateStep={handleUpdateStep}
                  onDeleteStep={handleDeleteStep}
                  phase="current"
                />
              </div>
              <div className="px-3 pb-3">
                <button
                  onClick={() => handleAddStep("current")}
                  disabled={addStepMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-amber-500/40 hover:bg-muted/30 transition-colors text-xs font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Step
                </button>
              </div>
            </div>

            {/* ── Right: AI-Powered Process ──────────────────── */}
            <div className="rounded-lg border border-border overflow-hidden">
              <PaneHeader
                title="AI-Powered Process"
                stepCount={aiSteps.length}
                totalMinutes={aiTotal}
                variant="ai"
              />
              <div className="p-3">
                {aiSteps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-12 px-6 text-center">
                    <p className="text-muted-foreground text-sm">
                      No AI steps yet. Add one below.
                    </p>
                  </div>
                ) : (
                  <AIStepListWithDnd
                    steps={aiSteps}
                    workflowId={activeWorkflow.id}
                    onReorder={handleReorderAI}
                    onUpdateStep={handleUpdateStep}
                    onDeleteStep={handleDeleteStep}
                    hitlCount={hitlCount}
                    hitlStepIds={hitlStepIds}
                  />
                )}
              </div>
              <div className="px-3 pb-3">
                <button
                  onClick={() => handleAddStep("ai")}
                  disabled={addStepMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-[#36bf78]/40 hover:bg-muted/30 transition-colors text-xs font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add AI Step
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Metrics Dashboard (sticky bottom) ────────────── */}
        {activeWorkflow && (aiSteps.length > 0 || currentSteps.length > 0) && (
          <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3">
            <div className="mx-auto max-w-7xl">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <MetricsDashboard
                    workflowId={activeWorkflow.id}
                    workflow={activeWorkflow}
                  />
                </div>
                <button
                  onClick={() => setInspectorOpen(true)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Inspect formulas"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Formula Inspector Drawer ─────────────────────── */}
        {activeWorkflow && (
          <FormulaInspector
            workflowId={activeWorkflow.id}
            open={inspectorOpen}
            onClose={() => setInspectorOpen(false)}
          />
        )}

        {/* ─── Bottom Navigation ────────────────────────────── */}
        <Separator />

        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/project/${projectId}/generate`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card text-foreground font-medium text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to AI Generation
          </button>

          <button
            onClick={() => navigate(`/project/${projectId}/dashboard`)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#001278] text-white font-medium text-sm hover:bg-[#001278]/90 transition-colors"
          >
            Continue to Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Layout>
  );
}

// ─── Pane Header (same pattern as SplitPaneEditor) ───────────────────────────

function PaneHeader({
  title,
  stepCount,
  totalMinutes,
  variant,
}: {
  title: string;
  stepCount: number;
  totalMinutes: number;
  variant: "current" | "ai";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3",
        variant === "current"
          ? "bg-gradient-to-r from-red-500/10 to-amber-500/10 border-b border-red-500/20"
          : "bg-gradient-to-r from-[#02a2fd]/10 to-[#36bf78]/10 border-b border-[#36bf78]/20",
      )}
    >
      <div className="flex items-center gap-2">
        {variant === "current" ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : (
          <Zap className="h-4 w-4 text-[#36bf78]" />
        )}
        <h3
          className={cn(
            "text-sm font-bold",
            variant === "current"
              ? "text-red-600 dark:text-red-400"
              : "text-[#36bf78]",
          )}
        >
          {title}
        </h3>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Layers className="h-3 w-3" />
          {stepCount} steps
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDuration(totalMinutes)}
        </span>
      </div>
    </div>
  );
}

// ─── AI Step List with DnD + SortableAIStepCard ──────────────────────────────

function AIStepListWithDnd({
  steps,
  workflowId,
  onReorder,
  onUpdateStep,
  onDeleteStep,
  hitlCount,
  hitlStepIds,
}: {
  steps: WorkflowStepData[];
  workflowId: string;
  onReorder: (stepIds: string[]) => void;
  onUpdateStep: (stepId: string, data: Partial<WorkflowStepData>) => void;
  onDeleteStep: (stepId: string) => void;
  hitlCount: number;
  hitlStepIds: Set<string>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(steps, oldIndex, newIndex);
    onReorder(reordered.map((s: WorkflowStepData) => s.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={steps.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {steps.map((step, index) => (
            <SortableAIStepCard
              key={step.id}
              step={step}
              index={index}
              onUpdate={(data) => onUpdateStep(step.id, data)}
              onDelete={() => onDeleteStep(step.id)}
              isLastHITL={
                hitlStepIds.has(step.id) && hitlCount === 1
              }
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── Page wrapper (with FormulaProvider) ──────────────────────────────────────

export default function ReviewRefine() {
  return (
    <FormulaProvider>
      <ReviewRefineInner />
    </FormulaProvider>
  );
}
