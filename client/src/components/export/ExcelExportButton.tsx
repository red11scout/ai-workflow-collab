import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface ExcelExportButtonProps {
  projectId: string;
  disabled?: boolean;
}

export default function ExcelExportButton({
  projectId,
  disabled = false,
}: ExcelExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/projects/${projectId}/export/excel`,
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "workflow-analysis.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Excel exported",
        description: "Your workbook is downloading.",
      });
    } catch (err: any) {
      toast({
        title: "Export failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors",
        "hover:bg-muted/80 hover:border-[#36bf78]/40",
        "disabled:opacity-40 disabled:cursor-not-allowed",
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-4 w-4 text-[#36bf78]" />
      )}
      Export Excel
    </button>
  );
}
