/**
 * React context wrapping a HyperFormula instance for deterministic
 * workflow metrics calculations.
 *
 * Provides methods to create/update workflow sheets, read computed
 * metrics, build formula traces, and run scenario analysis.
 */

import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { HyperFormula } from "hyperformula";
import type {
  WorkflowMetrics,
  AggregateMetrics,
  FormulaTrace,
} from "@shared/types";
import {
  PARAM_COLS,
  METRIC_COLS,
  ROWS,
  MAX_STEP_COLS,
  AGGREGATE_SHEET_NAME,
  buildWorkflowFormulas,
  getFormulaTrace as buildTrace,
} from "@/lib/formula-sheets";
import type { ParamName, MetricName } from "@/lib/formula-sheets";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowParams {
  hourlyRate: number;
  adoptionRate: number;
  dataMaturity: number;
  annualRuns: number;
  implementCost: number;
}

interface FormulaContextValue {
  /** Raw HyperFormula engine reference (may be null before mount). */
  engine: HyperFormula | null;

  /** Destroy and recreate a workflow's sheet with full data. */
  rebuildWorkflowSheet: (
    workflowId: string,
    params: WorkflowParams,
    currentStepDurations: number[],
    aiStepDurations: number[],
    automationRate: number,
    hitlCount: number,
  ) => void;

  /** Update a single step duration cell. */
  updateStepDuration: (
    workflowId: string,
    phase: "current" | "ai",
    stepIndex: number,
    minutes: number,
  ) => void;

  /** Update a single parameter cell. */
  updateParameter: (
    workflowId: string,
    paramName: string,
    value: number,
  ) => void;

  /** Read all computed metrics for a workflow. */
  getWorkflowMetrics: (workflowId: string) => WorkflowMetrics | null;

  /** Sum metrics across all workflows. */
  getAggregateMetrics: () => AggregateMetrics;

  /** Build a formula trace for the formula inspector UI. */
  getFormulaTrace: (
    workflowId: string,
    metricName: string,
  ) => FormulaTrace | null;

  /**
   * Scale AI durations by 1/multiplier across all sheets.
   * conservative (<1) makes AI slower; aggressive (>1) makes AI faster.
   */
  setScenarioMultiplier: (multiplier: number) => void;

  /** Version counter — incremented on every HF mutation. */
  version: number;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const FormulaContext = createContext<FormulaContextValue | null>(null);

export function useFormula(): FormulaContextValue {
  const ctx = useContext(FormulaContext);
  if (!ctx) {
    throw new Error("useFormula must be used within a FormulaProvider");
  }
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface FormulaProviderProps {
  children: React.ReactNode;
}

export function FormulaProvider({ children }: FormulaProviderProps) {
  // Single HyperFormula instance for the lifetime of the provider
  const hfRef = useRef<HyperFormula | null>(null);

  // Map workflowId -> sheetId
  const sheetMapRef = useRef<Map<string, number>>(new Map());

  // Stores the original AI durations before scenario scaling
  const baseAiDurationsRef = useRef<Map<string, number[]>>(new Map());

  // Current scenario multiplier
  const scenarioMultiplierRef = useRef<number>(1.0);

  // Simple version counter for external subscription (useFormulaMetrics)
  const versionRef = useRef<number>(0);
  const [version, setVersion] = React.useState(0);

  const bumpVersion = useCallback(() => {
    versionRef.current += 1;
    setVersion(versionRef.current);
  }, []);

  // Lazy-init HyperFormula
  const getEngine = useCallback((): HyperFormula => {
    if (!hfRef.current) {
      hfRef.current = HyperFormula.buildEmpty({
        licenseKey: "gpl-v3",
      });
    }
    return hfRef.current;
  }, []);

  // ─── Sheet helpers ───────────────────────────────────────────────────────

  /** Convert workflowId to a safe HF sheet name. */
  const sheetName = useCallback(
    (workflowId: string) => `wf_${workflowId}`,
    [],
  );

  /** Remove a sheet if it exists. */
  const removeSheetIfExists = useCallback(
    (hf: HyperFormula, name: string) => {
      if (hf.doesSheetExist(name)) {
        const id = hf.getSheetId(name);
        if (id !== undefined) {
          hf.removeSheet(id);
        }
      }
    },
    [],
  );

  // ─── rebuildWorkflowSheet ────────────────────────────────────────────────

  const rebuildWorkflowSheet = useCallback(
    (
      workflowId: string,
      params: WorkflowParams,
      currentStepDurations: number[],
      aiStepDurations: number[],
      automationRate: number,
      hitlCount: number,
    ) => {
      const hf = getEngine();
      const name = sheetName(workflowId);

      // Remove old sheet
      removeSheetIfExists(hf, name);

      // Build sheet data (6 rows x MAX_STEP_COLS columns)
      const sheetData: (number | string | null)[][] = [];

      // Row 0: params (first 5 cols)
      const paramRow: (number | null)[] = new Array(MAX_STEP_COLS).fill(null);
      paramRow[PARAM_COLS.hourlyRate] = params.hourlyRate;
      paramRow[PARAM_COLS.adoptionRate] = params.adoptionRate;
      paramRow[PARAM_COLS.dataMaturity] = params.dataMaturity;
      paramRow[PARAM_COLS.annualRuns] = params.annualRuns;
      paramRow[PARAM_COLS.implementCost] = params.implementCost;
      sheetData.push(paramRow);

      // Row 1: current step durations
      const currentRow: (number | null)[] = new Array(MAX_STEP_COLS).fill(null);
      currentStepDurations.forEach((d, i) => {
        if (i < MAX_STEP_COLS) currentRow[i] = d;
      });
      sheetData.push(currentRow);

      // Row 2: AI step durations (apply scenario multiplier)
      const mult = scenarioMultiplierRef.current;
      const aiRow: (number | null)[] = new Array(MAX_STEP_COLS).fill(null);
      aiStepDurations.forEach((d, i) => {
        if (i < MAX_STEP_COLS) {
          aiRow[i] = mult !== 1.0 ? Math.round(d / mult) : d;
        }
      });
      sheetData.push(aiRow);

      // Row 3: formulas (first 9 cols)
      const formulas = buildWorkflowFormulas(name);
      const formulaRow: (string | null)[] = new Array(MAX_STEP_COLS).fill(null);
      formulas.forEach((f, i) => {
        formulaRow[i] = f;
      });
      sheetData.push(formulaRow);

      // Row 4: automationRate
      const autoRow: (number | null)[] = new Array(MAX_STEP_COLS).fill(null);
      autoRow[0] = automationRate;
      sheetData.push(autoRow);

      // Row 5: hitlCount
      const hitlRow: (number | null)[] = new Array(MAX_STEP_COLS).fill(null);
      hitlRow[0] = hitlCount;
      sheetData.push(hitlRow);

      // Add sheet — addSheet() returns the sheet name string;
      // use getSheetId() to get the numeric ID.
      hf.addSheet(name);
      const sheetId = hf.getSheetId(name);
      if (sheetId === undefined) return;

      hf.setSheetContent(sheetId, sheetData);
      sheetMapRef.current.set(workflowId, sheetId);

      // Store base AI durations for scenario scaling
      baseAiDurationsRef.current.set(workflowId, [...aiStepDurations]);

      bumpVersion();
    },
    [getEngine, sheetName, removeSheetIfExists, bumpVersion],
  );

  // ─── updateStepDuration ──────────────────────────────────────────────────

  const updateStepDuration = useCallback(
    (
      workflowId: string,
      phase: "current" | "ai",
      stepIndex: number,
      minutes: number,
    ) => {
      const hf = getEngine();
      const id = sheetMapRef.current.get(workflowId);
      if (id === undefined || stepIndex >= MAX_STEP_COLS) return;

      const row =
        phase === "current" ? ROWS.currentDurations : ROWS.aiDurations;

      hf.setCellContents(
        { sheet: id, row, col: stepIndex },
        [[minutes]],
      );

      // Update base durations if modifying AI phase
      if (phase === "ai") {
        const base = baseAiDurationsRef.current.get(workflowId) ?? [];
        base[stepIndex] = minutes;
        baseAiDurationsRef.current.set(workflowId, base);
      }

      bumpVersion();
    },
    [getEngine, bumpVersion],
  );

  // ─── updateParameter ─────────────────────────────────────────────────────

  const updateParameter = useCallback(
    (workflowId: string, paramName: string, value: number) => {
      const hf = getEngine();
      const id = sheetMapRef.current.get(workflowId);
      if (id === undefined) return;

      const col = PARAM_COLS[paramName as ParamName];
      if (col === undefined) return;

      hf.setCellContents(
        { sheet: id, row: ROWS.params, col },
        [[value]],
      );
      bumpVersion();
    },
    [getEngine, bumpVersion],
  );

  // ─── getWorkflowMetrics ──────────────────────────────────────────────────

  const getWorkflowMetrics = useCallback(
    (workflowId: string): WorkflowMetrics | null => {
      const hf = getEngine();
      const id = sheetMapRef.current.get(workflowId);
      if (id === undefined) return null;

      const num = (row: number, col: number): number => {
        const v = hf.getCellValue({ sheet: id, row, col });
        return typeof v === "number" ? v : 0;
      };

      return {
        currentTotalMinutes: num(ROWS.metrics, METRIC_COLS.currentTotal),
        aiTotalMinutes: num(ROWS.metrics, METRIC_COLS.aiTotal),
        timeReductionPct: num(ROWS.metrics, METRIC_COLS.timeReductionPct),
        currentAnnualCost: num(ROWS.metrics, METRIC_COLS.currentAnnualCost),
        aiAnnualCost: num(ROWS.metrics, METRIC_COLS.aiAnnualCost),
        annualSavings: num(ROWS.metrics, METRIC_COLS.annualSavings),
        costReductionPct: num(ROWS.metrics, METRIC_COLS.costReductionPct),
        automationRate: num(ROWS.automationRate, 0),
        hitlStepCount: num(ROWS.hitlCount, 0),
        throughputMultiplier: num(
          ROWS.metrics,
          METRIC_COLS.throughputMultiplier,
        ),
      };
    },
    [getEngine],
  );

  // ─── getAggregateMetrics ─────────────────────────────────────────────────

  const getAggregateMetrics = useCallback((): AggregateMetrics => {
    const entries = Array.from(sheetMapRef.current.keys());

    if (entries.length === 0) {
      return {
        totalAnnualTimeSavedHours: 0,
        totalAnnualSavings: 0,
        avgAutomationRate: 0,
        roi3Year: 0,
        paybackMonths: 0,
        workflowCount: 0,
      };
    }

    let totalSavings = 0;
    let totalTimeSavedMinutes = 0;
    let totalAutomationRate = 0;
    let totalImplementCost = 0;
    let totalAnnualSavingsForRoi = 0;

    for (const wfId of entries) {
      const m = getWorkflowMetrics(wfId);
      if (!m) continue;

      const timeSaved = m.currentTotalMinutes - m.aiTotalMinutes;
      totalTimeSavedMinutes += timeSaved;
      totalSavings += m.annualSavings;
      totalAutomationRate += m.automationRate;

      // Read implementCost from params
      const hf = getEngine();
      const id = sheetMapRef.current.get(wfId);
      if (id !== undefined) {
        const ic = hf.getCellValue({
          sheet: id,
          row: ROWS.params,
          col: PARAM_COLS.implementCost,
        });
        totalImplementCost += typeof ic === "number" ? ic : 0;

        // Read annualRuns-weighted savings for ROI
        totalAnnualSavingsForRoi += m.annualSavings;
      }
    }

    const workflowCount = entries.length;
    const avgAutomationRate =
      workflowCount > 0 ? totalAutomationRate / workflowCount : 0;

    const roi3Year =
      totalImplementCost > 0
        ? (totalAnnualSavingsForRoi * 3 - totalImplementCost) /
          totalImplementCost
        : 0;

    const paybackMonths =
      totalAnnualSavingsForRoi > 0
        ? (totalImplementCost / totalAnnualSavingsForRoi) * 12
        : 0;

    return {
      totalAnnualTimeSavedHours: totalTimeSavedMinutes / 60,
      totalAnnualSavings: totalSavings,
      avgAutomationRate,
      roi3Year,
      paybackMonths,
      workflowCount,
    };
  }, [getEngine, getWorkflowMetrics]);

  // ─── getFormulaTrace ─────────────────────────────────────────────────────

  const getFormulaTraceForWorkflow = useCallback(
    (workflowId: string, metricName: string): FormulaTrace | null => {
      const hf = getEngine();
      const id = sheetMapRef.current.get(workflowId);
      if (id === undefined) return null;

      const col = METRIC_COLS[metricName as MetricName];
      if (col === undefined) return null;

      return buildTrace(hf, id, col);
    },
    [getEngine],
  );

  // ─── setScenarioMultiplier ───────────────────────────────────────────────

  const setScenarioMultiplier = useCallback(
    (multiplier: number) => {
      const hf = getEngine();
      scenarioMultiplierRef.current = multiplier;

      // Re-apply to all workflow sheets
      const entries = Array.from(sheetMapRef.current.entries());
      for (const [wfId, sheetId] of entries) {
        const baseDurations = baseAiDurationsRef.current.get(wfId);
        if (!baseDurations) continue;

        const updates: [number, number][] = [];
        baseDurations.forEach((d, i) => {
          if (i < MAX_STEP_COLS) {
            const scaled =
              multiplier !== 1.0 ? Math.round(d / multiplier) : d;
            updates.push([i, scaled]);
          }
        });

        for (const [col, val] of updates) {
          hf.setCellContents(
            { sheet: sheetId, row: ROWS.aiDurations, col },
            [[val]],
          );
        }
      }

      bumpVersion();
    },
    [getEngine, bumpVersion],
  );

  // ─── Context value ───────────────────────────────────────────────────────

  const value = useMemo<FormulaContextValue>(
    () => ({
      engine: hfRef.current,
      rebuildWorkflowSheet,
      updateStepDuration,
      updateParameter,
      getWorkflowMetrics,
      getAggregateMetrics,
      getFormulaTrace: getFormulaTraceForWorkflow,
      setScenarioMultiplier,
      version,
    }),
    [
      rebuildWorkflowSheet,
      updateStepDuration,
      updateParameter,
      getWorkflowMetrics,
      getAggregateMetrics,
      getFormulaTraceForWorkflow,
      setScenarioMultiplier,
      version,
    ],
  );

  return (
    <FormulaContext.Provider value={value}>{children}</FormulaContext.Provider>
  );
}
