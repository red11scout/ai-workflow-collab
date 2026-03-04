/**
 * TanStack Query hooks for loading and mutating workflow data.
 *
 * All mutations automatically invalidate the workflows query so the UI
 * stays in sync after server-side changes.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { WorkflowWithSteps, WorkflowStepData } from "@shared/types";

// ─── Query keys ──────────────────────────────────────────────────────────────

const workflowKeys = {
  all: (projectId: string) => ["/api/projects", projectId, "workflows"] as const,
  detail: (workflowId: string) => ["/api/workflows", workflowId] as const,
};

// ─── useWorkflowData ─────────────────────────────────────────────────────────

interface UseWorkflowDataResult {
  workflows: WorkflowWithSteps[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Load all workflows (with steps) for a project.
 */
export function useWorkflowData(projectId: string): UseWorkflowDataResult {
  const { data, isLoading, error } = useQuery<WorkflowWithSteps[]>({
    queryKey: workflowKeys.all(projectId),
    enabled: !!projectId,
  });

  return {
    workflows: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}

// ─── useUpdateStep ───────────────────────────────────────────────────────────

interface UpdateStepParams {
  stepId: string;
  changes: Partial<WorkflowStepData>;
  /** Used to invalidate the correct query. */
  projectId: string;
}

/**
 * Mutation for updating a single workflow step.
 * Invalidates the project's workflow list on success.
 */
export function useUpdateStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stepId, changes }: UpdateStepParams) => {
      const res = await apiRequest("PUT", `/api/steps/${stepId}`, changes);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.all(variables.projectId),
      });
    },
  });
}

// ─── useReorderSteps ─────────────────────────────────────────────────────────

interface ReorderStepsParams {
  workflowId: string;
  phase: "current" | "ai";
  stepIds: string[];
  /** Used to invalidate the correct query. */
  projectId: string;
}

/**
 * Mutation for reordering steps within a workflow phase.
 * Sends the new step ID ordering to the server.
 */
export function useReorderSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowId, phase, stepIds }: ReorderStepsParams) => {
      const res = await apiRequest(
        "PUT",
        `/api/workflows/${workflowId}/reorder`,
        { phase, stepIds },
      );
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.all(variables.projectId),
      });
    },
  });
}

// ─── useBatchCreateSteps ─────────────────────────────────────────────────────

interface BatchCreateStepsParams {
  workflowId: string;
  steps: Array<{
    phase: "current" | "ai";
    name: string;
    description?: string;
    actorType?: "human" | "system" | "ai_agent";
    actorName?: string;
    durationMinutes?: number;
    systems?: string[];
    painPoints?: string[];
    isBottleneck?: boolean;
    isDecisionPoint?: boolean;
    isAIEnabled?: boolean;
    isHumanInTheLoop?: boolean;
    aiCapabilities?: string[];
    automationLevel?: "full" | "assisted" | "supervised" | "manual";
    dataSources?: string[];
    dataOutputs?: string[];
  }>;
  /** Used to invalidate the correct query. */
  projectId: string;
}

/**
 * Mutation for batch-creating steps in a workflow.
 * Each step is created sequentially on the server.
 */
export function useBatchCreateSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowId, steps }: BatchCreateStepsParams) => {
      const results = [];
      for (const step of steps) {
        const res = await apiRequest(
          "POST",
          `/api/workflows/${workflowId}/steps`,
          step,
        );
        results.push(await res.json());
      }
      return results;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.all(variables.projectId),
      });
    },
  });
}

// ─── useDeleteStep ───────────────────────────────────────────────────────────

interface DeleteStepParams {
  stepId: string;
  /** Used to invalidate the correct query. */
  projectId: string;
}

/**
 * Mutation for deleting a single step.
 * Invalidates the project's workflow list on success.
 */
export function useDeleteStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stepId }: DeleteStepParams) => {
      const res = await apiRequest("DELETE", `/api/steps/${stepId}`);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.all(variables.projectId),
      });
    },
  });
}
