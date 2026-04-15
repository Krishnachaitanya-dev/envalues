# Task: Fix Turn Executor — Pause at Message Nodes with Conditional Edges

## Project
`C:/Users/krish/Projects/envalues`, branch `main`

## The Bug
When a user sends "hi", the flow engine:
1. Fires trigger → creates session → executes Start → executes Main Menu (sends buttons)
2. Immediately evaluates edges from Main Menu using the original "hi" text
3. "hi" doesn't match "membership plans"/"trial session"/"talk to team"
4. Falls through to fallback → Talk to Team (handoff) → session.status = 'handoff'
5. When user taps a button, webhook sees "handoff session active" and **ignores it**

The image node is never reached because the session gets stuck in handoff before the user can tap a button.

## The Fix

### File 1: `supabase/functions/whatsapp-webhook/engine/turn-executor.ts`

**Read the file first.** Then make these two changes:

**Change A — Skip re-execution when resuming at a paused message node:**

At the very beginning of the `while` loop body (before the `switch` statement that executes nodes), add this check:

```typescript
// If we paused here waiting for user button input, skip re-executing this node
// and go straight to edge evaluation
const inputPendingAt = session.context['__input_pending_at'] as string | undefined
if (inputPendingAt === currentNode.id) {
  delete session.context['__input_pending_at']
  session.context = { ...session.context }
  // fall through to edge evaluation below
} else {
  // Normal execution path — execute the current node
  // ... (all the existing switch/case code goes here, wrapped in this else block)
```

Wait — restructuring the existing code into an `if/else` is error-prone. Instead, use a flag:

```typescript
// At the top of the while loop body:
const inputPendingAt = session.context['__input_pending_at'] as string | undefined
const skipExecution = inputPendingAt === currentNode.id
if (skipExecution) {
  // Clear the pause marker
  const ctx = { ...session.context }
  delete ctx['__input_pending_at']
  session.context = ctx
}

// Then wrap the existing switch(currentNode.node_type) block:
let result
if (!skipExecution) {
  switch (currentNode.node_type) {
    // ... all existing cases unchanged ...
  }
} else {
  // Resuming — produce empty result, proceed to edge evaluation
  result = { messages: [], context_updates: {}, next_node_id: null, skip_edge_evaluation: false, consumes_input: false }
}
```

**Change B — Pause after a message node when it has conditional edges:**

After the messages are enqueued (after `deps.enqueueMessages(result.messages, session.phone)`), add:

```typescript
// Pause at message nodes that have conditional outgoing edges
// so the user can reply with a button tap before edge evaluation proceeds.
if (currentNode.node_type === 'message' && !skipExecution) {
  const allEdges = await deps.getOutgoingEdges(currentNode.id)
  const hasConditionalEdges = allEdges
    .filter(e => !e.is_fallback)
    .some(e => e.condition_type !== 'always')
  if (hasConditionalEdges) {
    session.context = { ...session.context, __input_pending_at: currentNode.id }
    session.current_node_id = currentNode.id
    await deps.saveSession(session)
    return
  }
}
```

This means:
- Message nodes with ONLY `always` edges (like `Membership Plans → 1000 per month`) proceed immediately ✓
- Message nodes with conditional edges (like `Main Menu → [membership plans | trial session | talk to team]`) pause and wait for button tap ✓

### File 2: `supabase/functions/whatsapp-webhook/engine/types.ts`

No changes needed — `session.context` is already `Record<string, unknown>` so `__input_pending_at` can be stored there.

## Tests

Run full test suite:
```bash
cd "C:/Users/krish/Projects/envalues"
npm run test
```

Also check `src/test/engine/` for existing turn executor tests and add test cases:
1. Message node with conditional edges → pauses (sets `__input_pending_at`, saves, returns)
2. Second turn with `__input_pending_at` set → skips re-execution, evaluates edges with new inbound
3. Message node with only `always` edges → does NOT pause, chains immediately

## Commit
```bash
git add supabase/functions/whatsapp-webhook/engine/turn-executor.ts
git commit -m "fix: pause turn executor at message nodes awaiting button reply"
```

## Done Criteria
- After "hi": Main Menu sends buttons, session pauses at Main Menu with `__input_pending_at` set
- After tapping "Membership Plans": session resumes at Main Menu, evaluates edge → routes to Membership Plans node → chains to image node
- Existing behavior for non-conditional message nodes unchanged (still chain immediately)
- All tests pass
