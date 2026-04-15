# Claude Continuation Handoff: Phase 3 Builder, Templates, Media, Runtime

Date: 2026-04-14

This document is the current continuation handoff for Claude Code. It captures the work completed after the original Phase 3 plan and the practical deployment caveats needed to continue safely.

## Prime Directive

- Continue from the current branch and current workspace only.
- Do not create a new branch unless the user explicitly asks.
- Do not rewrite history, reset, squash, or revert unrelated changes.
- Keep edits scoped to the active task.
- Do not touch admin files, landing page, unrelated Supabase migrations, or unrelated Evolution repo files unless the user explicitly asks.
- Query Graphify first before inspecting source context.
- Only read raw files when the user explicitly permits it or when the task cannot be completed safely without reading the exact target file.

## Context Navigation Rule

The user asked that both Claude and Codex follow this project rule:

```text
Context Navigation

1. ALWAYS query the knowledge graph first
2. only read raw files if i explicitly say so
```

This is recorded in project agent instructions and should be respected for future work.

Graphify artifacts currently exist in the workspace:

- `graphify-out/graph.json`
- `graphify-out/graph.html`
- `graphify-out/GRAPH_REPORT.md`
- `.graphify_ast.json`
- `.graphify_semantic.json`
- `.graphify_detect.json`
- `.graphify_uncached.txt`

Graphify was used before the latest runtime/media changes.

## Current Verification Status

Most recent verification after the latest edge-function media caption fix:

```powershell
npm test -- --run
npm run build
```

Result:

- `npm test -- --run` passed: 19 files, 158 tests.
- `npm run build` passed.
- Known warnings only:
  - stale Browserslist/caniuse-lite data
  - large Vite chunk warning

Focused runtime verification also passed:

```powershell
npm test -- --run src/test/engine/node-executors.test.ts src/test/engine/turn-executor.test.ts
```

Result:

- 2 files passed.
- 42 tests passed.

## Major Completed Work

### 1. Phase 3 Flow Builder UI

The Phase 3 React Flow builder work has been implemented according to the saved plan:

- React Flow builder page wired into dashboard routing.
- Flow list panel.
- Canvas with custom flow nodes.
- Node configuration panel.
- Edge configuration panel.
- Trigger management.
- Template picker integration.
- Flow CRUD through `useFlowBuilder`.
- Published/draft flow status handling.

Original plan source:

- `docs/superpowers/plans/2026-04-12-phase3-flow-builder-ui.md`

Key current builder files:

- `src/components/dashboard/builder/FlowBuilderPage.tsx`
- `src/components/dashboard/builder/FlowCanvas.tsx`
- `src/components/dashboard/builder/FlowNode.tsx`
- `src/components/dashboard/builder/FlowList.tsx`
- `src/components/dashboard/builder/NodeConfigPanel.tsx`
- `src/components/dashboard/builder/EdgeConfigPanel.tsx`
- `src/hooks/useFlowBuilder.ts`
- `src/types/flow-types.ts`

### 2. Deprecated `chatbots` / `qa_pairs` Dashboard Usage Removed

The central dashboard data hook was refactored so deprecated `chatbots` and `qa_pairs` queries are no longer used by `useDashboardData`.

Dependent dashboard pages were adjusted to avoid relying on the old chatbot configuration model.

The old legacy builder/template files remain present for compatibility where they were not part of Phase 3.

### 3. Production-Grade Flow Template System

A new Phase 3 stock template architecture was implemented.

Key design:

- Server-owned template catalog through Supabase table.
- Versioned templates.
- Template provenance stored on flows.
- Transactional RPC for template instantiation.
- Idempotency for template application.
- Trigger conflict checks scoped by current runtime dispatch model.
- Template validation in frontend domain modules and server migration contract tests.

Key frontend/template files:

- `src/features/flow-templates/catalog/stockTemplates.ts`
- `src/features/flow-templates/catalog/index.ts`
- `src/features/flow-templates/domain/template.types.ts`
- `src/features/flow-templates/domain/template.schemas.ts`
- `src/features/flow-templates/domain/validateTemplateGraph.ts`
- `src/features/flow-templates/domain/normalizeTrigger.ts`
- `src/features/flow-templates/services/getTemplates.ts`
- `src/features/flow-templates/services/applyFlowTemplate.ts`
- `src/features/flow-templates/services/templateEvents.ts`
- `src/features/flow-templates/ui/TemplatePickerModal.tsx`

Key migration:

- `supabase/migrations/20260412000000_flow_template_catalog.sql`

Stock templates include:

- Clinic / Doctor Appointment
- Restaurant / Cafe
- Ecommerce Store
- Salon / Spa
- Real Estate
- Education / Coaching
- Gym / Fitness Studio
- Hotel / Homestay
- Travel Agency
- Insurance / Finance
- Automotive Service
- General Business

Sensitive templates include safer placeholder copy/disclaimers where needed.

### 4. Server Template Catalog Input-Capture Fix

The user noticed flows like Gym asked for details but then closed or did not properly collect user input.

Root cause:

- Some stock template “collect details” steps were modeled as `message` nodes.
- They should be `input` nodes when the bot expects the customer to reply.
- Runtime input pause behavior also needed correction.

Fixes made:

- `src/features/flow-templates/catalog/stockTemplates.ts`
  - Added collect-aware option node creation.
  - Collecting options now become `input` nodes.
  - Input nodes route to `handoff`.
  - Informational options can still route to `end`.
  - Menu edges use regex so both numeric replies and button labels work.
  - Menu nodes include quick reply buttons.

- `supabase/migrations/20260414000000_flow_template_input_capture.sql`
  - Re-seeds the server-owned `flow_template_catalog`.
  - Adds corrected input/handoff graph structure.
  - Adds `build_stock_flow_template_v2`.
  - Keeps DB catalog aligned with frontend stock templates.

Important caveat:

- Existing already-created flows do not auto-upgrade.
- To fix an existing live flow, recreate it from the updated template or manually replace detail-collection `message` nodes with `input` nodes routed to `handoff`.

### 5. Runtime Turn Executor Fixes

The WhatsApp edge-function turn executor was updated so runtime flow execution behaves correctly.

Key file:

- `supabase/functions/whatsapp-webhook/engine/turn-executor.ts`

Fixes:

- Input nodes now pause correctly when reached without inbound user text.
- Input node prompt is sent once.
- The session stores an internal prompt marker, `__input_prompted_at`.
- User replies are consumed by the input node and saved to context.
- Input/condition edge evaluation now receives the actual user reply instead of an empty string.
- Subflow return behavior was corrected so returning from a subflow continues from the call-site successor instead of re-executing the subflow call-site.

Tests updated:

- `src/test/engine/turn-executor.test.ts`

New/updated test coverage includes:

- input prompt sends and pauses
- prompt is not re-sent after it already appeared
- input answer can route to handoff
- input answer is used for outgoing edge matching
- subflow return continues to the successor node

### 6. Runtime Message Media Caption Fix

The user reported that image/media and text still appeared as separate WhatsApp bubbles.

Root cause:

- `executeMessageNode` emitted attachment messages first, then text messages separately.
- WhatsApp can show media + text as one bubble only when the text is sent as the media caption.

Fix made:

- `supabase/functions/whatsapp-webhook/engine/node-executors.ts`
  - Message text and links are now compacted into the first valid media attachment caption when attachments exist.
  - Attachment caption is preserved and appended after message text/link content.
  - Text + links without media become one consolidated text message.
  - Legacy `media_url` / `media_type` also uses caption behavior.

Tests updated:

- `src/test/engine/node-executors.test.ts`

Current behavior:

- image/video/PDF + text -> one media message with caption
- image/video/PDF + text + links -> one media message with caption containing text and links
- text + links without media -> one text message
- attachment-only remains safe
- link-only remains safe
- empty message config remains safe

Latest follow-up fix:

- Quick reply buttons with media now use a WhatsApp interactive button payload with a media header.
- This keeps the first image/video/PDF, body text, links, and buttons together as one visible WhatsApp message where the Cloud API supports it.
- Additional attachments after the first still send as separate media messages because WhatsApp interactive messages only support one media header.

### 7. Production-Safe Media Uploads

A Phase 3 media upload architecture was added.

Final decisions:

- Use one shared public Supabase Storage bucket: `chatbot-media`.
- Use owner-scoped object paths, not bucket-per-customer.
- Writes are tenant-scoped.
- Reads are public-by-URL.
- Object keys are immutable and high entropy.
- Original filenames are never used as storage keys.
- `storage_path` is the durable identifier.
- `url` is delivery convenience.

Key media files:

- `src/features/flow-media/uploadFlowNodeMedia.ts`
- `src/test/flow-media/uploadFlowNodeMedia.test.ts`
- `src/test/flow-media/storage-migration-contract.test.ts`
- `supabase/migrations/20260412001000_chatbot_media_storage.sql`

Media model:

```ts
config.attachments?: Array<{
  id: string
  type: 'image' | 'video' | 'document'
  url: string
  storage_path?: string
  source: 'upload' | 'url'
  caption?: string
}>

config.links?: Array<{
  id: string
  url: string
  label?: string
}>

config.text?: string
```

Upload helper behavior:

- Validates MIME allowlist.
- Validates extension allowlist.
- Validates MIME/extension consistency.
- Applies size limits.
- Applies max 3 attachments per message node.
- Applies caption max 300 characters.
- Builds path:

```text
owner_id/flows/flow_id/nodes/node_id/random_id.ext
```

Supported limits:

- Images: jpg, png, webp, gif, max 10 MB.
- Videos: mp4, 3gpp, max 50 MB.
- Documents: pdf only, max 20 MB.

### 8. Storage Policy Permission Issue And Manual Deployment Note

The user hit this Supabase SQL error when running storage policies through the hosted SQL editor:

```text
ERROR: 42501: must be owner of relation objects
```

Reason:

- Supabase manages `storage.objects`.
- The hosted SQL editor role may not own that relation.
- `CREATE POLICY`, `DROP POLICY`, and `COMMENT ON POLICY` on `storage.objects` can fail there.

Safe resolution:

- Keep `supabase/migrations/20260412001000_chatbot_media_storage.sql` as source-of-truth for CLI/admin migrations.
- If SQL editor fails, create/update bucket and policies through Supabase Dashboard Storage UI.

Manual deployment note:

- `docs/superpowers/plans/2026-04-12-supabase-storage-manual-deployment.md`

Do not attempt to fix this by changing ownership of Supabase-managed `storage.objects`.

### 9. Unified Message Media UX

The builder message editor was changed so media and links feel like one message entity again.

Key file:

- `src/components/dashboard/builder/NodeConfigPanel.tsx`

Previous issue:

- Message text, media attachments, external links, and quick replies were shown as separate authoring sections.

Current behavior:

- One unified `Message content` composer.
- Main text textarea.
- Attachment rows/cards.
- Pasted media URL controls.
- External link rows.
- Quick reply button editor.
- One WhatsApp-style combined preview bubble.
- Config is still saved as one message-node config object.

Compatibility:

- UI reads legacy `media_url` / `media_type`.
- UI normalizes legacy media into `attachments`.
- UI writes only `attachments`, `links`, and `buttons`.

Tests:

- `src/test/flow-builder/NodeConfigPanel.test.tsx`

### 10. WATI-Style Builder UX Direction

The builder layout moved toward WATI-style interaction:

- left flow list
- large/full canvas
- right slide-over only while editing
- no permanent empty right panel when nothing is selected
- grouped Add Node menu
- dirty edit close confirmation
- mobile full-width overlay behavior

Relevant files:

- `src/components/dashboard/builder/FlowBuilderPage.tsx`
- `src/components/dashboard/builder/FlowCanvas.tsx`
- `src/components/dashboard/builder/NodeConfigPanel.tsx`
- `src/components/dashboard/builder/EdgeConfigPanel.tsx`
- `src/index.css`
- `src/test/flow-builder/builder-layout-source.test.ts`

Grouped node taxonomy:

- Messages: `message`, `input`
- Logic: `condition`
- Actions: `api`, `delay`, `handoff`
- Flow control: `start`, `jump`, `subflow`, `end`

### 11. Netlify + Lovable Deployment Readiness

Deployment prep was added for static frontend hosting.

Key file:

- `netlify.toml`

Configuration:

- build command: `npm run build`
- publish directory: `dist`
- Node version: `20`
- SPA fallback redirect: `/* -> /index.html`
- basic static security headers
- asset caching

Build passed after deployment config.

Lovable:

- No extra Lovable config required for v1.
- Existing project is Vite and already uses `lovable-tagger` in development mode.

## Live Deployment Checklist

For the latest runtime/template/media fixes to show in real WhatsApp:

1. Deploy the Supabase edge function:

```powershell
supabase functions deploy whatsapp-webhook
```

2. Apply template catalog migration:

```text
supabase/migrations/20260414000000_flow_template_input_capture.sql
```

3. Ensure storage bucket exists:

```text
chatbot-media
```

4. If SQL editor fails on storage policies with `42501`, apply policies through Supabase Storage UI using the manual deployment note.

5. Recreate or manually update existing flows that were created before the input-capture migration.

6. Retest WhatsApp:

- trigger a published flow
- choose a menu option with details collection
- confirm bot asks for input and waits
- send user details
- confirm it routes to handoff instead of ending
- send a message node with image/video/PDF + text
- confirm text appears as media caption, not a separate text bubble

## Existing Flow Caveats

Important: new migrations and catalog fixes affect newly instantiated templates only.

Already-created flows may still contain old graph shapes:

- “Share your name/details...” as a `message` node
- message node routing directly to `end`
- media and text stored in separate nodes or stale config

Fix options:

- recreate from the updated stock template, or
- manually edit the flow:
  - replace detail collection message node with an `input` node
  - set `store_as`
  - route input successor to `handoff`
  - keep media/text in the same message node config

## Current Test Coverage Added Or Updated

Engine:

- `src/test/engine/node-executors.test.ts`
- `src/test/engine/turn-executor.test.ts`
- `src/test/engine/edge-evaluator.test.ts`

Templates:

- `src/test/flow-templates/catalog.test.ts`
- `src/test/flow-templates/migration-contract.test.ts`
- `src/test/flow-templates/TemplatePickerModal.test.tsx`

Media:

- `src/test/flow-media/uploadFlowNodeMedia.test.ts`
- `src/test/flow-media/storage-migration-contract.test.ts`

Builder:

- `src/test/flow-builder/NodeConfigPanel.test.tsx`
- `src/test/flow-builder/builder-layout-source.test.ts`
- `src/test/flow-builder/useFlowBuilder.test.ts`
- `src/test/flow-builder/FlowNode.test.tsx`
- `src/test/flow-builder/flow-types.test.ts`

## Known Non-Blocking Warnings

Build/test warnings currently seen:

- Browserslist/caniuse-lite data is stale.
- Vite warns that the main JS chunk is larger than 500 kB.

These warnings do not block the current fixes.

Potential future cleanup:

- update Browserslist DB
- introduce route/component code splitting
- consider richer WhatsApp interactive payload support if list messages or multi-media cards are needed later
- add janitor cleanup job for orphaned Supabase Storage media

## Git / Workspace Notes

The working tree has many unrelated files and modifications visible outside this app path because of the local Windows folder layout.

Claude should avoid touching unrelated paths, especially:

- `../../evo/alachat-main/**`
- user home folders
- downloaded zip/assets
- unrelated project folders

Stay scoped to:

```text
c:\Users\krish\Downloads\alachat-main (3)\alachat-main
```

Do not clean, delete, reset, or stage unrelated files.

## Most Recent User-Visible Bugs Fixed

### Bug: Bot asked for details and immediately closed

Fixed by:

- runtime input pause changes in `turn-executor.ts`
- stock template collect options becoming `input` nodes
- server catalog reseed migration

Remaining live requirement:

- deploy `whatsapp-webhook`
- run migration
- recreate/edit old flows

### Bug: Image/media came as separate WhatsApp message from text

Fixed by:

- media caption behavior in `node-executors.ts`

Remaining live requirement:

- deploy `whatsapp-webhook`
- ensure text and media are stored in the same message node config

## Suggested Next Claude Steps

If the user asks to continue deployment:

1. Query Graphify first.
2. Confirm whether Supabase CLI is logged in and linked.
3. Deploy `whatsapp-webhook`.
4. Apply `20260414000000_flow_template_input_capture.sql`.
5. Confirm `chatbot-media` bucket and policies through Dashboard if SQL editor lacks storage ownership.
6. Recreate one test template flow, preferably Gym/Fitness, publish it, and test WhatsApp.

If the user asks to fix existing flows:

1. Query Graphify first.
2. Inspect the existing flow graph rows for that owner/flow.
3. Convert old detail-collection message nodes to input nodes.
4. Route input successors to handoff.
5. Keep message media/text in one message node config.

If the user asks for another UI change:

1. Query Graphify first.
2. Touch only builder files and matching tests.
3. Preserve unified message composer behavior.

## Summary For Claude

The frontend builder, template system, media upload helper, storage deployment notes, Netlify config, and WhatsApp runtime fixes are in place and verified locally. The most important thing now is deployment synchronization: the live Supabase edge function and live DB template catalog must be updated, and existing old flows must be recreated or manually edited because migrations do not rewrite already-instantiated graph rows.
