# Phase 3 Claude Continuation Handoff

Date: 2026-04-12
Workspace: `c:\Users\krish\Downloads\alachat-main (3)\alachat-main`
Original source plan: `docs/superpowers/plans/2026-04-12-phase3-flow-builder-ui.md`

## Purpose

This document is the handoff for Claude Code / Claude Cloud so it can resume the Phase 3 work without guessing what changed locally.

The user asked for "Claude changes only", meaning:

- Keep the same branch/workspace.
- Do not create a new branch.
- Do not replace the architecture or task order.
- Keep legacy `qa_pairs` template UI untouched and deprecated.
- Continue from the saved Phase 3 plan and preserve compatibility with Claude resuming later.

No commit was created from this environment because there is no `.git` directory in this workspace. `git status` cannot run here.

## Current Verification State

The current codebase was verified after the Phase 3 builder and production-grade template work.

Commands run:

```powershell
npm test -- --run
npm run build
```

Results:

- Tests: `15` test files passed.
- Test count: `128` tests passed.
- Build: passed.
- Known non-blocking warnings: Browserslist data is old, and Vite reports a large JS chunk over 500 kB.

Important runtime note:

- The new stock template picker requires the Supabase migration `supabase/migrations/20260412000000_flow_template_catalog.sql` to be applied to the actual Supabase database.
- Until that migration is applied, the frontend can build successfully but the picker will fail to load `flow_template_catalog` or call `instantiate_flow_template`.

## Work Completed Before The Template System

### Phase 3 Builder UI

The React Flow canvas builder was implemented and wired into the dashboard route.

Main route wiring:

- `src/App.tsx` imports `FlowBuilderPage`.
- `/dashboard/builder` now renders `src/components/dashboard/builder/FlowBuilderPage.tsx`.

Main builder files:

- `src/hooks/useFlowBuilder.ts`
- `src/components/dashboard/builder/FlowBuilderPage.tsx`
- `src/components/dashboard/builder/FlowCanvas.tsx`
- `src/components/dashboard/builder/FlowList.tsx`
- `src/components/dashboard/builder/NodeConfigPanel.tsx`
- `src/components/dashboard/builder/EdgeConfigPanel.tsx`
- `src/components/dashboard/builder/TriggerPanel.tsx`
- `src/components/dashboard/builder/nodes/FlowNode.tsx`
- `src/components/dashboard/builder/nodes/nodeTypes.ts`

Legacy builder files still exist and are intentionally not deleted:

- `src/components/dashboard/builder/BuilderPage.tsx`
- `src/components/dashboard/builder/TemplatesModal.tsx`
- `src/components/dashboard/builder/CanvasNode.tsx`
- `src/components/dashboard/builder/CanvasEdges.tsx`
- `src/components/dashboard/builder/ChatPreview.tsx`

The legacy modal remains untouched/deprecated. The new Phase 3 template picker does not reuse it.

### React Flow Dependency And Shared Types

`@xyflow/react` was added to `package.json`.

Shared Phase 3 types were added in:

- `src/integrations/supabase/flow-types.ts`

Important exported types include:

- `Flow`
- `FlowNode`
- `FlowEdge`
- `FlowTrigger`
- `NodeType`
- `ConditionType`
- `TriggerType`

Later template-related fields were added to these types:

- `Flow.created_from_template_id`
- `Flow.created_from_template_version`
- `Flow.template_applied_at`
- `Flow.template_request_id`
- `FlowEdge.condition_expression`
- `FlowTrigger.normalized_trigger_value`
- `FlowTrigger.metadata`

Continuity note:

- The runtime builder defaults and the template schema now use the current engine config names such as `store_as`, `timeout_secs`, `delay_secs`, `body_template`, `subflow_id`, and handoff queue fields.
- Some early documentation-style config interfaces at the bottom of `flow-types.ts` still reflect the initial Task 1 UI-oriented shape, for example `InputConfig.variable` and `DelayConfig.seconds`.
- Do not treat those early helper interfaces as the source of truth for runtime execution. The actual builder/template runtime behavior is in `useFlowBuilder.ts`, `NodeConfigPanel.tsx`, and `src/features/flow-templates/domain/template.schemas.ts`.

### Deprecated Table Cleanup

`src/hooks/useDashboardData.ts` was rewritten to stop querying dropped tables:

- Removed `from('chatbots')`.
- Removed `from('qa_pairs')`.
- Subscription lookup now uses `owner_id`.
- Kept backward-compatible stubs where older dashboard pages still destructure `chatbot`, `qaPairs`, `rootQuestions`, and old edit methods.

Dependent dashboard pages were updated:

- `src/components/dashboard/TopBar.tsx`
- `src/components/dashboard/RightPanel.tsx`
- `src/components/dashboard/overview/OverviewPage.tsx`
- `src/components/dashboard/settings/SettingsPage.tsx`

A guard test was added to make sure `useDashboardData.ts` does not query dropped tables:

- `src/test/flow-builder/flow-types.test.ts`

### Dashboard Loading Fix

The dashboard had been stuck on the loading screen because the layout still gated rendering on old `chatbot` state.

The fixed file:

- `src/layouts/DashboardLayout.tsx`

Current behavior:

- It only checks `loading`.
- It no longer blocks dashboard rendering because `chatbot` is now intentionally `null`.

## Production-Grade Flow Templates Implemented

The new system replaces the missing old stock-template experience with a server-owned Phase 3 template architecture.

High-level decisions implemented:

- Stock templates are represented by a canonical frontend domain model.
- Stock templates are also seeded server-side into `flow_template_catalog`.
- Template application is done through a server RPC.
- Created flows receive immutable provenance fields.
- Template application is idempotent through `(owner_id, request_id)`.
- Triggers are normalized and conflict-checked in the current runtime scope: `(owner_id, trigger_type, normalized_trigger_value)`.
- New template triggers are inserted inactive by default.
- New flows are created as `draft`.
- The UI does not switch to the created flow until the RPC succeeds.

## Database Migration

Main migration:

- `supabase/migrations/20260412000000_flow_template_catalog.sql`

This migration adds:

- `flows.created_from_template_id`
- `flows.created_from_template_version`
- `flows.template_applied_at`
- `flows.template_request_id`
- `flow_triggers.normalized_trigger_value`
- Unique active trigger index on `(owner_id, trigger_type, normalized_trigger_value)`
- `flow_template_catalog`
- `flow_template_applications`
- Provenance immutability trigger
- `flow_template_normalize_trigger(value text)`
- `build_stock_flow_template(...)`
- Seed rows for all stock templates
- RPC `instantiate_flow_template(...)`

RPC signature:

```sql
instantiate_flow_template(
  p_template_id text,
  p_template_version integer,
  p_request_id uuid,
  p_flow_name text DEFAULT NULL
)
```

RPC behavior:

- Uses `auth.uid()` as `owner_id`.
- Rejects unauthenticated users with `PERMISSION_DENIED`.
- Checks idempotency in `flow_template_applications`.
- Replays a succeeded response for the same `(owner_id, request_id)`.
- Returns `IDEMPOTENCY_CONFLICT` if the request is already started and not completed.
- Loads an active template from `flow_template_catalog`.
- Validates basic server-side template requirements before writing.
- Creates the flow, nodes, edges, and triggers inside an inner PL/pgSQL block.
- Returns `{ ok: true, flow, nodes, edges, triggers }` on success.
- Returns stable error codes on failure.
- Writes `flow_template_apply_succeeded` audit log events.

Stable error codes expected by frontend:

- `TEMPLATE_NOT_FOUND`
- `TEMPLATE_INVALID`
- `TRIGGER_CONFLICT`
- `PERMISSION_DENIED`
- `IDEMPOTENCY_CONFLICT`
- `DB_WRITE_FAILED`
- `UNKNOWN`

Important Supabase deployment note:

- This migration has been tested through static migration-contract tests and frontend build/tests.
- It has not been executed against the remote Supabase database from this environment.
- Apply this migration before doing runtime smoke testing of the template picker.

## Template Domain Model

Feature folder:

- `src/features/flow-templates`

Domain files:

- `src/features/flow-templates/domain/template.types.ts`
- `src/features/flow-templates/domain/template.schemas.ts`
- `src/features/flow-templates/domain/normalizeTrigger.ts`
- `src/features/flow-templates/domain/validateTemplateGraph.ts`

The canonical `FlowTemplate` domain includes:

- `id`
- `version`
- `name`
- `description`
- `industries`
- `tags`
- `emoji`
- `status`
- `featured`
- `contentPolicy`
- `triggers`
- `nodes`
- `edges`

Template trigger shape includes:

- `id`
- `type`
- `value`
- `matchMode`
- `priority`

Template node shape includes:

- `id`
- `type`
- `label`
- `position`
- `data`
- optional `messageMeta`

Template edge shape includes:

- `id`
- `source`
- `target`
- `condition`

Validation currently checks:

- Zod schema validity.
- Exactly one start node.
- Duplicate node IDs.
- Duplicate edge IDs.
- Edge source/target references.
- Duplicate normalized triggers.
- Reserved triggers: `stop`, `unsubscribe`.
- Reachability from start.
- At least one reachable terminal node: `end` or `handoff`.
- Disallowed cycles unless cycle edges are explicitly marked `allowedCycle`.

## Runtime Node Config Contracts

The template schema and builder forms were aligned to current engine config names.

Implemented runtime config contracts:

- `start`: optional greeting metadata. The engine does not emit a message for start by itself.
- `message`: `text`, optional `attachments`.
- `input`: `prompt`, `store_as`, `timeout_secs`, optional validation.
- `condition`: empty config; branching lives on outgoing edges.
- `api`: `method`, `url`, `headers`, `body_template`, `response_variable`, `timeout_secs`, `retry_count`.
- `delay`: `delay_secs`.
- `jump`: `target_node_id`.
- `subflow`: `subflow_id`, `return_mode`.
- `handoff`: `department`, `message`, `allow_resume`, `resume_node_id`, `queue_strategy`, `handoff_timeout_hours`.
- `end`: optional `farewell_message`.

Files aligned to these contracts:

- `src/hooks/useFlowBuilder.ts`
- `src/components/dashboard/builder/NodeConfigPanel.tsx`
- `src/components/dashboard/builder/nodes/FlowNode.tsx`
- `src/features/flow-templates/domain/template.schemas.ts`
- `src/features/flow-templates/catalog/stockTemplates.ts`

## Stock Template Catalog

Frontend catalog:

- `src/features/flow-templates/catalog/stockTemplates.ts`
- `src/features/flow-templates/catalog/index.ts`

The frontend catalog validates stock templates at module load through `assertValidTemplate`.

Seeded templates:

- `clinic_doctor_appointment`
- `restaurant_cafe`
- `ecommerce_store`
- `salon_spa`
- `real_estate_leads`
- `education_coaching`
- `gym_fitness_studio`
- `hotel_homestay`
- `travel_agency`
- `insurance_finance`
- `automotive_service`
- `general_business`

Each template includes:

- At least one keyword trigger.
- A restart/menu trigger.
- A start node.
- User-facing message nodes.
- A support/handoff path.
- An end path.
- Safe placeholder copy.
- Content metadata for badges.

Sensitive copy decisions:

- Clinic template warns users to call emergency services for urgent medical emergencies.
- Insurance/finance template states the chat does not provide financial advice.
- Hotel/travel/restaurant/salon style templates avoid implying confirmed booking or availability without staff confirmation.
- Marketing-style templates are marked with outbound approval metadata.

## Template Services

Service files:

- `src/features/flow-templates/services/getTemplates.ts`
- `src/features/flow-templates/services/applyFlowTemplate.ts`
- `src/features/flow-templates/services/templateEvents.ts`

`getTemplates.ts`:

- Reads active templates from `flow_template_catalog`.
- Parses each JSONB template with `flowTemplateSchema`.
- Exposes `getFlowTemplates()` and `getFlowTemplateById(...)`.

`applyFlowTemplate.ts`:

- Calls Supabase RPC `instantiate_flow_template`.
- Sends `p_template_id`, `p_template_version`, `p_request_id`, and optional `p_flow_name`.
- Converts RPC failure codes into `FlowTemplateError`.
- Maps stable error codes to actionable UI messages.

`templateEvents.ts`:

- Writes non-blocking audit events.
- Catches audit logging errors so analytics failure does not break the UI.

## Builder Integration

Main hook:

- `src/hooks/useFlowBuilder.ts`

New template-related state:

- `templateApplying`
- `templateError`

New template-related method:

```ts
applyFlowTemplate(templateId: string, templateVersion: number, flowName?: string | null)
```

What `applyFlowTemplate` does:

- Generates a client request ID through `crypto.randomUUID()`.
- Tracks apply started/succeeded/failed/replayed audit events.
- Calls the RPC through `applyFlowTemplateService`.
- Hydrates the returned flow graph into local builder state.
- Selects the created flow only after success.
- Converts persisted nodes and edges into React Flow nodes and edges.

UI integration:

- `src/components/dashboard/builder/FlowBuilderPage.tsx` owns template modal open state.
- `src/components/dashboard/builder/FlowCanvas.tsx` exposes template entry points.
- `src/features/flow-templates/ui/TemplatePickerModal.tsx` provides the actual picker.

Canvas entry points:

- Toolbar button: `Templates`.
- Empty state button: `Use Stock Template`.

Picker capabilities:

- Search.
- Industry filter.
- Featured templates.
- Preview panel.
- Trigger preview.
- Node preview.
- Loading state.
- Filtered-empty state.
- Retryable load error.
- Apply-in-progress disabled state.
- Retryable apply error.
- Content category badges.
- WhatsApp outbound approval badge.

## Tests Added Or Updated

Flow builder tests:

- `src/test/flow-builder/flow-types.test.ts`
- `src/test/flow-builder/FlowNode.test.tsx`
- `src/test/flow-builder/useFlowBuilder.test.ts`

Template tests:

- `src/test/flow-templates/catalog.test.ts`
- `src/test/flow-templates/migration-contract.test.ts`
- `src/test/flow-templates/TemplatePickerModal.test.tsx`

Coverage added:

- Type exports and deprecated table query guard.
- Flow node rendering for updated config names.
- `useFlowBuilder.applyFlowTemplate` hydration and selection.
- Stock template catalog count and validation.
- Invalid template fixtures for duplicate start, orphan node, duplicate trigger, and disallowed cycle.
- Migration contract checks for catalog, provenance, idempotency, normalized trigger field, RPC, stock IDs, and error codes.
- Template picker search/filter, preview, approval badges, apply callback, and disabled apply state.

## Known Runtime / Deployment Steps Still Needed

Claude should not assume the remote database already has the new catalog.

Before runtime smoke testing stock templates:

1. Apply `supabase/migrations/20260412000000_flow_template_catalog.sql` to the active Supabase project.
2. Confirm `flow_template_catalog` has 12 active seed rows.
3. Confirm RPC `instantiate_flow_template` exists.
4. Confirm `flows` has provenance columns.
5. Confirm `flow_triggers` has `normalized_trigger_value`.
6. Open `/dashboard/builder` as a logged-in owner.
7. Open the template picker from the toolbar or empty state.
8. Apply a stock template.
9. Confirm the created flow appears selected and remains draft.
10. Confirm triggers are created inactive.
11. Publish/enable only after review.

If the picker fails at runtime:

- First check whether the migration was applied.
- If `flow_template_catalog` is missing, the picker cannot load.
- If `instantiate_flow_template` is missing, apply will fail.
- If `TRIGGER_CONFLICT` appears, another active trigger with the same normalized value already exists for that owner.

## Current Architectural Boundaries

Do not reuse legacy `TemplatesModal` for the Phase 3 flow template system.

The new intended boundary is:

- Frontend reads active templates from server-owned catalog.
- Frontend preview uses validated template domain shapes.
- Frontend apply action calls RPC only.
- RPC is responsible for server-side authority, idempotency, persistence, and tenant scope.
- Builder hook handles UI orchestration only.

## Follow-Up Recommendations

These are not blockers for the current verified build, but Claude should know them.

1. Execute the migration against a real Supabase database and smoke test the RPC.
2. Consider adding deeper server-side JSON validation inside the RPC or moving validation to a dedicated Postgres helper.
3. Consider adding RPC integration tests once a Supabase test harness is available.
4. Consider aligning or removing the old config helper interfaces at the bottom of `flow-types.ts` so they do not confuse future work.
5. Consider code-splitting the builder/template picker later because Vite reports a large bundle chunk.
6. Update Browserslist data when convenient; this is a maintenance warning, not a Phase 3 blocker.

## 2026-04-12 Media Upload And Builder UX Addendum

After the production-grade template work, Phase 3 builder media uploads and the WATI-style editing layout were implemented.

New media/storage migration:

- `supabase/migrations/20260412001000_chatbot_media_storage.sql`

New media helper:

- `src/features/flow-media/uploadFlowNodeMedia.ts`

Key implementation details:

- Uses the shared public Supabase Storage bucket `chatbot-media`.
- Owner media paths use `owner_id/flows/flow_id/nodes/node_id/random_id.ext`.
- Storage policies use exact first path segment matching against `auth.uid()`.
- Admin brand logo policies remain separate under `brand-logos/**`.
- Object names use random IDs, not original filenames.
- Client validation covers MIME, extension, MIME/extension consistency, file size, attachment count, caption length, and light magic-byte checks for images/PDFs.
- Message media source of truth is now `config.attachments` plus `config.links`.
- Legacy `media_url` / `media_type` is read and normalized in the UI and still supported by the webhook executor during transition.
- The webhook executor sends attachments first, then non-empty text, then one consolidated links text message.
- Node deletion and flow deletion attempt best-effort cleanup of known uploaded `storage_path`s.
- The Phase 3 builder no longer renders a permanent empty right panel.
- Node and edge editors are slide-over panels with dirty-state close protection.
- The canvas node toolbar is now a grouped `Add node` menu.

Additional tests added:

- `src/test/flow-media/storage-migration-contract.test.ts`
- `src/test/flow-media/uploadFlowNodeMedia.test.ts`
- `src/test/flow-builder/NodeConfigPanel.test.tsx`
- `src/test/flow-builder/builder-layout-source.test.ts`

Verification after this addendum:

```powershell
npm test -- --run
npm run build
```

Results:

- Tests: `19` test files passed.
- Test count: `145` tests passed.
- Build: passed.
- Known non-blocking warnings remain: old Browserslist data and large Vite chunk.

Runtime note:

- Apply both `20260412000000_flow_template_catalog.sql` and `20260412001000_chatbot_media_storage.sql` to Supabase before smoke testing templates/uploads.
- Uploaded media is public by URL. Do not represent it as private document storage.
- If applying `20260412001000_chatbot_media_storage.sql` through the hosted Supabase SQL editor fails with `ERROR: 42501: must be owner of relation objects`, do not change ownership of `storage.objects`.
- In that case, keep the migration as CLI/admin source of truth and apply the bucket + object policies through Supabase Dashboard Storage policy UI using `docs/superpowers/plans/2026-04-12-supabase-storage-manual-deployment.md`.

## Safe Resume Checklist For Claude

Read these files first:

- `docs/superpowers/plans/2026-04-12-phase3-flow-builder-ui.md`
- `docs/superpowers/plans/2026-04-12-phase3-claude-continuation-handoff.md`
- `src/hooks/useFlowBuilder.ts`
- `src/components/dashboard/builder/FlowBuilderPage.tsx`
- `src/features/flow-templates/domain/template.schemas.ts`
- `src/features/flow-templates/catalog/stockTemplates.ts`
- `src/features/flow-templates/ui/TemplatePickerModal.tsx`
- `supabase/migrations/20260412000000_flow_template_catalog.sql`

Run these before making more changes:

```powershell
npm test -- --run
npm run build
```

Do not:

- Create a new branch from this workspace.
- Reintroduce `chatbots` or `qa_pairs` queries into `useDashboardData.ts`.
- Replace the new Phase 3 picker with the legacy `TemplatesModal`.
- Switch selected flow before the template RPC succeeds.
- Make template triggers active by default.
- Remove provenance fields from created template flows.
