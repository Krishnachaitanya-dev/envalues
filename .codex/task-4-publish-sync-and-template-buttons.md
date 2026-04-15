# Task: Fix Publish/Unpublish Trigger Sync + Template Buttons

## Project
`C:/Users/krish/Projects/envalues`, branch `main`

## Problems to Fix

### Problem 1: Publish/Unpublish doesn't sync flow_triggers.is_active
When a user clicks Publish or Unpublish in the builder, only `flows.status` is updated.
`flow_triggers.is_active` is NOT updated, so triggers keep firing for unpublished flows.

**Fix:** In `src/hooks/useFlowBuilder.ts`, find `handlePublish` and `handleUnpublish` (or whatever functions update flow status). After updating `flows.status`, also run:
- On publish: `UPDATE flow_triggers SET is_active = true WHERE flow_id = flowId`
- On unpublish: `UPDATE flow_triggers SET is_active = false WHERE flow_id = flowId`

Read the file first to find the exact function names and Supabase call patterns used.

### Problem 2: Stock template message nodes have no buttons
The template catalog SQL (`supabase/migrations/20260412000000_flow_template_catalog.sql`) creates message nodes with plain text only. Now that buttons are supported, update the templates to include buttons where the text says "Reply 1 for X, 2 for Y".

**Fix:** In the migration file, find message nodes whose text contains "Reply 1" or similar patterns. Add a `buttons` array to their `config` JSONB. Max 3 buttons per node. Example:

For a node like:
```json
{"text": "Welcome. Reply 1 for membership plans, 2 to book a trial session, or type support."}
```
Update config to:
```json
{
  "text": "Welcome! Choose an option:",
  "buttons": [
    {"id": "btn_membership", "title": "Membership Plans"},
    {"id": "btn_trial", "title": "Book Trial Session"},
    {"id": "btn_support", "title": "Talk to Team"}
  ]
}
```

Note: The migration file creates templates via `public.create_flow_from_template()`. Find the JSONB node configs and update them. The migration already ran — also write a separate one-time SQL fix script at `.codex/fix-existing-template-nodes.sql` to UPDATE existing nodes in the DB with buttons (for nodes that already exist in production).

Read the full migration file to understand the structure before editing.

## Files to Change
1. `src/hooks/useFlowBuilder.ts` — sync triggers on publish/unpublish
2. `supabase/migrations/20260412000000_flow_template_catalog.sql` — add buttons to templates
3. Create `.codex/fix-existing-template-nodes.sql` — one-time fix for existing DB nodes

## Tests
```bash
cd "C:/Users/krish/Projects/envalues"
npm run test
```
All must pass.

## Commit
```bash
git add src/hooks/useFlowBuilder.ts supabase/migrations/20260412000000_flow_template_catalog.sql
git commit -m "fix: sync flow_triggers.is_active on publish/unpublish, add buttons to templates"
```

## Done Criteria
- `handlePublish` activates all triggers for that flow
- `handleUnpublish` deactivates all triggers for that flow  
- Template catalog message nodes with numbered options have buttons in config
- Fix SQL script created for existing DB nodes
- All tests pass
