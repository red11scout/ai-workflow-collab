import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import SortableStepCard from "./SortableStepCard";
import type { WorkflowStepData } from "@shared/types";

interface DraggableStepListProps {
  steps: WorkflowStepData[];
  workflowId: string;
  onReorder: (stepIds: string[]) => void;
  onUpdateStep: (stepId: string, data: Partial<WorkflowStepData>) => void;
  onDeleteStep: (stepId: string) => void;
  phase: "current" | "ai";
}

export default function DraggableStepList({
  steps,
  workflowId: _workflowId,
  onReorder,
  onUpdateStep,
  onDeleteStep,
  phase: _phase,
}: DraggableStepListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(steps, oldIndex, newIndex);
    onReorder(reordered.map((s) => s.id));
  }

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-12 px-6 text-center">
        <p className="text-muted-foreground text-sm">
          No steps yet. Add one below or use AI Draft.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={steps.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {steps.map((step, index) => (
            <SortableStepCard
              key={step.id}
              step={step}
              index={index}
              onUpdate={(data) => onUpdateStep(step.id, data)}
              onDelete={() => onDeleteStep(step.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
