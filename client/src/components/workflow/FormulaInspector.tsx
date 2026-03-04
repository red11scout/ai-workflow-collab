import { useMemo } from "react";
import {
  X,
  FlaskConical,
  Clock,
  DollarSign,
  TrendingDown,
  Gauge,
  BarChart3,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useFormula } from "@/contexts/FormulaContext";
import type { FormulaTrace } from "@shared/types";
import type { MetricName } from "@/lib/formula-sheets";

interface FormulaInspectorProps {
  workflowId: string;
  open: boolean;
  onClose: () => void;
}

/** Ordered list of metrics to display in the inspector. */
const METRIC_KEYS: { key: MetricName; icon: typeof Clock; color: string }[] = [
  { key: "timeReductionPct", icon: Clock, color: "text-[#36bf78]" },
  { key: "currentTotal", icon: Clock, color: "text-muted-foreground" },
  { key: "aiTotal", icon: Clock, color: "text-[#02a2fd]" },
  { key: "currentAnnualCost", icon: DollarSign, color: "text-red-500" },
  { key: "aiAnnualCost", icon: DollarSign, color: "text-[#02a2fd]" },
  { key: "annualSavings", icon: DollarSign, color: "text-[#36bf78]" },
  { key: "costReductionPct", icon: TrendingDown, color: "text-[#36bf78]" },
  { key: "throughputMultiplier", icon: Gauge, color: "text-amber-500" },
  { key: "roi3Year", icon: BarChart3, color: "text-[#001278] dark:text-[#02a2fd]" },
];

function TraceCard({
  trace,
  icon: Icon,
  color,
}: {
  trace: FormulaTrace;
  icon: typeof Clock;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Metric name */}
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4 shrink-0", color)} />
        <h4 className="text-sm font-bold text-foreground">
          {trace.metricName}
        </h4>
      </div>

      {/* Formula */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Formula
        </p>
        <code className="block text-xs font-mono text-foreground bg-muted/50 rounded px-2.5 py-1.5 overflow-x-auto">
          {trace.formulaString}
        </code>
      </div>

      {/* Substituted */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          With Values
        </p>
        <code className="block text-xs font-mono text-foreground bg-muted/50 rounded px-2.5 py-1.5 overflow-x-auto">
          {trace.substituted}
        </code>
      </div>

      {/* Result */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Result
        </span>
        <span className={cn("text-sm font-bold", color)}>{trace.result}</span>
      </div>

      {/* Input breakdown */}
      {trace.inputs.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Inputs
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-muted-foreground py-1 pr-3">
                    Label
                  </th>
                  <th className="text-right font-medium text-muted-foreground py-1 pr-3">
                    Value
                  </th>
                  <th className="text-left font-medium text-muted-foreground py-1">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {trace.inputs.map((input, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-1 pr-3 font-mono text-foreground">
                      {input.label}
                    </td>
                    <td className="py-1 pr-3 text-right font-mono text-foreground">
                      {input.value.toLocaleString()}
                    </td>
                    <td className="py-1 text-muted-foreground">{input.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FormulaInspector({
  workflowId,
  open,
  onClose,
}: FormulaInspectorProps) {
  const { getFormulaTrace } = useFormula();

  const traces = useMemo(() => {
    if (!open || !workflowId) return [];

    const result: {
      trace: FormulaTrace;
      icon: typeof Clock;
      color: string;
    }[] = [];

    for (const { key, icon, color } of METRIC_KEYS) {
      const trace = getFormulaTrace(workflowId, key);
      if (trace) {
        result.push({ trace, icon, color });
      }
    }

    return result;
  }, [open, workflowId, getFormulaTrace]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-md border-l border-border bg-background shadow-xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-[#02a2fd]" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Formula Inspector
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close inspector"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100%-65px)]">
          <div className="space-y-3 p-5">
            {traces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FlaskConical className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No formula data yet. Edit step durations to see calculations.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Every metric. Every formula. Full audit trail.
                </p>
                <Separator />
                {traces.map(({ trace, icon, color }) => (
                  <TraceCard
                    key={trace.metricName}
                    trace={trace}
                    icon={icon}
                    color={color}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
