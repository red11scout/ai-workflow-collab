import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface DurationInputProps {
  value: number;
  onChange: (minutes: number) => void;
  className?: string;
}

export default function DurationInput({
  value,
  onChange,
  className,
}: DurationInputProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <input
        type="number"
        min={1}
        max={480}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v) && v >= 1 && v <= 480) {
            onChange(v);
          }
        }}
        className="w-16 px-2 py-1 rounded-md border border-input bg-background text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
      />
      <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
        {formatDuration(value)}
      </span>
    </div>
  );
}
