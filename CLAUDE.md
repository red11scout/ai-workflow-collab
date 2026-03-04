# AI Workflow Collab — Claude Code Project Guide

## Quick Start
```bash
npm run dev    # Start dev server on port 5000
npm run build  # Production build (Vite client + esbuild server)
npm run check  # TypeScript type check
```

## Stack
React 19, Vite 5, Express, Drizzle ORM, PostgreSQL (Neon), Tailwind v4, Claude SDK, HyperFormula, @dnd-kit, shadcn/ui, Wouter, TanStack Query

## Architecture
- 5-step workflow: Import → Map Current → Generate AI → Refine → Dashboard
- HyperFormula runs client-side only (FormulaContext) — all calculations deterministic
- Normalized `workflow_steps` table (individual rows, not JSONB blobs)
- Anonymous auth via `x-owner-token` header (localStorage)

## Key Patterns
- `apiRequest(method, url, data?)` — auto-includes owner token
- Route params: `useParams<{ projectId: string }>()`
- DB tables prefixed `wfc_` (shared Neon project with aiworkflow)
- Brand: Navy `#001278`, Blue `#02a2fd`, Green `#36bf78`, DM Sans font
- Hemingway voice: short, direct, warm

## Database
Neon project: `empty-dust-67915379` (aws-us-east-2)
5 tables: wfc_projects, wfc_workflows, wfc_workflow_steps, wfc_share_links, wfc_ai_conversations

## File Structure
- `client/src/pages/` — 7 pages (Home, ImportSelect, CurrentMapping, AIGeneration, ReviewRefine, DashboardExport, SharedReport)
- `client/src/components/workflow/` — editor components (SplitPaneEditor, SortableStepCard, DraggableStepList, MetricsDashboard, FormulaInspector, etc.)
- `client/src/contexts/FormulaContext.tsx` — HyperFormula wrapper
- `server/routes.ts` — 22 API endpoints
- `server/storage.ts` — Drizzle CRUD layer
- `shared/schema.ts` — Drizzle table definitions
