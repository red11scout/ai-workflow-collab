import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import StepComparisonCard from "@/components/workflow/StepComparisonCard";
import { formatCurrency, formatDuration, cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import type {
  ProjectWithWorkflows,
  WorkflowWithSteps,
} from "@shared/types";
import { DEFAULT_PARAMS } from "@shared/constants";
import {
  Clock,
  DollarSign,
  Cpu,
  Gauge,
  TrendingUp,
  Calendar,
  ArrowRight,
  Loader2,
  AlertCircle,
  ExternalLink,
  Layers,
  Zap,
  AlertTriangle,
} from "lucide-react";

// ─── Shared Metric Card ─────────────────────────────────────────────────────

function SharedMetricCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
}: {
  label: string;
  value: string;
  icon: typeof Clock;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            bgColor,
          )}
        >
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("text-xl font-bold tracking-tight", color)}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Workflow Comparison Section ─────────────────────────────────────────────

function WorkflowSection({ workflow }: { workflow: WorkflowWithSteps }) {
  const currentSteps = workflow.currentSteps || [];
  const aiSteps = workflow.aiSteps || [];

  const currentMinutes = currentSteps.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );
  const aiMinutes = aiSteps.reduce((sum, s) => sum + s.durationMinutes, 0);

  const timeReduction =
    currentMinutes > 0
      ? Math.round(((currentMinutes - aiMinutes) / currentMinutes) * 100)
      : 0;

  const automationRate =
    aiSteps.length > 0
      ? Math.round(
          (aiSteps.filter((s) => s.isAIEnabled).length / aiSteps.length) * 100,
        )
      : 0;

  const hourlyRate =
    workflow.hourlyRateOverride || DEFAULT_PARAMS.avgHourlyRate;
  const timeSavedPerRun = currentMinutes - aiMinutes;
  const annualSavings =
    workflow.frictionAnnualCost > 0
      ? workflow.frictionAnnualCost * (timeReduction / 100)
      : (timeSavedPerRun / 60) *
        hourlyRate *
        DEFAULT_PARAMS.annualRunsPerWorkflow;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#001278]/5 to-[#02a2fd]/5 px-5 py-4 border-b border-border">
        <h3 className="text-base font-bold text-foreground">
          {workflow.useCaseName}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {workflow.businessFunction && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#001278]/10 text-[#001278] dark:bg-[#02a2fd]/10 dark:text-[#02a2fd]">
              {workflow.businessFunction}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDuration(currentMinutes)} → {formatDuration(aiMinutes)}
          </span>
          <span className="text-xs font-semibold text-[#36bf78]">
            {timeReduction}% faster
          </span>
          <span className="text-xs text-muted-foreground">
            {automationRate}% automated
          </span>
          <span className="text-xs font-semibold text-[#36bf78]">
            {formatCurrency(annualSavings)}/yr saved
          </span>
        </div>
      </div>

      {/* Side-by-side steps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Current process */}
        <div className="border-b lg:border-b-0 lg:border-r border-border">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-red-500/10 to-amber-500/10 border-b border-red-500/20">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-bold text-red-600 dark:text-red-400">
                Current Process
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Layers className="h-3 w-3" />
              {currentSteps.length} steps
              <Clock className="h-3 w-3 ml-1" />
              {formatDuration(currentMinutes)}
            </div>
          </div>
          <div className="space-y-2 p-3">
            {currentSteps
              .sort((a, b) => a.stepNumber - b.stepNumber)
              .map((step) => (
                <StepComparisonCard
                  key={step.id}
                  step={step}
                  phase="current"
                />
              ))}
            {currentSteps.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No steps mapped.
              </p>
            )}
          </div>
        </div>

        {/* AI process */}
        <div>
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#02a2fd]/10 to-[#36bf78]/10 border-b border-[#36bf78]/20">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-[#36bf78]" />
              <span className="text-xs font-bold text-[#36bf78]">
                AI-Powered Process
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Layers className="h-3 w-3" />
              {aiSteps.length} steps
              <Clock className="h-3 w-3 ml-1" />
              {formatDuration(aiMinutes)}
            </div>
          </div>
          <div className="space-y-2 p-3">
            {aiSteps
              .sort((a, b) => a.stepNumber - b.stepNumber)
              .map((step) => (
                <StepComparisonCard key={step.id} step={step} phase="ai" />
              ))}
            {aiSteps.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                AI workflow not generated.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SharedReport Page ──────────────────────────────────────────────────────

export default function SharedReport() {
  const { code } = useParams<{ code: string }>();

  const {
    data: project,
    isLoading,
    isError,
    error,
  } = useQuery<ProjectWithWorkflows>({
    queryKey: [`/api/shared/${code}`],
    enabled: !!code,
  });

  const allWorkflows = project?.workflows || [];

  // ─── Compute summary metrics ────────────────────────────────────────────

  const metrics = useMemo(() => {
    if (allWorkflows.length === 0) {
      return {
        totalTimeSavedHours: 0,
        totalSavings: 0,
        avgAutomation: 0,
        avgThroughput: 0,
        roi3Year: 0,
        paybackMonths: 0,
      };
    }

    let totalTimeSavedMinutes = 0;
    let totalSavings = 0;
    let totalAutomation = 0;
    let totalThroughput = 0;

    for (const wf of allWorkflows) {
      const cMin = (wf.currentSteps || []).reduce(
        (sum, s) => sum + s.durationMinutes,
        0,
      );
      const aiMin = (wf.aiSteps || []).reduce(
        (sum, s) => sum + s.durationMinutes,
        0,
      );

      const timeSaved = cMin - aiMin;
      totalTimeSavedMinutes += timeSaved;

      const timeReduction = cMin > 0 ? timeSaved / cMin : 0;
      const hourlyRate =
        wf.hourlyRateOverride ||
        project?.avgHourlyRate ||
        DEFAULT_PARAMS.avgHourlyRate;

      const savings =
        wf.frictionAnnualCost > 0
          ? wf.frictionAnnualCost * timeReduction
          : (timeSaved / 60) *
            hourlyRate *
            DEFAULT_PARAMS.annualRunsPerWorkflow;
      totalSavings += savings;

      const autoRate =
        wf.aiSteps && wf.aiSteps.length > 0
          ? wf.aiSteps.filter((s) => s.isAIEnabled).length / wf.aiSteps.length
          : 0;
      totalAutomation += autoRate;

      totalThroughput += aiMin > 0 ? cMin / aiMin : 0;
    }

    const count = allWorkflows.length;
    const implementCost = DEFAULT_PARAMS.implementationCost * count;

    return {
      totalTimeSavedHours: totalTimeSavedMinutes / 60,
      totalSavings,
      avgAutomation: totalAutomation / count,
      avgThroughput: totalThroughput / count,
      roi3Year:
        implementCost > 0
          ? (totalSavings * 3 - implementCost) / implementCost
          : 0,
      paybackMonths:
        totalSavings > 0 ? (implementCost / totalSavings) * 12 : 0,
    };
  }, [allWorkflows, project]);

  // ─── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background font-sans">
        <Loader2 className="h-6 w-6 animate-spin text-[#02a2fd]" />
        <span className="ml-3 text-muted-foreground">
          Loading report...
        </span>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────

  if (isError || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background font-sans px-4">
        <div className="mx-auto max-w-md text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">
            Report Not Found
          </h1>
          <p className="text-muted-foreground">
            {isError
              ? "This link may be invalid or expired. Check the URL and try again."
              : "No data found for this report."}
          </p>
          {isError && (
            <p className="text-xs text-muted-foreground">
              {(error as Error).message}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  const metricCards = [
    {
      label: "Annual Time Saved",
      value:
        metrics.totalTimeSavedHours >= 1000
          ? `${(metrics.totalTimeSavedHours / 1000).toFixed(1)}K hrs`
          : `${Math.round(metrics.totalTimeSavedHours)} hrs`,
      icon: Clock,
      color: "text-[#36bf78]",
      bgColor: "bg-[#36bf78]/10",
    },
    {
      label: "Annual Savings",
      value: formatCurrency(metrics.totalSavings),
      icon: DollarSign,
      color: "text-[#36bf78]",
      bgColor: "bg-[#36bf78]/10",
    },
    {
      label: "Avg Automation Rate",
      value: `${Math.round(metrics.avgAutomation * 100)}%`,
      icon: Cpu,
      color: "text-[#02a2fd]",
      bgColor: "bg-[#02a2fd]/10",
    },
    {
      label: "Avg Throughput Gain",
      value:
        metrics.avgThroughput > 0
          ? `${metrics.avgThroughput.toFixed(1)}x`
          : "--",
      icon: Gauge,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "3-Year ROI",
      value: `${Math.round(metrics.roi3Year * 100)}%`,
      icon: TrendingUp,
      color: "text-[#001278] dark:text-[#02a2fd]",
      bgColor: "bg-[#001278]/10 dark:bg-[#02a2fd]/10",
    },
    {
      label: "Payback Period",
      value:
        metrics.paybackMonths > 0
          ? `${metrics.paybackMonths.toFixed(1)} mo`
          : "--",
      icon: Calendar,
      color: "text-[#001278] dark:text-[#02a2fd]",
      bgColor: "bg-[#001278]/10 dark:bg-[#02a2fd]/10",
    },
  ];

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-gradient-to-r from-[#001278] to-[#02a2fd]">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
            AI Workflow Analysis
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {project.companyName || "Workflow Report"}
          </h1>
          {project.name && (
            <p className="mt-1 text-base text-white/80">{project.name}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/70">
            {project.industry && (
              <span className="rounded-full border border-white/20 px-3 py-0.5">
                {project.industry}
              </span>
            )}
            <span>
              {allWorkflows.length} workflow
              {allWorkflows.length !== 1 ? "s" : ""} analyzed
            </span>
          </div>
        </div>
      </header>

      {/* ─── Main content ──────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-10">
        {/* Executive Summary */}
        <section>
          <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
            Executive Summary
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metricCards.map((card) => (
              <SharedMetricCard key={card.label} {...card} />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Moderate scenario estimates. Based on {allWorkflows.length} workflow
            {allWorkflows.length !== 1 ? "s" : ""}.
          </p>
        </section>

        <Separator />

        {/* Workflow comparisons */}
        <section>
          <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
            Workflow Comparisons
          </h2>
          <div className="space-y-6">
            {allWorkflows.map((wf) => (
              <WorkflowSection key={wf.id} workflow={wf} />
            ))}
          </div>
        </section>
      </main>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-muted/30 mt-12">
        <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-[#001278] to-[#02a2fd] bg-clip-text text-transparent font-bold">
              BlueAlly
            </span>
            <span className="text-sm text-muted-foreground">
              AI Workflow Analysis
            </span>
          </div>
          <a
            href="https://www.blueally.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#02a2fd] hover:text-[#001278] transition-colors"
          >
            Powered by BlueAlly AI
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </footer>
    </div>
  );
}
