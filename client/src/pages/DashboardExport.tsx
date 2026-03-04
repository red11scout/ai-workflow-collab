import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { FormulaProvider, useFormula } from "@/contexts/FormulaContext";
import type { WorkflowParams } from "@/contexts/FormulaContext";
import SplitPaneEditor from "@/components/workflow/SplitPaneEditor";
import ShareDialog from "@/components/export/ShareDialog";
import ExcelExportButton from "@/components/export/ExcelExportButton";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDuration, cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import type {
  ProjectWithWorkflows,
  WorkflowWithSteps,
  AggregateMetrics,
} from "@shared/types";
import { SCENARIO_MULTIPLIERS, DEFAULT_PARAMS } from "@shared/constants";
import {
  Clock,
  DollarSign,
  Cpu,
  Gauge,
  TrendingUp,
  Calendar,
  ArrowLeft,
  Share2,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  BarChart3,
} from "lucide-react";

// ─── Scenario Options ────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    key: "conservative" as const,
    label: "Conservative",
    multiplier: SCENARIO_MULTIPLIERS.conservative,
    description: "Lower confidence estimates",
  },
  {
    key: "moderate" as const,
    label: "Moderate",
    multiplier: SCENARIO_MULTIPLIERS.moderate,
    description: "Expected outcomes",
  },
  {
    key: "aggressive" as const,
    label: "Aggressive",
    multiplier: SCENARIO_MULTIPLIERS.aggressive,
    description: "Best-case adoption",
  },
];

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardData {
  label: string;
  value: string;
  icon: typeof Clock;
  color: string;
  bgColor: string;
}

function MetricCard({ label, value, icon: Icon, color, bgColor }: MetricCardData) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            bgColor,
          )}
        >
          <Icon className={cn("h-5 w-5", color)} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-bold tracking-tight", color)}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Workflow Row ────────────────────────────────────────────────────────────

interface WorkflowRowProps {
  workflow: WorkflowWithSteps;
  expanded: boolean;
  onToggle: () => void;
  scenarioMultiplier: number;
}

function WorkflowRow({
  workflow,
  expanded,
  onToggle,
  scenarioMultiplier,
}: WorkflowRowProps) {
  const currentSteps = workflow.currentSteps || [];
  const aiSteps = workflow.aiSteps || [];

  const currentMinutes = currentSteps.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );
  const rawAiMinutes = aiSteps.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );
  // Apply scenario scaling to AI durations
  const aiMinutes =
    scenarioMultiplier !== 1.0
      ? Math.round(rawAiMinutes / scenarioMultiplier)
      : rawAiMinutes;

  const timeReduction =
    currentMinutes > 0 ? (currentMinutes - aiMinutes) / currentMinutes : 0;
  const timeReductionPct = Math.round(timeReduction * 100);

  const automationRate =
    aiSteps.length > 0
      ? aiSteps.filter((s) => s.isAIEnabled).length / aiSteps.length
      : 0;

  const hourlyRate = workflow.hourlyRateOverride || DEFAULT_PARAMS.avgHourlyRate;
  const annualRuns = DEFAULT_PARAMS.annualRunsPerWorkflow;
  const timeSavedPerRun = currentMinutes - aiMinutes;
  const annualSavings =
    workflow.frictionAnnualCost > 0
      ? workflow.frictionAnnualCost * timeReduction
      : (timeSavedPerRun / 60) * hourlyRate * annualRuns;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {workflow.useCaseName}
          </p>
          {workflow.businessFunction && (
            <span className="mt-1 inline-block text-xs px-2 py-0.5 rounded-full bg-[#001278]/10 text-[#001278] dark:bg-[#02a2fd]/10 dark:text-[#02a2fd]">
              {workflow.businessFunction}
            </span>
          )}
        </div>

        {/* Duration comparison */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <span>{formatDuration(currentMinutes)}</span>
          <span className="text-[#02a2fd]">→</span>
          <span className="font-semibold text-[#36bf78]">
            {formatDuration(aiMinutes)}
          </span>
        </div>

        {/* Time reduction bar */}
        <div className="hidden md:block w-24 shrink-0">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Reduction</span>
            <span className="font-bold text-[#36bf78]">{timeReductionPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#36bf78] to-[#02a2fd] transition-all"
              style={{ width: `${Math.min(timeReductionPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Annual savings */}
        <div className="hidden lg:block text-right shrink-0 w-20">
          <p className="text-xs text-muted-foreground">Savings</p>
          <p className="text-sm font-bold text-[#36bf78]">
            {formatCurrency(annualSavings)}
          </p>
        </div>

        {/* Automation rate */}
        <div className="hidden lg:block text-right shrink-0 w-16">
          <p className="text-xs text-muted-foreground">Automation</p>
          <p className="text-sm font-bold text-[#02a2fd]">
            {Math.round(automationRate * 100)}%
          </p>
        </div>

        {/* Chevron */}
        <div className="shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Expanded: SplitPaneEditor */}
      {expanded && (
        <div className="border-t border-border p-4 bg-muted/20">
          <SplitPaneEditor workflow={workflow} readOnly />
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Inner (needs FormulaContext) ──────────────────────────────────

function DashboardInner({ projectId }: { projectId: string }) {
  const [, navigate] = useLocation();
  const [scenario, setScenario] = useState<"conservative" | "moderate" | "aggressive">("moderate");
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);

  const { data: project, isLoading, isError, error } = useQuery<ProjectWithWorkflows>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: workflows } = useQuery<WorkflowWithSteps[]>({
    queryKey: [`/api/projects/${projectId}/workflows`],
    enabled: !!projectId,
  });

  const allWorkflows = workflows || project?.workflows || [];

  // ─── FormulaContext integration ──────────────────────────────────────────

  const {
    rebuildWorkflowSheet,
    setScenarioMultiplier,
    getAggregateMetrics,
    version,
  } = useFormula();

  // Build sheets for all workflows on mount / data change
  useEffect(() => {
    if (allWorkflows.length === 0) return;

    for (const wf of allWorkflows) {
      const currentDurations = (wf.currentSteps || []).map(
        (s) => s.durationMinutes,
      );
      const aiDurations = (wf.aiSteps || []).map((s) => s.durationMinutes);
      const automationRate =
        wf.aiSteps && wf.aiSteps.length > 0
          ? wf.aiSteps.filter((s) => s.isAIEnabled).length / wf.aiSteps.length
          : 0;
      const hitlCount = (wf.aiSteps || []).filter(
        (s) => s.isHumanInTheLoop,
      ).length;

      const params: WorkflowParams = {
        hourlyRate:
          wf.hourlyRateOverride || project?.avgHourlyRate || DEFAULT_PARAMS.avgHourlyRate,
        adoptionRate: (project?.adoptionRatePct || DEFAULT_PARAMS.adoptionRatePct) / 100,
        dataMaturity: (project?.dataMaturityPct || DEFAULT_PARAMS.dataMaturityPct) / 100,
        annualRuns: DEFAULT_PARAMS.annualRunsPerWorkflow,
        implementCost: DEFAULT_PARAMS.implementationCost,
      };

      rebuildWorkflowSheet(
        wf.id,
        params,
        currentDurations,
        aiDurations,
        automationRate,
        hitlCount,
      );
    }
  }, [allWorkflows, project, rebuildWorkflowSheet]);

  // ─── Scenario switching ──────────────────────────────────────────────────

  const currentScenario = SCENARIOS.find((s) => s.key === scenario)!;

  const handleScenarioChange = useCallback(
    (key: "conservative" | "moderate" | "aggressive") => {
      setScenario(key);
      const s = SCENARIOS.find((sc) => sc.key === key)!;
      setScenarioMultiplier(s.multiplier);
    },
    [setScenarioMultiplier],
  );

  // ─── Metrics ─────────────────────────────────────────────────────────────

  const aggregate: AggregateMetrics = useMemo(() => {
    // version dependency ensures recalculation on HF mutations
    void version;
    return getAggregateMetrics();
  }, [getAggregateMetrics, version]);

  // Fallback metrics computed from raw workflow data (for immediate display)
  const fallbackMetrics = useMemo(() => {
    if (allWorkflows.length === 0) {
      return {
        totalAnnualTimeSavedHours: 0,
        totalAnnualSavings: 0,
        avgAutomationRate: 0,
        avgThroughput: 0,
        roi3Year: 0,
        paybackMonths: 0,
      };
    }

    const mult = currentScenario.multiplier;
    let totalTimeSavedMinutes = 0;
    let totalSavings = 0;
    let totalAutomation = 0;
    let totalThroughput = 0;

    for (const wf of allWorkflows) {
      const cMin = (wf.currentSteps || []).reduce(
        (sum, s) => sum + s.durationMinutes,
        0,
      );
      const rawAiMin = (wf.aiSteps || []).reduce(
        (sum, s) => sum + s.durationMinutes,
        0,
      );
      const aiMin = mult !== 1.0 ? Math.round(rawAiMin / mult) : rawAiMin;

      const timeSaved = cMin - aiMin;
      totalTimeSavedMinutes += timeSaved;

      const timeReduction = cMin > 0 ? timeSaved / cMin : 0;
      const hourlyRate =
        wf.hourlyRateOverride || project?.avgHourlyRate || DEFAULT_PARAMS.avgHourlyRate;

      const savings =
        wf.frictionAnnualCost > 0
          ? wf.frictionAnnualCost * timeReduction
          : (timeSaved / 60) * hourlyRate * DEFAULT_PARAMS.annualRunsPerWorkflow;
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
      totalAnnualTimeSavedHours: totalTimeSavedMinutes / 60,
      totalAnnualSavings: totalSavings,
      avgAutomationRate: totalAutomation / count,
      avgThroughput: totalThroughput / count,
      roi3Year:
        implementCost > 0
          ? (totalSavings * 3 - implementCost) / implementCost
          : 0,
      paybackMonths:
        totalSavings > 0 ? (implementCost / totalSavings) * 12 : 0,
    };
  }, [allWorkflows, project, currentScenario.multiplier]);

  // Prefer HF aggregate when available, fall back to local calc
  const metrics = useMemo(() => {
    if (aggregate.workflowCount > 0) {
      return {
        totalAnnualTimeSavedHours: aggregate.totalAnnualTimeSavedHours,
        totalAnnualSavings: aggregate.totalAnnualSavings,
        avgAutomationRate: aggregate.avgAutomationRate,
        avgThroughput: fallbackMetrics.avgThroughput,
        roi3Year: aggregate.roi3Year,
        paybackMonths: aggregate.paybackMonths,
      };
    }
    return fallbackMetrics;
  }, [aggregate, fallbackMetrics]);

  // ─── Export JSON ─────────────────────────────────────────────────────────

  async function handleExportJson() {
    setExportingJson(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/projects/${projectId}/export/json`,
      );
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.companyName || "project"}-workflow-analysis.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        title: "Export failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setExportingJson(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Layout projectId={projectId} currentStep={4}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#02a2fd]" />
          <span className="ml-3 text-muted-foreground">
            Loading dashboard...
          </span>
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout projectId={projectId} currentStep={4}>
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{(error as Error).message}</p>
        </div>
      </Layout>
    );
  }

  const metricCards: MetricCardData[] = [
    {
      label: "Annual Time Saved",
      value:
        metrics.totalAnnualTimeSavedHours >= 1000
          ? `${(metrics.totalAnnualTimeSavedHours / 1000).toFixed(1)}K hrs`
          : `${Math.round(metrics.totalAnnualTimeSavedHours)} hrs`,
      icon: Clock,
      color: "text-[#36bf78]",
      bgColor: "bg-[#36bf78]/10",
    },
    {
      label: "Annual Savings",
      value: formatCurrency(metrics.totalAnnualSavings),
      icon: DollarSign,
      color: "text-[#36bf78]",
      bgColor: "bg-[#36bf78]/10",
    },
    {
      label: "Avg Automation Rate",
      value: `${Math.round(metrics.avgAutomationRate * 100)}%`,
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
    <Layout
      projectId={projectId}
      currentStep={4}
      companyName={project?.companyName}
    >
      <div className="space-y-8">
        {/* ═══════════════════════════════════════════════════════════════════
            Section 1: Executive Summary
        ═══════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Dashboard
              </h1>
              <p className="mt-1 text-muted-foreground">
                The complete picture.{" "}
                {allWorkflows.length > 0 && (
                  <span className="font-medium text-foreground">
                    {allWorkflows.length} workflow
                    {allWorkflows.length !== 1 ? "s" : ""} analyzed.
                  </span>
                )}
              </p>
            </div>

            {/* Scenario selector */}
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {SCENARIOS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => handleScenarioChange(s.key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    scenario === s.key
                      ? "bg-[#001278] text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title={s.description}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Metric cards grid */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metricCards.map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Showing {currentScenario.label.toLowerCase()} estimates.{" "}
            {currentScenario.description}.
          </p>
        </section>

        <Separator />

        {/* ═══════════════════════════════════════════════════════════════════
            Section 2: Workflow Breakdown
        ═══════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-[#02a2fd]" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Workflow Breakdown
            </h2>
          </div>

          {allWorkflows.length === 0 ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-12">
              <p className="text-muted-foreground text-sm">
                No workflows yet. Go back and generate AI workflows first.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allWorkflows.map((wf) => (
                <WorkflowRow
                  key={wf.id}
                  workflow={wf}
                  expanded={expandedWorkflow === wf.id}
                  onToggle={() =>
                    setExpandedWorkflow((prev) =>
                      prev === wf.id ? null : wf.id,
                    )
                  }
                  scenarioMultiplier={currentScenario.multiplier}
                />
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* ═══════════════════════════════════════════════════════════════════
            Section 3: Export Actions
        ═══════════════════════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
            Export & Share
          </h2>
          <div className="flex flex-wrap gap-3">
            {/* Share Link */}
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#001278] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#001278]/90"
            >
              <Share2 className="h-4 w-4" />
              Share Link
            </button>

            {/* Download PDF (placeholder) */}
            <button
              onClick={() =>
                toast({
                  title: "Coming soon",
                  description: "PDF export will be available in Phase 4.",
                })
              }
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 hover:border-[#02a2fd]/40"
            >
              <FileText className="h-4 w-4 text-[#02a2fd]" />
              Download PDF
            </button>

            {/* Export Excel (placeholder) */}
            <ExcelExportButton projectId={projectId} />

            {/* Export JSON */}
            <button
              onClick={handleExportJson}
              disabled={exportingJson}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 hover:border-[#001278]/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exportingJson ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4 text-[#001278] dark:text-[#02a2fd]" />
              )}
              Export JSON
            </button>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            Navigation
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-start pb-8 pt-2">
          <button
            onClick={() => navigate(`/project/${projectId}/refine`)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Refine
          </button>
        </div>
      </div>

      {/* Share dialog */}
      <ShareDialog
        projectId={projectId}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </Layout>
  );
}

// ─── Page wrapper (provides FormulaContext) ──────────────────────────────────

export default function DashboardExport() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <FormulaProvider>
      <DashboardInner projectId={projectId!} />
    </FormulaProvider>
  );
}
