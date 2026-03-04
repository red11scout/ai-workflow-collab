import { FileSpreadsheet } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface ExcelExportButtonProps {
  projectId: string;
  disabled?: boolean;
}

export default function ExcelExportButton({
  projectId,
  disabled = false,
}: ExcelExportButtonProps) {
  function handleClick() {
    toast({
      title: "Coming soon",
      description: "Excel export will be available in Phase 4.",
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors",
        "hover:bg-muted/80 hover:border-[#36bf78]/40",
        "disabled:opacity-40 disabled:cursor-not-allowed",
      )}
    >
      <FileSpreadsheet className="h-4 w-4 text-[#36bf78]" />
      Export Excel
    </button>
  );
}
