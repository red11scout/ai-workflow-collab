import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { MessageSquare, X, Send, RotateCcw, Sparkles } from "lucide-react";
import { getOwnerToken } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AIAssistantProps {
  projectId: string;
  workflowId?: string;
  section: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Section-specific suggested prompts ──────────────────────────────────────

const SUGGESTED_PROMPTS: Record<string, string[]> = {
  import: [
    "What use cases should I prioritize?",
    "Explain the friction points",
    "How should I set workforce parameters?",
  ],
  mapping: [
    "Help me identify missing steps",
    "What are common bottlenecks?",
    "Suggest pain points for this process",
  ],
  generation: [
    "Explain the AI approach",
    "What agentic pattern was used?",
    "How does HITL work here?",
  ],
  refine: [
    "How can I improve this workflow?",
    "Are the metrics reasonable?",
    "What steps could be consolidated?",
  ],
  dashboard: [
    "Summarize the ROI story",
    "What are the key risks?",
    "Help me present these findings",
    "What are the quick wins?",
  ],
};

// ─── Minimal markdown renderer ───────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    // Code blocks (``` ... ```)
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre class="bg-muted rounded-md p-3 my-2 overflow-x-auto text-xs font-mono"><code>$2</code></pre>',
    )
    // Inline code
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">$1</code>',
    )
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Line breaks (double newline = paragraph break)
    .replace(/\n\n/g, '<div class="h-2"></div>')
    .replace(/\n/g, "<br />");
}

// ─── Typing indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-muted-foreground ml-1">Thinking...</span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AIAssistant({
  projectId,
  workflowId,
  section,
}: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(
    null,
  );
  const [hasAnimated, setHasAnimated] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const prompts = SUGGESTED_PROMPTS[section] ?? SUGGESTED_PROMPTS.dashboard;

  // Remove pulse animation after first render cycle
  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isStreaming]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMessage: ChatMessage = { role: "user", content: text.trim() };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setError(null);
      setLastFailedMessage(null);
      setIsStreaming(true);

      // Create abort controller for this request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/ai/assist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-owner-token": getOwnerToken(),
          },
          body: JSON.stringify({
            projectId,
            workflowId,
            section,
            message: text.trim(),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => response.statusText);
          throw new Error(`${response.status}: ${errText}`);
        }

        if (!response.body) {
          throw new Error("No response body received");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        let buffer = "";

        // Add empty assistant message that we will accumulate into
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const jsonStr = trimmed.slice(6);
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);

              if (parsed.done) {
                // Stream finished
                break;
              }

              if (parsed.token) {
                assistantContent += parsed.token;
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: assistantContent,
                    };
                  }
                  return updated;
                });
              }

              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (parseErr) {
              // Skip malformed JSON lines silently — common with SSE
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }

        // If no content was received at all, show a fallback
        if (!assistantContent.trim()) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant" && !last.content.trim()) {
              updated[updated.length - 1] = {
                ...last,
                content: "I wasn't able to generate a response. Please try again.",
              };
            }
            return updated;
          });
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;

        const errorMsg =
          err.message || "Something went wrong. Please try again.";
        setError(errorMsg);
        setLastFailedMessage(text.trim());

        // Remove the empty assistant message if there was an error before any content
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.content.trim()) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [projectId, workflowId, section, isStreaming],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      sendMessage(lastFailedMessage);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  // ─── Collapsed state: floating button ──────────────────────────────────────

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "h-14 w-14 rounded-full shadow-xl",
          "bg-gradient-to-br from-[#001278] to-[#02a2fd]",
          "text-white flex items-center justify-center",
          "hover:shadow-2xl hover:scale-105",
          "transition-all duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          !hasAnimated && "animate-pulse",
        )}
        aria-label="Open AI Assistant"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }

  // ─── Expanded state: chat panel ────────────────────────────────────────────

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "w-96 flex flex-col",
        "rounded-2xl border border-border bg-background shadow-xl",
        "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200",
      )}
      style={{ maxHeight: "500px" }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3",
          "rounded-t-2xl",
          "bg-gradient-to-r from-[#001278] to-[#02a2fd]",
          "text-white",
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold tracking-tight">
            AI Assistant
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded-md p-1 hover:bg-white/20 transition-colors"
          aria-label="Minimize assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Messages area ───────────────────────────────────────────────── */}
      <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
        <div className="p-4 space-y-3" style={{ maxHeight: "360px" }}>
          {/* Suggested prompts when no messages */}
          {messages.length === 0 && !isStreaming && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground text-center">
                Ask me anything about your workflows
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full",
                      "border border-border bg-muted/50",
                      "hover:bg-muted hover:border-primary/30",
                      "text-foreground transition-colors",
                    )}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-gradient-to-br from-[#001278] to-[#02a2fd] text-white rounded-br-sm"
                    : "bg-card border border-border text-card-foreground rounded-bl-sm",
                )}
              >
                {msg.role === "assistant" ? (
                  <div
                    className="prose-sm [&_strong]:font-semibold [&_em]:italic [&_code]:text-[0.8em] [&_pre]:text-[0.8em] [&_li]:text-sm"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(msg.content),
                    }}
                  />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {isStreaming &&
            messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-xl rounded-bl-sm">
                  <TypingIndicator />
                </div>
              </div>
            )}

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center gap-2 py-2">
              <p className="text-xs text-destructive text-center">{error}</p>
              {lastFailedMessage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="text-xs gap-1.5"
                >
                  <RotateCcw className="h-3 w-3" />
                  Retry
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Input area ──────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-border px-3 py-2 flex items-center gap-2"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this workflow..."
          disabled={isStreaming}
          className="flex-1 h-9 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isStreaming}
          className={cn(
            "h-8 w-8 shrink-0 rounded-full",
            "bg-gradient-to-br from-[#001278] to-[#02a2fd]",
            "hover:opacity-90 transition-opacity",
            "disabled:opacity-40",
          )}
        >
          <Send className="h-3.5 w-3.5 text-white" />
        </Button>
      </form>
    </div>
  );
}
