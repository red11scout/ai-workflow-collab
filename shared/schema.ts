import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import type {
  ImportedUseCase,
  ImportedFriction,
  ImportedBenefit,
} from "./types";

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects = pgTable(
  "wfc_projects",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerToken: varchar("owner_token").notNull(),
    name: text("name").notNull(),
    companyName: text("company_name").notNull().default(""),
    industry: text("industry").default(""),
    description: text("description").default(""),
    status: varchar("status", { length: 20 }).notNull().default("draft"),

    // Workforce parameters (feed HyperFormula)
    avgHourlyRate: integer("avg_hourly_rate").default(85),
    annualRevenue: integer("annual_revenue").default(0),
    headcount: integer("headcount").default(0),
    adoptionRatePct: integer("adoption_rate_pct").default(90),
    dataMaturityPct: integer("data_maturity_pct").default(75),

    // Import data
    rawImport: jsonb("raw_import"),
    importedUseCases: jsonb("imported_use_cases").$type<ImportedUseCase[]>(),
    importedFriction: jsonb("imported_friction").$type<ImportedFriction[]>(),
    importedBenefits: jsonb("imported_benefits").$type<ImportedBenefit[]>(),
    selectedUseCaseIds: jsonb("selected_use_case_ids")
      .$type<string[]>()
      .default([]),

    // Navigation state
    currentStep: integer("current_step").default(0),
    completedSteps: jsonb("completed_steps").$type<number[]>().default([]),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_wfc_projects_owner").on(table.ownerToken)],
);

// ─── Workflows (one per selected use case) ───────────────────────────────────

export const workflows = pgTable(
  "wfc_workflows",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    useCaseId: varchar("use_case_id").notNull(),

    // Use case metadata
    useCaseName: text("use_case_name").notNull(),
    useCaseDescription: text("use_case_description").default(""),
    businessFunction: text("business_function").default(""),
    subFunction: text("sub_function").default(""),
    strategicTheme: text("strategic_theme").default(""),
    targetFriction: text("target_friction").default(""),
    agenticPattern: varchar("agentic_pattern", { length: 50 }).default(""),
    patternRationale: text("pattern_rationale").default(""),
    aiPrimitives: jsonb("ai_primitives").$type<string[]>().default([]),
    desiredOutcomes: jsonb("desired_outcomes").$type<string[]>().default([]),
    dataTypes: jsonb("data_types").$type<string[]>().default([]),
    integrations: jsonb("integrations").$type<string[]>().default([]),

    // Per-workflow overrides
    hourlyRateOverride: integer("hourly_rate_override"),
    frictionAnnualCost: integer("friction_annual_cost").default(0),
    frictionAnnualHours: integer("friction_annual_hours").default(0),

    // Generation status
    aiGenerated: boolean("ai_generated").default(false),
    aiGeneratedAt: timestamp("ai_generated_at"),

    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_wfc_workflows_project").on(table.projectId)],
);

// ─── Workflow Steps (normalized) ─────────────────────────────────────────────

export const workflowSteps = pgTable(
  "wfc_workflow_steps",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workflowId: varchar("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),

    phase: varchar("phase", { length: 10 }).notNull(), // "current" | "ai"
    stepNumber: integer("step_number").notNull(),

    name: text("name").notNull(),
    description: text("description").default(""),
    actorType: varchar("actor_type", { length: 20 }).notNull().default("human"),
    actorName: text("actor_name").default(""),
    durationMinutes: integer("duration_minutes").notNull().default(60),

    systems: jsonb("systems").$type<string[]>().default([]),
    painPoints: jsonb("pain_points").$type<string[]>().default([]),

    isBottleneck: boolean("is_bottleneck").default(false),
    isDecisionPoint: boolean("is_decision_point").default(false),

    // AI-specific fields (phase = "ai")
    isAIEnabled: boolean("is_ai_enabled").default(false),
    isHumanInTheLoop: boolean("is_human_in_the_loop").default(false),
    aiCapabilities: jsonb("ai_capabilities").$type<string[]>().default([]),
    automationLevel: varchar("automation_level", { length: 20 }).default(
      "manual",
    ),
    dataSources: jsonb("data_sources").$type<string[]>().default([]),
    dataOutputs: jsonb("data_outputs").$type<string[]>().default([]),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_wfc_steps_workflow").on(table.workflowId),
    index("idx_wfc_steps_workflow_phase").on(table.workflowId, table.phase),
  ],
);

// ─── Share Links ─────────────────────────────────────────────────────────────

export const shareLinks = pgTable(
  "wfc_share_links",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    shareCode: varchar("share_code", { length: 12 }).unique().notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_wfc_share_code").on(table.shareCode)],
);

// ─── AI Conversations ────────────────────────────────────────────────────────

export const aiConversations = pgTable("wfc_ai_conversations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  workflowId: varchar("workflow_id"),
  section: varchar("section", { length: 30 }).notNull(),
  messages: jsonb("messages").$type<
    Array<{ role: string; content: string }>
  >(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Insert schemas ──────────────────────────────────────────────────────────

export const insertProjectSchema = createInsertSchema(projects);
export const insertWorkflowSchema = createInsertSchema(workflows);
export const insertWorkflowStepSchema = createInsertSchema(workflowSteps);
export const insertShareLinkSchema = createInsertSchema(shareLinks);
