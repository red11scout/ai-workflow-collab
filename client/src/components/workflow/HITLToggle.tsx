import { ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HITLToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** True when this is the only HITL step left in the workflow. */
  isLastHITL: boolean;
  className?: string;
}

export default function HITLToggle({
  checked,
  onChange,
  isLastHITL,
  className,
}: HITLToggleProps) {
  const blocked = checked && isLastHITL;

  function handleChange(value: boolean) {
    if (!value && isLastHITL) return; // enforce constraint
    onChange(value);
  }

  const toggle = (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors",
        checked
          ? "bg-amber-500/10 border border-amber-500/30"
          : "bg-muted/50 border border-transparent",
        className,
      )}
    >
      <ShieldCheck
        className={cn(
          "h-4 w-4 shrink-0",
          checked ? "text-amber-600" : "text-muted-foreground",
        )}
      />
      <span
        className={cn(
          "text-xs font-medium select-none",
          checked ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
        )}
      >
        Human Oversight
      </span>
      <Switch
        checked={checked}
        onCheckedChange={handleChange}
        disabled={blocked}
        className="ml-auto"
      />
    </div>
  );

  if (blocked) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{toggle}</TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-[220px] text-xs font-medium"
          >
            At least one step requires human oversight.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return toggle;
}
