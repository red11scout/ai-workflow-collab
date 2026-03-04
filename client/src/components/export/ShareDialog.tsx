import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Link2, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ShareDialog({
  projectId,
  open,
  onOpenChange,
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  const shareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/projects/${projectId}/share`,
      );
      return res.json() as Promise<{ shareCode: string; url: string }>;
    },
  });

  // Generate share link when dialog opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && !shareMutation.data && !shareMutation.isPending) {
        shareMutation.mutate();
      }
      setCopied(false);
      onOpenChange(nextOpen);
    },
    [shareMutation, onOpenChange],
  );

  async function handleCopy() {
    if (!shareMutation.data?.url) return;
    try {
      await navigator.clipboard.writeText(shareMutation.data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input text
      const input = document.querySelector<HTMLInputElement>(
        "[data-share-url-input]",
      );
      if (input) {
        input.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-[#02a2fd]" />
            Share Report
          </DialogTitle>
          <DialogDescription>
            Anyone with this link can view the report. No login required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {shareMutation.isPending && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[#02a2fd]" />
              <span className="ml-2 text-sm text-muted-foreground">
                Generating link...
              </span>
            </div>
          )}

          {shareMutation.isError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {(shareMutation.error as Error).message}
            </div>
          )}

          {shareMutation.data && (
            <>
              <div className="flex items-center gap-2">
                <input
                  data-share-url-input
                  readOnly
                  value={shareMutation.data.url}
                  className="flex-1 rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopy}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    copied
                      ? "bg-[#36bf78] text-white"
                      : "bg-[#001278] text-white hover:bg-[#001278]/90",
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                This link does not expire. Share it with stakeholders, clients,
                or your team.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
