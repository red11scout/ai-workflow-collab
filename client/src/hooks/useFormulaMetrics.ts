/**
 * Hook that subscribes to HyperFormula changes for a specific workflow.
 *
 * Uses useSyncExternalStore with a version counter pattern so components
 * re-render only when the HF engine has been mutated (via FormulaContext).
 */

import { useCallback, useSyncExternalStore } from "react";
import { useFormula } from "@/contexts/FormulaContext";
import type { WorkflowMetrics, FormulaTrace } from "@shared/types";
import type { MetricName } from "@/lib/formula-sheets";

interface FormulaMetricsResult {
  metrics: WorkflowMetrics | null;
  getTrace: (metricName: MetricName) => FormulaTrace | null;
}

/**
 * Subscribe to computed HyperFormula metrics for a single workflow.
 *
 * Re-renders when the FormulaContext version counter changes (i.e. after
 * any cell mutation, sheet rebuild, or scenario change).
 */
export function useFormulaMetrics(workflowId: string): FormulaMetricsResult {
  const {
    getWorkflowMetrics,
    getFormulaTrace,
    version,
  } = useFormula();

  // Build a stable snapshot keyed by version + workflowId.
  // useSyncExternalStore requires a getSnapshot that returns the same
  // reference when nothing has changed. We rely on version as the change
  // signal, and produce a new object only when version ticks.
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // We piggyback on React state updates from FormulaContext's
      // version state. Since `version` is in the dependency array of
      // the hook, React will re-render us when it changes, which is
      // sufficient. The subscribe/onStoreChange pattern is for external
      // stores — here we just wire it up minimally.
      //
      // This is a no-op subscription because the version change is
      // already tracked via the useFormula() hook's reactive state.
      // useSyncExternalStore will re-call getSnapshot on every render.
      const noop = () => {};
      return noop;
    },
    [],
  );

  const getSnapshot = useCallback((): number => {
    return version;
  }, [version]);

  // Trigger re-render when version changes
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const metrics = getWorkflowMetrics(workflowId);

  const getTrace = useCallback(
    (metricName: MetricName): FormulaTrace | null => {
      return getFormulaTrace(workflowId, metricName);
    },
    [workflowId, getFormulaTrace],
  );

  return { metrics, getTrace };
}
