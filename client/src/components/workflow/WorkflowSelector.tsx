import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { WorkflowWithSteps } from "@shared/types";

interface WorkflowSelectorProps {
  workflows: WorkflowWithSteps[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function WorkflowSelector({
  workflows,
  activeId,
  onSelect,
}: WorkflowSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {workflows.map((wf) => {
        const isActive = wf.id === activeId;
        const stepCount = wf.currentSteps.length;

        return (
          <button
            key={wf.id}
            onClick={() => onSelect(wf.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              isActive
                ? "bg-gradient-to-r from-[#001278] to-[#02a2fd] text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
            )}
          >
            <span className="truncate max-w-[180px]">{wf.useCaseName}</span>
            <Badge
              variant={isActive ? "secondary" : "outline"}
              className={cn(
                "text-[10px] px-1.5 py-0",
                isActive
                  ? "bg-white/20 text-white border-white/30"
                  : "bg-transparent",
              )}
            >
              {stepCount}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
