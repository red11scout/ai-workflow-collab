import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type {
  ProjectWithWorkflows,
  WorkflowWithSteps,
} from "@shared/types";
import { DEFAULT_PARAMS } from "@shared/constants";

// ─── Colors ──────────────────────────────────────────────────────────────────

const NAVY = "#001278";
const BLUE = "#02a2fd";
const GREEN = "#36bf78";
const CORAL = "#e05252";
const LIGHT_BG = "#f5f7fa";
const DARK_TEXT = "#1a1a2e";
const GRAY_TEXT = "#6b7280";
const WHITE = "#ffffff";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function fmtPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function fmtDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Workflow metric calculation ─────────────────────────────────────────────

interface WfMetrics {
  currentMinutes: number;
  aiMinutes: number;
  timeReduction: number;
  annualSavings: number;
  automationRate: number;
  throughputMultiplier: number;
}

function calcWorkflowMetrics(wf: WorkflowWithSteps): WfMetrics {
  const currentSteps = wf.currentSteps || [];
  const aiSteps = wf.aiSteps || [];

  const currentMinutes = currentSteps.reduce((s, st) => s + st.durationMinutes, 0);
  const aiMinutes = aiSteps.reduce((s, st) => s + st.durationMinutes, 0);

  const timeReduction = currentMinutes > 0 ? (currentMinutes - aiMinutes) / currentMinutes : 0;
  const hourlyRate = wf.hourlyRateOverride || DEFAULT_PARAMS.avgHourlyRate;
  const timeSaved = currentMinutes - aiMinutes;

  const annualSavings =
    wf.frictionAnnualCost > 0
      ? wf.frictionAnnualCost * timeReduction
      : (timeSaved / 60) * hourlyRate * DEFAULT_PARAMS.annualRunsPerWorkflow;

  const automationRate =
    aiSteps.length > 0
      ? aiSteps.filter((s) => s.isAIEnabled).length / aiSteps.length
      : 0;

  const throughputMultiplier = aiMinutes > 0 ? currentMinutes / aiMinutes : 0;

  return { currentMinutes, aiMinutes, timeReduction, annualSavings, automationRate, throughputMultiplier };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── Cover page ──
  coverPage: {
    backgroundColor: NAVY,
    padding: 60,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  coverTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 28,
    color: WHITE,
    marginBottom: 16,
    textAlign: "center",
  },
  coverCompany: {
    fontFamily: "Helvetica",
    fontSize: 20,
    color: WHITE,
    opacity: 0.9,
    marginBottom: 8,
    textAlign: "center",
  },
  coverIndustry: {
    fontFamily: "Helvetica",
    fontSize: 14,
    color: WHITE,
    opacity: 0.7,
    textAlign: "center",
  },
  coverFooter: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    textAlign: "center",
  },
  coverDate: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: WHITE,
    opacity: 0.6,
    marginBottom: 6,
  },
  coverBrand: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: WHITE,
    opacity: 0.5,
  },

  // ── Generic page ──
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK_TEXT,
  },
  pageTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    color: NAVY,
    marginBottom: 20,
  },

  // ── Executive summary metric grid ──
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricBox: {
    width: "31%",
    backgroundColor: LIGHT_BG,
    borderRadius: 6,
    padding: 14,
  },
  metricLabel: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: GRAY_TEXT,
    marginBottom: 4,
    textTransform: "uppercase" as const,
  },
  metricValueNavy: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: NAVY,
  },
  metricValueGreen: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: GREEN,
  },

  // ── Workflow pages ──
  wfTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: NAVY,
    marginBottom: 4,
  },
  wfSubtitle: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: GRAY_TEXT,
    marginBottom: 14,
  },
  columnsRow: {
    flexDirection: "row",
    gap: 16,
  },
  column: {
    flex: 1,
  },
  colHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
  },
  colHeaderCurrent: {
    color: CORAL,
    borderBottomColor: CORAL,
  },
  colHeaderAI: {
    color: GREEN,
    borderBottomColor: GREEN,
  },

  // ── Step card ──
  stepCard: {
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  stepName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: DARK_TEXT,
    maxWidth: "70%",
  },
  stepDuration: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: BLUE,
  },
  stepDetail: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: GRAY_TEXT,
    marginTop: 1,
  },
  badge: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    color: WHITE,
    backgroundColor: GREEN,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  hitlBadge: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    color: WHITE,
    backgroundColor: BLUE,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    alignSelf: "flex-start",
    marginTop: 2,
    marginLeft: 4,
  },
  painPoint: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: CORAL,
    marginTop: 1,
  },

  // ── Mini metrics bar ──
  miniBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  miniMetric: {
    alignItems: "center",
  },
  miniLabel: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: GRAY_TEXT,
    marginBottom: 2,
  },
  miniValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: NAVY,
  },

  // ── Footer ──
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: GRAY_TEXT,
  },
});

// ─── Cover Page ──────────────────────────────────────────────────────────────

function CoverPage({ project }: { project: ProjectWithWorkflows }) {
  return (
    <Page size="A4" style={s.coverPage}>
      <Text style={s.coverTitle}>AI Workflow Analysis</Text>
      <Text style={s.coverCompany}>{project.companyName || "Company Report"}</Text>
      {project.industry ? (
        <Text style={s.coverIndustry}>{project.industry}</Text>
      ) : null}
      <View style={s.coverFooter}>
        <Text style={s.coverDate}>{fmtDate()}</Text>
        <Text style={s.coverBrand}>Powered by BlueAlly</Text>
      </View>
    </Page>
  );
}

// ─── Executive Summary ───────────────────────────────────────────────────────

function ExecSummaryPage({ project }: { project: ProjectWithWorkflows }) {
  const workflows = project.workflows || [];

  let totalTimeSavedMin = 0;
  let totalSavings = 0;
  let totalAutomation = 0;
  let totalThroughput = 0;

  for (const wf of workflows) {
    const m = calcWorkflowMetrics(wf);
    totalTimeSavedMin += m.currentMinutes - m.aiMinutes;
    totalSavings += m.annualSavings;
    totalAutomation += m.automationRate;
    totalThroughput += m.throughputMultiplier;
  }

  const count = workflows.length || 1;
  const timeSavedHours = totalTimeSavedMin / 60;
  const avgAutomation = totalAutomation / count;
  const avgTimeReduction = workflows.length > 0
    ? workflows.reduce((s, wf) => s + calcWorkflowMetrics(wf).timeReduction, 0) / count
    : 0;

  const implementCost = DEFAULT_PARAMS.implementationCost * workflows.length;
  const roi3Year = implementCost > 0 ? (totalSavings * 3 - implementCost) / implementCost : 0;
  const paybackMonths = totalSavings > 0 ? (implementCost / totalSavings) * 12 : 0;

  const metrics = [
    { label: "Annual Time Saved", value: timeSavedHours >= 1000 ? `${(timeSavedHours / 1000).toFixed(1)}K hrs` : `${Math.round(timeSavedHours)} hrs`, isGreen: true },
    { label: "Annual Savings", value: fmtCurrency(totalSavings), isGreen: false },
    { label: "Avg Automation Rate", value: fmtPercent(avgAutomation), isGreen: true },
    { label: "Avg Time Reduction", value: fmtPercent(avgTimeReduction), isGreen: true },
    { label: "3-Year ROI", value: fmtPercent(roi3Year), isGreen: false },
    { label: "Payback Period", value: paybackMonths > 0 ? `${paybackMonths.toFixed(1)} mo` : "--", isGreen: false },
  ];

  return (
    <Page size="A4" style={s.page}>
      <Text style={s.pageTitle}>Executive Summary</Text>
      <View style={s.metricsGrid}>
        {metrics.map((m) => (
          <View key={m.label} style={s.metricBox}>
            <Text style={s.metricLabel}>{m.label}</Text>
            <Text style={m.isGreen ? s.metricValueGreen : s.metricValueNavy}>
              {m.value}
            </Text>
          </View>
        ))}
      </View>
      <Text style={{ fontFamily: "Helvetica", fontSize: 9, color: GRAY_TEXT, marginTop: 20 }}>
        Based on {workflows.length} workflow{workflows.length !== 1 ? "s" : ""} analyzed with moderate scenario estimates.
      </Text>
      <View style={s.footer}>
        <Text style={s.footerText}>{project.companyName}</Text>
        <Text style={s.footerText}>Powered by BlueAlly</Text>
      </View>
    </Page>
  );
}

// ─── Workflow Page ────────────────────────────────────────────────────────────

function WorkflowPage({
  workflow,
  index,
  total,
  companyName,
}: {
  workflow: WorkflowWithSteps;
  index: number;
  total: number;
  companyName: string;
}) {
  const currentSteps = workflow.currentSteps || [];
  const aiSteps = workflow.aiSteps || [];
  const m = calcWorkflowMetrics(workflow);

  return (
    <Page size="A4" style={s.page}>
      <Text style={s.wfTitle}>
        {index + 1}. {workflow.useCaseName}
      </Text>
      {workflow.businessFunction ? (
        <Text style={s.wfSubtitle}>
          {workflow.businessFunction}
          {workflow.subFunction ? ` / ${workflow.subFunction}` : ""}
        </Text>
      ) : null}

      {/* Two columns */}
      <View style={s.columnsRow}>
        {/* Current Process */}
        <View style={s.column}>
          <Text style={[s.colHeader, s.colHeaderCurrent]}>
            Current Process ({fmtDuration(m.currentMinutes)})
          </Text>
          {currentSteps.map((step, i) => (
            <View key={step.id} style={s.stepCard}>
              <View style={s.stepRow}>
                <Text style={s.stepName}>
                  {i + 1}. {step.name}
                </Text>
                <Text style={s.stepDuration}>{fmtDuration(step.durationMinutes)}</Text>
              </View>
              <Text style={s.stepDetail}>
                {step.actorType === "human" ? "Human" : step.actorType === "ai_agent" ? "AI Agent" : "System"}
                {step.actorName ? ` - ${step.actorName}` : ""}
              </Text>
              {step.painPoints && step.painPoints.length > 0 ? (
                step.painPoints.map((pp, j) => (
                  <Text key={j} style={s.painPoint}>
                    {"\u2022"} {pp}
                  </Text>
                ))
              ) : null}
            </View>
          ))}
        </View>

        {/* AI-Powered Process */}
        <View style={s.column}>
          <Text style={[s.colHeader, s.colHeaderAI]}>
            AI-Powered Process ({fmtDuration(m.aiMinutes)})
          </Text>
          {aiSteps.map((step, i) => (
            <View key={step.id} style={s.stepCard}>
              <View style={s.stepRow}>
                <Text style={s.stepName}>
                  {i + 1}. {step.name}
                </Text>
                <Text style={s.stepDuration}>{fmtDuration(step.durationMinutes)}</Text>
              </View>
              <Text style={s.stepDetail}>
                {step.actorType === "human" ? "Human" : step.actorType === "ai_agent" ? "AI Agent" : "System"}
                {step.actorName ? ` - ${step.actorName}` : ""}
                {step.automationLevel ? ` | ${step.automationLevel}` : ""}
              </Text>
              <View style={{ flexDirection: "row" }}>
                {step.isAIEnabled ? (
                  <Text style={s.badge}>AI</Text>
                ) : null}
                {step.isHumanInTheLoop ? (
                  <Text style={s.hitlBadge}>HITL</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Mini metrics bar */}
      <View style={s.miniBar}>
        <View style={s.miniMetric}>
          <Text style={s.miniLabel}>Time Reduction</Text>
          <Text style={s.miniValue}>{fmtPercent(m.timeReduction)}</Text>
        </View>
        <View style={s.miniMetric}>
          <Text style={s.miniLabel}>Annual Savings</Text>
          <Text style={s.miniValue}>{fmtCurrency(m.annualSavings)}</Text>
        </View>
        <View style={s.miniMetric}>
          <Text style={s.miniLabel}>Automation Rate</Text>
          <Text style={s.miniValue}>{fmtPercent(m.automationRate)}</Text>
        </View>
        <View style={s.miniMetric}>
          <Text style={s.miniLabel}>Throughput Gain</Text>
          <Text style={s.miniValue}>
            {m.throughputMultiplier > 0 ? `${m.throughputMultiplier.toFixed(1)}x` : "--"}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>
          {companyName} — Workflow {index + 1} of {total}
        </Text>
        <Text style={s.footerText}>Powered by BlueAlly</Text>
      </View>
    </Page>
  );
}

// ─── Full Document ───────────────────────────────────────────────────────────

interface PDFReportProps {
  project: ProjectWithWorkflows;
}

function PDFReportDocument({ project }: PDFReportProps) {
  const workflows = project.workflows || [];
  const companyName = project.companyName || "Company";

  return (
    <Document
      title={`${companyName} — AI Workflow Analysis`}
      author="BlueAlly"
      subject="AI Workflow Analysis Report"
    >
      <CoverPage project={project} />
      <ExecSummaryPage project={project} />
      {workflows.map((wf, i) => (
        <WorkflowPage
          key={wf.id}
          workflow={wf}
          index={i}
          total={workflows.length}
          companyName={companyName}
        />
      ))}
    </Document>
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generatePdfBlob(
  project: ProjectWithWorkflows,
): Promise<Blob> {
  return await pdf(<PDFReportDocument project={project} />).toBlob();
}
