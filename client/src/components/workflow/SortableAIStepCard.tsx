import { useState, useRef, useEffect, useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronRight,
  Bot,
  User,
  Monitor,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DurationInput from "./DurationInput";
import HITLToggle from "./HITLToggle";
import type { WorkflowStepData } from "@shared/types";
import { AUTOMATION_LEVELS, ACTOR_TYPES } from "@shared/constants";

interface SortableAIStepCardProps {
  step: WorkflowStepData;
  index: number;
  onUpdate: (data: Partial<WorkflowStepData>) => void;
  onDelete: () => void;
  /** True when this is the only HITL step in the workflow. */
  isLastHITL?: boolean;
}

const AUTOMATION_BADGE_STYLES: Record<string, string> = {
  full: "bg-[#36bf78]/10 text-[#36bf78] border-[#36bf78]/30",
  assisted: "bg-[#02a2fd]/10 text-[#02a2fd] border-[#02a2fd]/30",
  supervised: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  manual: "bg-muted text-muted-foreground border-border",
};

export default function SortableAIStepCard({
  step,
  index,
  onUpdate,
  onDelete,
  isLastHITL = false,
}: SortableAIStepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(step.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Sync name from props
  useEffect(() => {
    if (!editingName) setNameValue(step.name);
  }, [step.name, editingName]);

  // Focus input when editing begins
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const automationInfo = useMemo(
    () => AUTOMATION_LEVELS.find((l) => l.value === step.automationLevel),
    [step.automationLevel],
  );

  function saveName() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== step.name) {
      onUpdate({ name: trimmed });
    } else {
      setNameValue(step.name);
    }
    setEditingName(false);
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  function parseCommaSeparated(value: string): string[] {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const actorIcon =
    step.actorType === "ai_agent" ? (
      <Bot className="h-3 w-3" />
    ) : step.actorType === "system" ? (
      <Monitor className="h-3 w-3" />
    ) : (
      <User className="h-3 w-3" />
    );

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative transition-shadow",
        isDragging && "shadow-lg ring-2 ring-[#36bf78]/30 opacity-90 z-50",
        step.isHumanInTheLoop && "border-amber-400/60",
      )}
    >
      <div className="flex items-start gap-2 p-4">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Step number — blue-to-green gradient */}
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-br from-[#02a2fd] to-[#36bf78] text-white text-xs font-bold shrink-0 mt-0.5">
          {index + 1}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Compact row: name + actor + duration + automation badge */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Editable name */}
            {editingName ? (
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setNameValue(step.name);
                    setEditingName(false);
                  }
                }}
                className="flex-1 min-w-[150px] px-2 py-0.5 rounded border border-[#36bf78] bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-[#36bf78]"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-sm font-medium text-foreground hover:text-[#36bf78] transition-colors text-left truncate max-w-[280px]"
                title="Click to edit"
              >
                {step.name || "Untitled Step"}
              </button>
            )}

            {/* Actor badge */}
            <Badge
              variant="outline"
              className="gap-1 text-[10px] font-normal shrink-0"
            >
              {actorIcon}
              {step.actorName || step.actorType}
            </Badge>

            {/* Duration */}
            <DurationInput
              value={step.durationMinutes}
              onChange={(m) => onUpdate({ durationMinutes: m })}
              className="shrink-0"
            />

            {/* Automation level badge */}
            {step.automationLevel && step.automationLevel !== "manual" && (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 text-[10px] shrink-0",
                  AUTOMATION_BADGE_STYLES[step.automationLevel] ||
                    AUTOMATION_BADGE_STYLES.manual,
                )}
              >
                <Zap className="h-3 w-3" />
                {automationInfo?.label || step.automationLevel}
              </Badge>
            )}
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {expanded ? "Collapse" : "Details"}
          </button>

          {/* Expanded details */}
          {expanded && (
            <div className="space-y-3 pt-1 border-t border-border mt-2">
              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Description
                </label>
                <textarea
                  value={step.description}
                  onChange={(e) => onUpdate({ description: e.target.value })}
                  rows={2}
                  placeholder="What does this step accomplish?"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#36bf78]/50 focus:border-[#36bf78] resize-none"
                />
              </div>

              {/* Actor type + name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Actor Type
                  </label>
                  <Select
                    value={step.actorType}
                    onValueChange={(v) =>
                      onUpdate({
                        actorType: v as WorkflowStepData["actorType"],
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTOR_TYPES.map((at) => (
                        <SelectItem key={at.value} value={at.value}>
                          {at.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Actor Name
                  </label>
                  <input
                    type="text"
                    value={step.actorName}
                    onChange={(e) => onUpdate({ actorName: e.target.value })}
                    placeholder="e.g. Claude, Analyst, SAP"
                    className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#36bf78]/50 focus:border-[#36bf78]"
                  />
                </div>
              </div>

              {/* Automation level */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Automation Level
                </label>
                <Select
                  value={step.automationLevel}
                  onValueChange={(v) =>
                    onUpdate({
                      automationLevel: v as WorkflowStepData["automationLevel"],
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTOMATION_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* HITL toggle */}
              <HITLToggle
                checked={step.isHumanInTheLoop}
                onChange={(checked) => onUpdate({ isHumanInTheLoop: checked })}
                isLastHITL={isLastHITL}
              />

              {/* AI Enabled toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    AI-Enabled
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Step uses AI capabilities.
                  </p>
                </div>
                <Switch
                  checked={step.isAIEnabled}
                  onCheckedChange={(checked) =>
                    onUpdate({ isAIEnabled: checked })
                  }
                />
              </div>

              {/* AI Capabilities */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  AI Capabilities
                  <span className="text-muted-foreground font-normal ml-1">
                    (comma-separated)
                  </span>
                </label>
                <input
                  type="text"
                  value={step.aiCapabilities.join(", ")}
                  onChange={(e) =>
                    onUpdate({
                      aiCapabilities: parseCommaSeparated(e.target.value),
                    })
                  }
                  placeholder="NLP, classification, extraction"
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#36bf78]/50 focus:border-[#36bf78]"
                />
                {step.aiCapabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {step.aiCapabilities.map((cap, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-[#02a2fd]/10 text-[#02a2fd]"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Data Sources */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Data Sources
                  <span className="text-muted-foreground font-normal ml-1">
                    (comma-separated)
                  </span>
                </label>
                <input
                  type="text"
                  value={step.dataSources.join(", ")}
                  onChange={(e) =>
                    onUpdate({
                      dataSources: parseCommaSeparated(e.target.value),
                    })
                  }
                  placeholder="CRM, ERP, Knowledge Base"
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#36bf78]/50 focus:border-[#36bf78]"
                />
                {step.dataSources.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {step.dataSources.map((ds, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-[#36bf78]/10 text-[#36bf78]"
                      >
                        {ds}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Data Outputs */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Data Outputs
                  <span className="text-muted-foreground font-normal ml-1">
                    (comma-separated)
                  </span>
                </label>
                <input
                  type="text"
                  value={step.dataOutputs.join(", ")}
                  onChange={(e) =>
                    onUpdate({
                      dataOutputs: parseCommaSeparated(e.target.value),
                    })
                  }
                  placeholder="Report, alert, updated record"
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#36bf78]/50 focus:border-[#36bf78]"
                />
                {step.dataOutputs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {step.dataOutputs.map((out, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-[#001278]/10 text-[#001278] dark:bg-[#02a2fd]/10 dark:text-[#02a2fd]"
                      >
                        {out}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Systems */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Systems
                  <span className="text-muted-foreground font-normal ml-1">
                    (comma-separated)
                  </span>
                </label>
                <input
                  type="text"
                  value={step.systems.join(", ")}
                  onChange={(e) =>
                    onUpdate({ systems: parseCommaSeparated(e.target.value) })
                  }
                  placeholder="API Gateway, Vector DB, Salesforce"
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#36bf78]/50 focus:border-[#36bf78]"
                />
              </div>

              {/* Decision point toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Decision Point
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Requires judgment or branching logic.
                  </p>
                </div>
                <Switch
                  checked={step.isDecisionPoint}
                  onCheckedChange={(checked) =>
                    onUpdate({ isDecisionPoint: checked })
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={handleDeleteClick}
          className={cn(
            "mt-1 p-1.5 rounded-md transition-colors shrink-0",
            confirmDelete
              ? "bg-destructive/10 text-destructive"
              : "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
          )}
          title={confirmDelete ? "Click again to confirm" : "Delete step"}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  );
}
