/**
 * HyperFormula sheet layout utility for deterministic workflow metrics.
 *
 * Each workflow gets a sheet with this layout:
 *   Row 0 (params): hourlyRate, adoptionRate(0-1), dataMaturity(0-1), annualRuns, implementCost
 *   Row 1 (current): up to 20 step durations in minutes
 *   Row 2 (ai):      up to 20 step durations in minutes
 *   Row 3 (derived): formulas referencing rows 0-2
 *   Row 4:           automationRate (set directly, not a HF formula)
 *   Row 5:           hitlCount     (set directly, not a HF formula)
 *
 * An aggregate sheet ("__aggregate") sums across all workflow sheets.
 */

import type { HyperFormula } from "hyperformula";
import type { FormulaTrace } from "@shared/types";

// ─── Parameter column positions (Row 0) ──────────────────────────────────────

export const PARAM_COLS = {
  hourlyRate: 0,
  adoptionRate: 1,
  dataMaturity: 2,
  annualRuns: 3,
  implementCost: 4,
} as const;

export type ParamName = keyof typeof PARAM_COLS;

// ─── Metric column positions (Row 3) ─────────────────────────────────────────

export const METRIC_COLS = {
  currentTotal: 0,
  aiTotal: 1,
  timeReductionPct: 2,
  currentAnnualCost: 3,
  aiAnnualCost: 4,
  annualSavings: 5,
  costReductionPct: 6,
  throughputMultiplier: 7,
  roi3Year: 8,
} as const;

export type MetricName = keyof typeof METRIC_COLS;

// ─── Row indices ─────────────────────────────────────────────────────────────

export const ROWS = {
  params: 0,
  currentDurations: 1,
  aiDurations: 2,
  metrics: 3,
  automationRate: 4,
  hitlCount: 5,
} as const;

/** Maximum number of step columns supported per phase. */
export const MAX_STEP_COLS = 20;

/** Name of the aggregate sheet that sums across all workflow sheets. */
export const AGGREGATE_SHEET_NAME = "__aggregate";

// ─── Formula builders ────────────────────────────────────────────────────────

/**
 * Builds the formula strings for row 3 of a given sheet.
 * Cell references are relative to the sheet identified by `sheetName`.
 */
export function buildWorkflowFormulas(sheetName: string): string[] {
  // Row references (1-indexed in HF formulas)
  const paramRow = ROWS.params + 1; // 1
  const currentRow = ROWS.currentDurations + 1; // 2
  const aiRow = ROWS.aiDurations + 1; // 3

  // Parameter cell references — column letters
  const hr = `'${sheetName}'!A${paramRow}`; // hourlyRate
  const ar = `'${sheetName}'!B${paramRow}`; // adoptionRate
  const dm = `'${sheetName}'!C${paramRow}`; // dataMaturity
  const runs = `'${sheetName}'!D${paramRow}`; // annualRuns
  const impl = `'${sheetName}'!E${paramRow}`; // implementCost

  // Sum ranges for step durations (A through T = columns 1-20)
  const currentRange = `'${sheetName}'!A${currentRow}:T${currentRow}`;
  const aiRange = `'${sheetName}'!A${aiRow}:T${aiRow}`;

  // Col 0: currentTotal — sum of all current step durations
  const currentTotal = `=SUM(${currentRange})`;

  // Col 1: aiTotal — sum of all AI step durations
  const aiTotal = `=SUM(${aiRange})`;

  // Col 2: timeReductionPct = (currentTotal - aiTotal) / currentTotal
  // Use A4 and B4 (the cells being computed in cols 0 and 1 of row 4, which is row 3 0-indexed)
  const metricRow = ROWS.metrics + 1; // 4
  const ctRef = `A${metricRow}`;
  const atRef = `B${metricRow}`;
  const timeReductionPct = `=IF(${ctRef}>0,(${ctRef}-${atRef})/${ctRef},0)`;

  // Col 3: currentAnnualCost = hourlyRate * (currentTotal/60) * adoptionRate * dataMaturity * annualRuns
  const currentAnnualCost = `=${hr}*(${ctRef}/60)*${ar}*${dm}*${runs}`;

  // Col 4: aiAnnualCost = hourlyRate * (aiTotal/60) * adoptionRate * dataMaturity * annualRuns
  const aiAnnualCost = `=${hr}*(${atRef}/60)*${ar}*${dm}*${runs}`;

  // Col 5: annualSavings = currentAnnualCost - aiAnnualCost
  const cacRef = `D${metricRow}`; // currentAnnualCost is col 3 = D
  const aacRef = `E${metricRow}`; // aiAnnualCost is col 4 = E
  const annualSavings = `=${cacRef}-${aacRef}`;

  // Col 6: costReductionPct = annualSavings / currentAnnualCost
  const savRef = `F${metricRow}`; // annualSavings is col 5 = F
  const costReductionPct = `=IF(${cacRef}>0,${savRef}/${cacRef},0)`;

  // Col 7: throughputMultiplier = IF(aiTotal > 0, currentTotal / aiTotal, 0)
  const throughputMultiplier = `=IF(${atRef}>0,${ctRef}/${atRef},0)`;

  // Col 8: roi3Year = IF(implementCost > 0, (annualSavings * 3 - implementCost) / implementCost, 0)
  const roi3Year = `=IF(${impl}>0,(${savRef}*3-${impl})/${impl},0)`;

  return [
    currentTotal,
    aiTotal,
    timeReductionPct,
    currentAnnualCost,
    aiAnnualCost,
    annualSavings,
    costReductionPct,
    throughputMultiplier,
    roi3Year,
  ];
}

// ─── Human-readable metric labels ────────────────────────────────────────────

const METRIC_LABELS: Record<MetricName, string> = {
  currentTotal: "Current Total (min)",
  aiTotal: "AI Total (min)",
  timeReductionPct: "Time Reduction %",
  currentAnnualCost: "Current Annual Cost",
  aiAnnualCost: "AI Annual Cost",
  annualSavings: "Annual Savings",
  costReductionPct: "Cost Reduction %",
  throughputMultiplier: "Throughput Multiplier",
  roi3Year: "3-Year ROI",
};

// ─── Formula trace helper ────────────────────────────────────────────────────

/**
 * Builds a FormulaTrace for the given metric in the given sheet.
 * Returns the raw formula, a version with values substituted in, the
 * computed result, and labeled inputs.
 */
export function getFormulaTrace(
  hf: HyperFormula,
  sheetId: number,
  metricCol: number,
): FormulaTrace | null {
  const metricRow = ROWS.metrics;

  // Get the formula string from the cell
  const formulaString = hf.getCellFormula({
    sheet: sheetId,
    row: metricRow,
    col: metricCol,
  });

  if (typeof formulaString !== "string") return null;

  // Read the computed result
  const rawResult = hf.getCellValue({
    sheet: sheetId,
    row: metricRow,
    col: metricCol,
  });
  const result =
    typeof rawResult === "number" ? rawResult.toFixed(4) : String(rawResult);

  // Gather inputs from params row
  const paramNames = Object.keys(PARAM_COLS) as ParamName[];
  const inputs: FormulaTrace["inputs"] = [];

  for (const name of paramNames) {
    const col = PARAM_COLS[name];
    const val = hf.getCellValue({ sheet: sheetId, row: ROWS.params, col });
    if (typeof val === "number") {
      inputs.push({ label: name, value: val, source: `Row 0, Col ${col}` });
    }
  }

  // Add currentTotal and aiTotal from row 3
  const ct = hf.getCellValue({
    sheet: sheetId,
    row: metricRow,
    col: METRIC_COLS.currentTotal,
  });
  const at = hf.getCellValue({
    sheet: sheetId,
    row: metricRow,
    col: METRIC_COLS.aiTotal,
  });
  if (typeof ct === "number") {
    inputs.push({
      label: "currentTotal",
      value: ct,
      source: `Row 3, Col ${METRIC_COLS.currentTotal}`,
    });
  }
  if (typeof at === "number") {
    inputs.push({
      label: "aiTotal",
      value: at,
      source: `Row 3, Col ${METRIC_COLS.aiTotal}`,
    });
  }

  // Build substituted string — replace cell references with their values
  let substituted = formulaString;
  for (const input of inputs) {
    // Simple replacement for readability; not a full parser
    substituted = substituted.replace(
      new RegExp(input.label, "gi"),
      String(input.value),
    );
  }

  const metricName =
    (Object.entries(METRIC_COLS).find(
      ([, col]) => col === metricCol,
    )?.[0] as MetricName) ?? `col_${metricCol}`;

  return {
    metricName: METRIC_LABELS[metricName] ?? metricName,
    formulaString,
    substituted,
    result,
    inputs,
  };
}
