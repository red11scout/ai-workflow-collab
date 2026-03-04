import { useState, useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import { Home, Sun, Moon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import StepperNav from "./StepperNav";

interface LayoutProps {
  children: ReactNode;
  projectId?: string;
  currentStep?: number;
  companyName?: string;
}

export default function Layout({
  children,
  projectId,
  currentStep,
  companyName,
}: LayoutProps) {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ─── Sticky Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          {/* Left: Logo + breadcrumb */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-bold tracking-tight"
            >
              <span className="bg-gradient-to-r from-[#001278] to-[#02a2fd] bg-clip-text text-transparent dark:from-[#02a2fd] dark:to-[#36bf78]">
                BlueAlly
              </span>
              <span className="text-muted-foreground font-medium text-sm">
                AI Workflow
              </span>
            </Link>

            {companyName && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="truncate max-w-[200px] text-sm font-medium text-foreground">
                  {companyName}
                </span>
              </>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            <Link href="/">
              <button
                className={cn(
                  "inline-flex items-center justify-center rounded-md p-2",
                  "text-muted-foreground hover:text-foreground hover:bg-muted",
                  "transition-colors"
                )}
                aria-label="Home"
              >
                <Home className="h-4 w-4" />
              </button>
            </Link>

            <button
              onClick={() => setDark((d) => !d)}
              className={cn(
                "inline-flex items-center justify-center rounded-md p-2",
                "text-muted-foreground hover:text-foreground hover:bg-muted",
                "transition-colors"
              )}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* ─── Stepper Nav (below header, inside sticky zone) ──────── */}
        {projectId != null && currentStep != null && (
          <StepperNav
            projectId={projectId}
            currentStep={currentStep}
            completedSteps={[]}
          />
        )}
      </header>

      {/* ─── Main Content ───────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
