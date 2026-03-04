import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import {
  Clock,
  DollarSign,
  Cpu,
  Gauge,
  Search,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { WorkflowWithSteps } from "@shared/types";

interface MetricsDashboardProps {
  workflowId: string;
  workflow: WorkflowWithSteps;
}

interface MetricTile {
  label: string;
  value: string;
  description: string;
  icon: typeof Clock;
  color: string;
  progressValue?: number;
  progressColor?: string;
}

export default function MetricsDashboard({
  workflowId,
  workflow,
}: MetricsDashboardProps) {
  const metrics = useMemo(() => {
    const currentSteps = workflow.currentSteps || [];
    const aiSteps = workflow.aiSteps || [];

    const currentTotal = currentSteps.reduce(
      (sum, s) => sum + s.durationMinutes,
      0,
    );
    const aiTotal = aiSteps.reduce((sum, s) => sum + s.durationMinutes, 0);

    const timeReduction =
      currentTotal > 0 ? (currentTotal - aiTotal) / currentTotal : 0;

    const automationRate =
      aiSteps.length > 0
        ? aiSteps.filter((s) => s.isAIEnabled).length / aiSteps.length
        : 0;

    const throughput = aiTotal > 0 ? currentTotal / aiTotal : 0;

    // Annual savings estimate: use friction data if available, otherwise estimate from time
    const hourlyRate = workflow.hourlyRateOverride || 85;
    const annualRuns = 2000; // DEFAULT_PARAMS.annualRunsPerWorkflow
    const timeSavedPerRun = currentTotal - aiTotal;
    const annualSavings =
      workflow.frictionAnnualCost > 0
        ? workflow.frictionAnnualCost * timeReduction
        : (timeSavedPerRun / 60) * hourlyRate * annualRuns;

    return { timeReduction, annualSavings, automationRate, throughput };
  }, [workflow]);

  const tiles: MetricTile[] = [
    {
      label: "Time Reduction",
      value: `${Math.round(metrics.timeReduction * 100)}%`,
      description: "Less time per workflow run",
      icon: Clock,
      color: "text-[#36bf78]",
      progressValue: Math.round(metrics.timeReduction * 100),
      progressColor: "bg-gradient-to-r from-[#36bf78] to-[#02a2fd]",
    },
    {
      label: "Annual Savings",
      value: formatCurrency(metrics.annualSavings),
      description: "Estimated cost reduction",
      icon: DollarSign,
      color: "text-[#36bf78]",
    },
    {
      label: "Automation Rate",
      value: `${Math.round(metrics.automationRate * 100)}%`,
      description: "AI-enabled steps",
      icon: Cpu,
      color: "text-[#02a2fd]",
      progressValue: Math.round(metrics.automationRate * 100),
      progressColor: "bg-gradient-to-r from-[#02a2fd] to-[#001278]",
    },
    {
      label: "Throughput",
      value:
        metrics.throughput > 0
          ? `${metrics.throughput.toFixed(1)}x`
          : "--",
      description: "Faster processing",
      icon: Gauge,
      color: "text-amber-500",
    },
  ];

  const hasData =
    workflow.aiSteps && workflow.aiSteps.length > 0;

  if (!hasData) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 flex-1">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <div key={tile.label} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn("h-3.5 w-3.5", tile.color)} />
                  <span className="text-xs font-medium text-muted-foreground">
                    {tile.label}
                  </span>
                </div>
                <p className={cn("text-xl font-bold tracking-tight", tile.color)}>
                  {tile.value}
                </p>
                {tile.progressValue != null && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", tile.progressColor)}
                      style={{ width: `${Math.min(tile.progressValue, 100)}%` }}
                    />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {tile.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Formula Inspector placeholder */}
        <button
          className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Inspect formulas"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
