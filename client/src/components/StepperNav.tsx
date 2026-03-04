import { Link } from "wouter";
import {
  Upload,
  GitBranch,
  Sparkles,
  Settings2,
  LayoutDashboard,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS } from "@shared/constants";

const STEP_ICONS = [Upload, GitBranch, Sparkles, Settings2, LayoutDashboard];

interface StepperNavProps {
  projectId: string;
  currentStep: number;
  completedSteps: number[];
}

export default function StepperNav({
  projectId,
  currentStep,
  completedSteps,
}: StepperNavProps) {
  return (
    <nav className="border-t border-border bg-background/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
        {STEPS.map((step, i) => {
          const Icon = STEP_ICONS[i];
          const isActive = i === currentStep;
          const isCompleted = completedSteps.includes(i);
          const isPending = !isActive && !isCompleted;

          return (
            <div key={step.step} className="flex items-center">
              {/* Connector line (before every step except first) */}
              {i > 0 && (
                <div
                  className={cn(
                    "hidden sm:block h-px w-6 lg:w-10 mx-1",
                    isCompleted || isActive
                      ? "bg-[#02a2fd]"
                      : "bg-border"
                  )}
                />
              )}

              <Link href={`/project/${projectId}/${step.path}`}>
                <button
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                    isActive &&
                      "bg-gradient-to-r from-[#001278] to-[#02a2fd] text-white shadow-sm",
                    isCompleted &&
                      "bg-[#36bf78]/10 text-[#36bf78] hover:bg-[#36bf78]/20",
                    isPending &&
                      "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {/* Icon or checkmark */}
                  {isCompleted ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : (
                    <Icon className="h-4 w-4 shrink-0" />
                  )}

                  {/* Full label on md+, short label below */}
                  <span className="hidden md:inline">{step.label}</span>
                  <span className="md:hidden">{step.shortLabel}</span>
                </button>
              </Link>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
