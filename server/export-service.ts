import ExcelJS from "exceljs";
import type { WorkflowWithSteps, WorkflowStepData } from "../shared/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_HOURLY_RATE = 85;
const ANNUAL_RUNS = 2000;
const IMPLEMENTATION_COST = 250000;

const NAVY = "001278";
const BLUE = "02a2fd";
const GREEN = "36bf78";

interface ExportProject {
  name: string;
  companyName: string;
  industry: string;
  avgHourlyRate: number;
  adoptionRatePct: number;
  dataMaturityPct: number;
}

// ─── Metric Helpers ──────────────────────────────────────────────────────────

interface WfMetrics {
  currentTotalMin: number;
  aiTotalMin: number;
  timeReductionPct: number;
  annualSavings: number;
  automationRate: number;
  hitlCount: number;
  throughputMultiplier: number;
  currentAnnualCost: number;
  aiAnnualCost: number;
}

function computeMetrics(
  wf: WorkflowWithSteps,
  hourlyRate: number,
  adoptionRate: number,
  dataMaturity: number,
): WfMetrics {
  const currentTotalMin = wf.currentSteps.reduce(
    (sum, s) => sum + (s.durationMinutes || 0),
    0,
  );
  const aiTotalMin = wf.aiSteps.reduce(
    (sum, s) => sum + (s.durationMinutes || 0),
    0,
  );

  const timeReductionPct =
    currentTotalMin > 0
      ? (currentTotalMin - aiTotalMin) / currentTotalMin
      : 0;

  const rate = wf.hourlyRateOverride || hourlyRate || DEFAULT_HOURLY_RATE;

  const currentAnnualCost =
    rate * (currentTotalMin / 60) * adoptionRate * dataMaturity;
  const aiAnnualCost =
    rate * (aiTotalMin / 60) * adoptionRate * dataMaturity;

  let annualSavings: number;
  if (wf.frictionAnnualCost && wf.frictionAnnualCost > 0) {
    annualSavings = wf.frictionAnnualCost * timeReductionPct;
  } else {
    const timeSavedMin = currentTotalMin - aiTotalMin;
    annualSavings = (timeSavedMin / 60) * rate * ANNUAL_RUNS;
  }

  const totalAiSteps = wf.aiSteps.length;
  const aiEnabledCount = wf.aiSteps.filter((s) => s.isAIEnabled).length;
  const automationRate = totalAiSteps > 0 ? aiEnabledCount / totalAiSteps : 0;

  const hitlCount = wf.aiSteps.filter((s) => s.isHumanInTheLoop).length;

  const throughputMultiplier =
    aiTotalMin > 0 ? currentTotalMin / aiTotalMin : 1;

  return {
    currentTotalMin,
    aiTotalMin,
    timeReductionPct,
    annualSavings,
    automationRate,
    hitlCount,
    throughputMultiplier,
    currentAnnualCost,
    aiAnnualCost,
  };
}

// ─── Styling Helpers ─────────────────────────────────────────────────────────

function setHeaderRow(
  row: ExcelJS.Row,
  bgColor: string,
  fontColor: string = "FFFFFF",
): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: `FF${fontColor}` }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${bgColor}` },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

function setDataBorders(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

function autoWidth(sheet: ExcelJS.Worksheet): void {
  sheet.columns.forEach((col) => {
    const header = col.header;
    const baseWidth = typeof header === "string" ? header.length : 12;
    col.width = Math.max(baseWidth + 4, 14);
  });
}

// ─── Excel Generator ─────────────────────────────────────────────────────────

export async function generateExcelBuffer(
  project: ExportProject,
  workflows: WorkflowWithSteps[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BlueAlly AI Workflow Analysis";
  workbook.created = new Date();

  const hourlyRate = project.avgHourlyRate || DEFAULT_HOURLY_RATE;
  const adoptionRate = (project.adoptionRatePct || 100) / 100;
  const dataMaturity = (project.dataMaturityPct || 100) / 100;

  // Pre-compute metrics for all workflows
  const allMetrics = workflows.map((wf) =>
    computeMetrics(wf, hourlyRate, adoptionRate, dataMaturity),
  );

  // ── Sheet 1: Executive Summary ──────────────────────────────────────────

  const summarySheet = workbook.addWorksheet("Executive Summary");

  // Title
  const titleRow = summarySheet.addRow([
    `AI Workflow Analysis - ${project.companyName || project.name}`,
  ]);
  titleRow.getCell(1).font = {
    bold: true,
    size: 16,
    color: { argb: `FF${NAVY}` },
  };
  summarySheet.mergeCells("A1:B1");

  // Date
  const dateRow = summarySheet.addRow([
    `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
  ]);
  dateRow.getCell(1).font = { italic: true, size: 10, color: { argb: "FF666666" } };

  summarySheet.addRow([]); // blank

  summarySheet.addRow([`Industry: ${project.industry || "N/A"}`]);
  summarySheet.addRow([`Workflows Analyzed: ${workflows.length}`]);

  summarySheet.addRow([]); // blank
  summarySheet.addRow([]); // blank

  // Summary table headers
  const metricsHeaderRow = summarySheet.addRow(["Metric", "Value"]);
  setHeaderRow(metricsHeaderRow, NAVY);

  // Calculate aggregate values
  const totalTimeSavedMin = allMetrics.reduce(
    (sum, m) => sum + (m.currentTotalMin - m.aiTotalMin),
    0,
  );
  const totalTimeSavedHours = (totalTimeSavedMin / 60) * ANNUAL_RUNS;
  const totalAnnualSavings = allMetrics.reduce(
    (sum, m) => sum + m.annualSavings,
    0,
  );
  const avgAutomation =
    allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.automationRate, 0) /
        allMetrics.length
      : 0;
  const avgTimeReduction =
    allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.timeReductionPct, 0) /
        allMetrics.length
      : 0;

  const roi3Year =
    IMPLEMENTATION_COST > 0
      ? ((totalAnnualSavings * 3 - IMPLEMENTATION_COST) / IMPLEMENTATION_COST) * 100
      : 0;

  const paybackMonths =
    totalAnnualSavings > 0
      ? (IMPLEMENTATION_COST / totalAnnualSavings) * 12
      : 0;

  const summaryData: [string, any, string][] = [
    ["Total Annual Time Saved (hours)", totalTimeSavedHours, "#,##0"],
    ["Total Annual Savings ($)", totalAnnualSavings, "$#,##0"],
    ["Avg Automation Rate (%)", avgAutomation * 100, "0.0"],
    ["Avg Time Reduction (%)", avgTimeReduction * 100, "0.0"],
    ["3-Year ROI (%)", roi3Year, "0.0"],
    ["Payback Period (months)", paybackMonths, "0.0"],
  ];

  for (const [label, value, fmt] of summaryData) {
    const row = summarySheet.addRow([label, value]);
    row.getCell(2).numFmt = fmt;
    setDataBorders(row);
  }

  summarySheet.getColumn(1).width = 36;
  summarySheet.getColumn(2).width = 20;

  // ── Sheet 2: Workflow Comparisons ───────────────────────────────────────

  const compSheet = workbook.addWorksheet("Workflow Comparisons");

  const compHeaders = [
    "Workflow",
    "Phase",
    "Step #",
    "Step Name",
    "Description",
    "Actor",
    "Duration (min)",
    "Automation Level",
    "AI-Enabled",
    "HITL",
    "Pain Points",
  ];
  const compHeaderRow = compSheet.addRow(compHeaders);
  setHeaderRow(compHeaderRow, BLUE);

  for (let wi = 0; wi < workflows.length; wi++) {
    const wf = workflows[wi];

    // Workflow name row
    const nameRow = compSheet.addRow([wf.useCaseName]);
    nameRow.getCell(1).font = { bold: true, size: 12 };
    nameRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8E8E8" },
    };
    const nameRowNum = nameRow.number;
    compSheet.mergeCells(`A${nameRowNum}:K${nameRowNum}`);

    // Current steps
    for (const step of wf.currentSteps) {
      const row = compSheet.addRow([
        "",
        "Current",
        step.stepNumber,
        step.name,
        step.description || "",
        step.actorName || step.actorType,
        step.durationMinutes,
        step.automationLevel || "manual",
        step.isAIEnabled ? "Yes" : "No",
        step.isHumanInTheLoop ? "Yes" : "No",
        (step.painPoints || []).join("; "),
      ]);
      setDataBorders(row);
    }

    // AI steps
    for (const step of wf.aiSteps) {
      const row = compSheet.addRow([
        "",
        "AI-Powered",
        step.stepNumber,
        step.name,
        step.description || "",
        step.actorName || step.actorType,
        step.durationMinutes,
        step.automationLevel || "full",
        step.isAIEnabled ? "Yes" : "No",
        step.isHumanInTheLoop ? "Yes" : "No",
        (step.painPoints || []).join("; "),
      ]);
      setDataBorders(row);
    }

    // Blank separator between workflows
    if (wi < workflows.length - 1) {
      compSheet.addRow([]);
    }
  }

  autoWidth(compSheet);
  compSheet.getColumn(5).width = 40; // Description
  compSheet.getColumn(11).width = 30; // Pain Points

  // ── Sheet 3: Metrics Summary ────────────────────────────────────────────

  const metricsSheet = workbook.addWorksheet("Metrics Summary");

  const mHeaders = [
    "Workflow",
    "Current Duration",
    "AI Duration",
    "Time Reduction %",
    "Annual Savings",
    "Automation Rate %",
    "Throughput Gain",
    "HITL Steps",
  ];
  const mHeaderRow = metricsSheet.addRow(mHeaders);
  setHeaderRow(mHeaderRow, GREEN);

  for (let i = 0; i < workflows.length; i++) {
    const wf = workflows[i];
    const m = allMetrics[i];

    const row = metricsSheet.addRow([
      wf.useCaseName,
      `${m.currentTotalMin} min`,
      `${m.aiTotalMin} min`,
      m.timeReductionPct * 100,
      m.annualSavings,
      m.automationRate * 100,
      `${m.throughputMultiplier.toFixed(1)}x`,
      m.hitlCount,
    ]);

    row.getCell(4).numFmt = "0.0";
    row.getCell(5).numFmt = "$#,##0";
    row.getCell(6).numFmt = "0.0";
    setDataBorders(row);
  }

  autoWidth(metricsSheet);
  metricsSheet.getColumn(1).width = 40;

  // ── Sheet 4: Formula Audit ──────────────────────────────────────────────

  const formulaSheet = workbook.addWorksheet("Formula Audit");

  const fHeaders = ["Metric", "Formula", "Description"];
  const fHeaderRow = formulaSheet.addRow(fHeaders);
  setHeaderRow(fHeaderRow, NAVY);

  const formulaRows: [string, string, string][] = [
    [
      "Time Reduction",
      "(Current - AI) / Current",
      "Percentage reduction in total workflow duration after AI transformation",
    ],
    [
      "Annual Cost",
      "hourlyRate * (totalMin / 60) * adoptionRate * dataMaturity",
      "Annualized labor cost factoring in adoption rate and data maturity",
    ],
    [
      "Annual Savings",
      "currentAnnualCost - aiAnnualCost  (or frictionCost * timeReduction)",
      "Dollar savings from reduced time; uses friction cost when available",
    ],
    [
      "Throughput",
      "currentTotal / aiTotal",
      "Multiplier showing how many more runs can fit in same time window",
    ],
    [
      "ROI 3-Year",
      "(annualSavings * 3 - implementCost) / implementCost",
      `Three-year return on implementation investment ($${IMPLEMENTATION_COST.toLocaleString()})`,
    ],
    [
      "Payback Period",
      "(implementCost / annualSavings) * 12",
      "Months until cumulative savings recoup implementation cost",
    ],
    [
      "Automation Rate",
      "aiEnabledSteps / totalAISteps",
      "Percentage of AI-phase steps that have AI enablement",
    ],
  ];

  for (const [metric, formula, desc] of formulaRows) {
    const row = formulaSheet.addRow([metric, formula, desc]);
    setDataBorders(row);
  }

  formulaSheet.getColumn(1).width = 22;
  formulaSheet.getColumn(2).width = 55;
  formulaSheet.getColumn(3).width = 60;

  // ── Write Buffer ────────────────────────────────────────────────────────

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── HTML Report Generator ───────────────────────────────────────────────────

export function generateHtmlReport(
  project: ExportProject,
  workflows: WorkflowWithSteps[],
): string {
  const hourlyRate = project.avgHourlyRate || DEFAULT_HOURLY_RATE;
  const adoptionRate = (project.adoptionRatePct || 100) / 100;
  const dataMaturity = (project.dataMaturityPct || 100) / 100;

  const allMetrics = workflows.map((wf) =>
    computeMetrics(wf, hourlyRate, adoptionRate, dataMaturity),
  );

  // Aggregate metrics
  const totalTimeSavedMin = allMetrics.reduce(
    (sum, m) => sum + (m.currentTotalMin - m.aiTotalMin),
    0,
  );
  const totalTimeSavedHours = (totalTimeSavedMin / 60) * ANNUAL_RUNS;
  const totalAnnualSavings = allMetrics.reduce(
    (sum, m) => sum + m.annualSavings,
    0,
  );
  const avgAutomation =
    allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.automationRate, 0) /
        allMetrics.length
      : 0;
  const avgTimeReduction =
    allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.timeReductionPct, 0) /
        allMetrics.length
      : 0;
  const roi3Year =
    IMPLEMENTATION_COST > 0
      ? ((totalAnnualSavings * 3 - IMPLEMENTATION_COST) / IMPLEMENTATION_COST) * 100
      : 0;
  const paybackMonths =
    totalAnnualSavings > 0
      ? (IMPLEMENTATION_COST / totalAnnualSavings) * 12
      : 0;

  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const companyName = project.companyName || project.name || "Project";

  // Build workflow sections
  const workflowSections = workflows
    .map((wf, wi) => {
      const m = allMetrics[wi];

      const currentRows = wf.currentSteps
        .map(
          (s) => `
        <tr>
          <td>${s.stepNumber}</td>
          <td>${esc(s.name)}</td>
          <td>${esc(s.description || "")}</td>
          <td>${esc(s.actorName || s.actorType)}</td>
          <td class="num">${s.durationMinutes} min</td>
          <td>${s.automationLevel || "manual"}</td>
        </tr>`,
        )
        .join("\n");

      const aiRows = wf.aiSteps
        .map(
          (s) => `
        <tr>
          <td>${s.stepNumber}</td>
          <td>${esc(s.name)}</td>
          <td>${esc(s.description || "")}</td>
          <td>${esc(s.actorName || s.actorType)}</td>
          <td class="num">${s.durationMinutes} min</td>
          <td>${s.automationLevel || "full"}</td>
        </tr>`,
        )
        .join("\n");

      return `
      <div class="workflow-section ${wi > 0 ? "page-break" : ""}">
        <h2>${esc(wf.useCaseName)}</h2>
        <div class="wf-meta">
          <span><strong>Function:</strong> ${esc(wf.businessFunction || "N/A")}</span>
          <span><strong>Theme:</strong> ${esc(wf.strategicTheme || "N/A")}</span>
          <span><strong>Pattern:</strong> ${esc(wf.agenticPattern || "N/A")}</span>
        </div>

        <div class="metrics-row">
          <div class="mini-metric">
            <div class="mini-value">${(m.timeReductionPct * 100).toFixed(0)}%</div>
            <div class="mini-label">Time Reduction</div>
          </div>
          <div class="mini-metric">
            <div class="mini-value">$${formatNumber(m.annualSavings)}</div>
            <div class="mini-label">Annual Savings</div>
          </div>
          <div class="mini-metric">
            <div class="mini-value">${(m.automationRate * 100).toFixed(0)}%</div>
            <div class="mini-label">Automation Rate</div>
          </div>
          <div class="mini-metric">
            <div class="mini-value">${m.throughputMultiplier.toFixed(1)}x</div>
            <div class="mini-label">Throughput</div>
          </div>
        </div>

        <h3>Current State</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Step</th>
              <th>Description</th>
              <th>Actor</th>
              <th>Duration</th>
              <th>Automation</th>
            </tr>
          </thead>
          <tbody>
            ${currentRows}
          </tbody>
        </table>

        <h3>AI-Powered State</h3>
        <table>
          <thead>
            <tr class="ai-header">
              <th>#</th>
              <th>Step</th>
              <th>Description</th>
              <th>Actor</th>
              <th>Duration</th>
              <th>Automation</th>
            </tr>
          </thead>
          <tbody>
            ${aiRows}
          </tbody>
        </table>
      </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Workflow Analysis - ${esc(companyName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'DM Sans', sans-serif;
      color: #1a1a2e;
      background: #fff;
      line-height: 1.6;
      font-size: 14px;
    }

    .cover {
      background: linear-gradient(135deg, #${NAVY} 0%, #1a237e 100%);
      color: #fff;
      padding: 80px 60px;
      min-height: 280px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .cover h1 {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .cover .subtitle {
      font-size: 18px;
      opacity: 0.85;
      font-weight: 400;
    }
    .cover .date {
      margin-top: 24px;
      font-size: 13px;
      opacity: 0.7;
    }
    .cover .industry-badge {
      display: inline-block;
      margin-top: 12px;
      padding: 4px 16px;
      background: rgba(255,255,255,0.15);
      border-radius: 20px;
      font-size: 13px;
    }

    .container { max-width: 1100px; margin: 0 auto; padding: 40px 60px; }

    h2 {
      font-size: 22px;
      font-weight: 700;
      color: #${NAVY};
      margin-bottom: 16px;
      border-bottom: 3px solid #${BLUE};
      padding-bottom: 6px;
    }

    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin: 24px 0 10px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 30px 0 40px;
    }
    .metric-card {
      background: #f8f9fc;
      border: 1px solid #e2e5f1;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
    }
    .metric-card .value {
      font-size: 32px;
      font-weight: 700;
      color: #${NAVY};
    }
    .metric-card .label {
      font-size: 13px;
      color: #666;
      margin-top: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 13px;
    }
    th {
      background: #${NAVY};
      color: #fff;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
    }
    tr.ai-header th {
      background: #${GREEN};
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid #e8e8e8;
    }
    tr:nth-child(even) td { background: #fafafa; }
    .num { text-align: right; }

    .wf-meta {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      font-size: 13px;
      color: #555;
    }

    .metrics-row {
      display: flex;
      gap: 16px;
      margin: 16px 0 24px;
    }
    .mini-metric {
      flex: 1;
      background: #f0f4ff;
      border-radius: 8px;
      padding: 14px;
      text-align: center;
    }
    .mini-value {
      font-size: 22px;
      font-weight: 700;
      color: #${NAVY};
    }
    .mini-label {
      font-size: 11px;
      color: #666;
      margin-top: 2px;
    }

    .workflow-section { margin-bottom: 48px; }

    .footer {
      margin-top: 60px;
      padding: 24px 60px;
      background: #f8f9fc;
      border-top: 3px solid #${BLUE};
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #888;
    }
    .footer strong { color: #${NAVY}; }

    /* ── Print Styles ─────────────────────────────────────────────────── */
    @media print {
      body { font-size: 11px; }
      .cover { padding: 50px 40px; min-height: 200px; }
      .cover h1 { font-size: 28px; }
      .container { padding: 20px 40px; }
      .summary-grid { grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .metric-card { padding: 14px; }
      .metric-card .value { font-size: 24px; }
      .page-break { page-break-before: always; }
      .footer { position: fixed; bottom: 0; left: 0; right: 0; }
      @page { margin: 0.5in; }
    }
  </style>
</head>
<body>

  <div class="cover">
    <h1>${esc(companyName)}</h1>
    <div class="subtitle">AI Workflow Analysis</div>
    <div class="industry-badge">${esc(project.industry || "N/A")}</div>
    <div class="date">${dateStr}</div>
  </div>

  <div class="container">
    <h2>Executive Summary</h2>
    <div class="summary-grid">
      <div class="metric-card">
        <div class="value">${formatNumber(totalTimeSavedHours)}</div>
        <div class="label">Annual Hours Saved</div>
      </div>
      <div class="metric-card">
        <div class="value">$${formatNumber(totalAnnualSavings)}</div>
        <div class="label">Annual Savings</div>
      </div>
      <div class="metric-card">
        <div class="value">${(avgAutomation * 100).toFixed(0)}%</div>
        <div class="label">Avg Automation Rate</div>
      </div>
      <div class="metric-card">
        <div class="value">${(avgTimeReduction * 100).toFixed(0)}%</div>
        <div class="label">Avg Time Reduction</div>
      </div>
      <div class="metric-card">
        <div class="value">${roi3Year.toFixed(0)}%</div>
        <div class="label">3-Year ROI</div>
      </div>
      <div class="metric-card">
        <div class="value">${paybackMonths.toFixed(1)} mo</div>
        <div class="label">Payback Period</div>
      </div>
    </div>

    ${workflowSections}
  </div>

  <div class="footer">
    <div><strong>Powered by BlueAlly</strong></div>
    <div>${dateStr}</div>
  </div>

</body>
</html>`;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
