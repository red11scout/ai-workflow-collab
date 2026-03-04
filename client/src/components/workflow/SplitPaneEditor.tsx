import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";
import {
  ArrowRight,
  Clock,
  Layers,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import StepComparisonCard from "./StepComparisonCard";
import type { WorkflowWithSteps, WorkflowStepData } from "@shared/types";

interface SplitPaneEditorProps {
  workflow: WorkflowWithSteps;
  readOnly?: boolean;
  onUpdateStep?: (stepId: string, data: Partial<WorkflowStepData>) => void;
  onDeleteStep?: (stepId: string) => void;
  onReorderSteps?: (
    workflowId: string,
    phase: "current" | "ai",
    stepIds: string[],
  ) => void;
  onAddStep?: (workflowId: string, phase: "current" | "ai") => void;
}

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
        "flex items-center justify-between rounded-t-lg px-4 py-3",
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
            variant === "current" ? "text-red-600 dark:text-red-400" : "text-[#36bf78]",
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

function StepList({
  steps,
  phase,
  emptyMessage,
}: {
  steps: WorkflowStepData[];
  phase: "current" | "ai";
  emptyMessage: string;
}) {
  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {steps
        .sort((a, b) => a.stepNumber - b.stepNumber)
        .map((step) => (
          <StepComparisonCard key={step.id} step={step} phase={phase} />
        ))}
    </div>
  );
}

export default function SplitPaneEditor({
  workflow,
  readOnly = true,
  onUpdateStep,
  onDeleteStep,
  onReorderSteps,
  onAddStep,
}: SplitPaneEditorProps) {
  const currentSteps = workflow.currentSteps || [];
  const aiSteps = workflow.aiSteps || [];

  const currentTotal = currentSteps.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );
  const aiTotal = aiSteps.reduce((sum, s) => sum + s.durationMinutes, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ─── Left: Current Process ──────────────────────── */}
      <div className="rounded-lg border border-border overflow-hidden">
        <PaneHeader
          title="Current Process"
          stepCount={currentSteps.length}
          totalMinutes={currentTotal}
          variant="current"
        />
        <StepList
          steps={currentSteps}
          phase="current"
          emptyMessage="No current steps mapped yet."
        />
      </div>

      {/* ─── Right: AI-Powered Process ──────────────────── */}
      <div className="rounded-lg border border-border overflow-hidden">
        <PaneHeader
          title="AI-Powered Process"
          stepCount={aiSteps.length}
          totalMinutes={aiTotal}
          variant="ai"
        />
        <StepList
          steps={aiSteps}
          phase="ai"
          emptyMessage="AI workflow not generated yet."
        />
      </div>

      {/* ─── Center Arrow (visible on lg+ between columns) */}
      <div className="hidden lg:flex absolute inset-y-0 left-1/2 -translate-x-1/2 items-center pointer-events-none">
        {/* Arrow is decorative — removed from DOM for clean layout */}
      </div>
    </div>
  );
}
