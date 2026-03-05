import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import WorkflowSelector from "@/components/workflow/WorkflowSelector";
import SplitPaneEditor from "@/components/workflow/SplitPaneEditor";
import MetricsDashboard from "@/components/workflow/MetricsDashboard";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import {
  Sparkles,
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowWithSteps } from "@shared/types";

type GenerationState = "idle" | "generating" | "complete" | "error";

export default function AIGeneration() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [activeWorkflowId, setActiveWorkflowId] = useState<string>("");
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());

  // ─── Fetch workflows ─────────────────────────────────────
  const {
    data: workflows = [],
    isLoading,
    isError,
  } = useQuery<WorkflowWithSteps[]>({
    queryKey: [`/api/projects/${projectId}/workflows`],
    enabled: !!projectId,
  });

  // Set active workflow to first on load
  const activeId = activeWorkflowId || workflows[0]?.id || "";
  const activeWorkflow = workflows.find((wf) => wf.id === activeId);

  // ─── Generation state per workflow ─────────────────────────
  function getState(wf: WorkflowWithSteps): GenerationState {
    if (generatingIds.has(wf.id)) return "generating";
    if (wf.aiGenerated && wf.aiSteps.length > 0) return "complete";
    return "idle";
  }

  // ─── Generate single workflow ─────────────────────────────
  const generateOneMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const res = await apiRequest("POST", "/api/ai/generate-ai-workflow", {
        workflowId,
      });
      return res.json();
    },
    onMutate: (workflowId) => {
      setGeneratingIds((prev) => new Set(prev).add(workflowId));
    },
    onSuccess: (_data, workflowId) => {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(workflowId);
        return next;
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/workflows`],
      });
      toast({
        title: "Workflow generated",
        description: "AI workflow is ready for review.",
      });
    },
    onError: (err: Error, workflowId) => {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(workflowId);
        return next;
      });
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: err.message,
      });
    },
  });

  // ─── Generate all workflows ────────────────────────────────
  const generateAllMutation = useMutation({
    mutationFn: async () => {
      // 60s per ungenerated workflow, min 180s
      const ungenCount = workflows.filter((wf) => !wf.aiGenerated).length;
      const timeout = Math.max(180000, ungenCount * 60000);
      const res = await apiRequest(
        "POST",
        "/api/ai/generate-all",
        { projectId },
        timeout,
      );
      return res.json();
    },
    onMutate: () => {
      // Only mark ungenerated workflows as generating
      const ungenIds = new Set(
        workflows.filter((wf) => !wf.aiGenerated).map((wf) => wf.id),
      );
      setGeneratingIds(ungenIds);
    },
    onSuccess: () => {
      setGeneratingIds(new Set());
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/workflows`],
      });
      toast({
        title: "All workflows generated",
        description: "Every workflow now has an AI alternative.",
      });
    },
    onError: (err: Error) => {
      setGeneratingIds(new Set());
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: err.message,
      });
    },
  });

  // ─── Derived state ────────────────────────────────────────
  const allGenerated = workflows.length > 0 && workflows.every((wf) => wf.aiGenerated);
  const generatedCount = workflows.filter((wf) => wf.aiGenerated).length;
  const isAnyGenerating = generatingIds.size > 0;
  const ungeneratedCount = workflows.filter((wf) => !wf.aiGenerated).length;

  // ─── Loading state ────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout projectId={projectId} currentStep={2}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#02a2fd]" />
          <span className="ml-2 text-muted-foreground">Loading workflows...</span>
        </div>
      </Layout>
    );
  }

  if (isError || workflows.length === 0) {
    return (
      <Layout projectId={projectId} currentStep={2}>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Generate AI Workflows
          </h1>
          <p className="text-muted-foreground">
            No workflows found. Map your current processes first.
          </p>
        </div>
        <div className="mt-8 flex justify-start">
          <button
            onClick={() => navigate(`/project/${projectId}/mapping`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#001278] text-white font-medium hover:bg-[#001278]/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Mapping
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout projectId={projectId} currentStep={2}>
      <div className="space-y-6 pb-32">
        {/* ─── Header ──────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              Generate AI Workflows
            </h1>
            <p className="text-muted-foreground">
              Let AI reimagine each process. Then compare.
            </p>
          </div>

          {/* Generate All button */}
          <button
            onClick={() => generateAllMutation.mutate()}
            disabled={isAnyGenerating || allGenerated}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all shrink-0",
              allGenerated
                ? "bg-[#36bf78]/10 text-[#36bf78] border border-[#36bf78]/20 cursor-default"
                : "bg-gradient-to-r from-[#001278] to-[#02a2fd] text-white hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          >
            {isAnyGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : allGenerated ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                All Generated
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate All ({ungeneratedCount})
              </>
            )}
          </button>
        </div>

        {/* ─── Progress bar ──────────────────────────────── */}
        {workflows.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {generatedCount} of {workflows.length} generated
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#02a2fd] to-[#36bf78] transition-all duration-500"
                style={{
                  width: `${(generatedCount / workflows.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* ─── Workflow Tabs ─────────────────────────────── */}
        <WorkflowSelector
          workflows={workflows}
          activeId={activeId}
          onSelect={setActiveWorkflowId}
        />

        {/* ─── Active Workflow Content ───────────────────── */}
        {activeWorkflow && (
          <div className="space-y-4">
            {/* Workflow metadata */}
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

            {/* State: idle — show generate button */}
            {getState(activeWorkflow) === "idle" && (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center">
                <Sparkles className="h-10 w-10 text-[#02a2fd]/40 mb-4" />
                <p className="text-lg font-semibold text-foreground">
                  Ready to transform this workflow.
                </p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  AI will analyze the current steps and design an optimized
                  alternative with automation, agents, and human checkpoints.
                </p>
                <button
                  onClick={() => generateOneMutation.mutate(activeWorkflow.id)}
                  disabled={isAnyGenerating}
                  className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#001278] to-[#02a2fd] text-white font-medium hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate AI Workflow
                </button>
              </div>
            )}

            {/* State: generating — show spinner */}
            {getState(activeWorkflow) === "generating" && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-[#02a2fd]/20 bg-[#02a2fd]/5 py-16 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-[#02a2fd] mb-4" />
                <p className="text-lg font-semibold text-foreground">
                  Generating AI workflow...
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Analyzing steps. Designing alternatives. This takes a moment.
                </p>
              </div>
            )}

            {/* State: complete — show SplitPaneEditor */}
            {getState(activeWorkflow) === "complete" && (
              <>
                <SplitPaneEditor workflow={activeWorkflow} readOnly />

                {/* Metrics bar */}
                <MetricsDashboard
                  workflowId={activeWorkflow.id}
                  workflow={activeWorkflow}
                />
              </>
            )}
          </div>
        )}

        {/* ─── Bottom Navigation ─────────────────────────── */}
        <Separator />

        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/project/${projectId}/mapping`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card text-foreground font-medium text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Mapping
          </button>

          <div className="flex items-center gap-3">
            {!allGenerated && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Generate all workflows to proceed.
              </span>
            )}
            <button
              onClick={() => navigate(`/project/${projectId}/refine`)}
              disabled={!allGenerated}
              className={cn(
                "inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all",
                allGenerated
                  ? "bg-[#001278] text-white hover:bg-[#001278]/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
            >
              Continue to Refine
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
