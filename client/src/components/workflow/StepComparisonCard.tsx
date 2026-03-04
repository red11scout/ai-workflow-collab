import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";
import {
  Clock,
  User,
  Monitor,
  Bot,
  AlertTriangle,
  GitBranch,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AUTOMATION_LEVELS } from "@shared/constants";
import type { WorkflowStepData } from "@shared/types";

interface StepComparisonCardProps {
  step: WorkflowStepData;
  phase: "current" | "ai";
}

const ACTOR_ICONS = {
  human: User,
  system: Monitor,
  ai_agent: Bot,
} as const;

const ACTOR_LABELS = {
  human: "Human",
  system: "System",
  ai_agent: "AI Agent",
} as const;

const AUTOMATION_COLORS: Record<string, string> = {
  full: "bg-[#36bf78]/10 text-[#36bf78] border-[#36bf78]/20",
  assisted: "bg-[#02a2fd]/10 text-[#02a2fd] border-[#02a2fd]/20",
  supervised: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  manual: "bg-muted text-muted-foreground border-border",
};

export default function StepComparisonCard({
  step,
  phase,
}: StepComparisonCardProps) {
  const ActorIcon = ACTOR_ICONS[step.actorType] || User;
  const actorLabel = ACTOR_LABELS[step.actorType] || step.actorType;
  const automationInfo = AUTOMATION_LEVELS.find(
    (l) => l.value === step.automationLevel,
  );

  return (
    <div
      className={cn(
        "group relative rounded-lg border p-3 transition-colors",
        "bg-card hover:bg-muted/30",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Step number badge */}
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
            phase === "current"
              ? "bg-gradient-to-br from-red-500 to-amber-500"
              : "bg-gradient-to-br from-[#02a2fd] to-[#36bf78]",
          )}
        >
          {step.stepNumber}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Name */}
          <p className="text-sm font-semibold text-foreground leading-tight">
            {step.name}
          </p>

          {/* Badges row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {/* Actor */}
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <ActorIcon className="h-3 w-3" />
              {actorLabel}
            </span>

            {/* Duration */}
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDuration(step.durationMinutes)}
            </span>

            {/* AI-specific: automation level */}
            {phase === "ai" && step.automationLevel && step.automationLevel !== "manual" && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                  AUTOMATION_COLORS[step.automationLevel] || AUTOMATION_COLORS.manual,
                )}
              >
                {automationInfo?.label || step.automationLevel}
              </span>
            )}

            {/* HITL indicator */}
            {step.isHumanInTheLoop && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                <ShieldCheck className="h-3 w-3" />
                HITL
              </span>
            )}
          </div>

          {/* Indicators row */}
          <div className="mt-1.5 flex items-center gap-2">
            {step.isBottleneck && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-500">
                <AlertTriangle className="h-3 w-3" />
                Bottleneck
              </span>
            )}
            {step.isDecisionPoint && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#02a2fd]">
                <GitBranch className="h-3 w-3" />
                Decision
              </span>
            )}
          </div>

          {/* Description (if present, truncated) */}
          {step.description && (
            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {step.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
