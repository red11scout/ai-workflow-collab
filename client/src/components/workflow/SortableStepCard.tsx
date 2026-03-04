import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  User,
  Monitor,
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
import type { WorkflowStepData } from "@shared/types";
import { ACTOR_TYPES } from "@shared/constants";

interface SortableStepCardProps {
  step: WorkflowStepData;
  index: number;
  onUpdate: (data: Partial<WorkflowStepData>) => void;
  onDelete: () => void;
}

export default function SortableStepCard({
  step,
  index,
  onUpdate,
  onDelete,
}: SortableStepCardProps) {
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
    step.actorType === "human" ? (
      <User className="h-3 w-3" />
    ) : (
      <Monitor className="h-3 w-3" />
    );

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative transition-shadow",
        isDragging && "shadow-lg ring-2 ring-[#02a2fd]/30 opacity-90 z-50",
        step.isBottleneck && "border-amber-400/60",
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

        {/* Step number */}
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-[#001278]/10 text-[#001278] text-xs font-bold shrink-0 mt-0.5">
          {index + 1}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Compact row: name + actor + duration */}
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
                className="flex-1 min-w-[150px] px-2 py-0.5 rounded border border-[#02a2fd] bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-[#02a2fd]"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-sm font-medium text-foreground hover:text-[#02a2fd] transition-colors text-left truncate max-w-[280px]"
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

            {/* Bottleneck indicator */}
            {step.isBottleneck && (
              <Badge
                variant="outline"
                className="gap-1 text-[10px] border-amber-400 text-amber-600 shrink-0"
              >
                <AlertTriangle className="h-3 w-3" />
                Bottleneck
              </Badge>
            )}

            {/* Pain point count */}
            {step.painPoints.length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] border-red-300 text-red-500 shrink-0"
              >
                {step.painPoints.length} pain point
                {step.painPoints.length !== 1 ? "s" : ""}
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
                  placeholder="What happens in this step?"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd] resize-none"
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
                    placeholder="e.g. Analyst, SAP, Claude"
                    className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
                  />
                </div>
              </div>

              {/* Systems */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Systems Used
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
                  placeholder="Excel, SAP, Salesforce"
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
                />
              </div>

              {/* Pain Points */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Pain Points
                  <span className="text-muted-foreground font-normal ml-1">
                    (comma-separated)
                  </span>
                </label>
                <input
                  type="text"
                  value={step.painPoints.join(", ")}
                  onChange={(e) =>
                    onUpdate({
                      painPoints: parseCommaSeparated(e.target.value),
                    })
                  }
                  placeholder="Slow, error-prone, manual handoff"
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
                />
                {step.painPoints.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {step.painPoints.map((pp, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500"
                      >
                        {pp}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottleneck toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Bottleneck
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Marks this step as a constraint in the process.
                  </p>
                </div>
                <Switch
                  checked={step.isBottleneck}
                  onCheckedChange={(checked) =>
                    onUpdate({ isBottleneck: checked })
                  }
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
