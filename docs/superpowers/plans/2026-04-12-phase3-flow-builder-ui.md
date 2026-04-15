# Phase 3: React Flow Canvas UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old QA-pair canvas with a full `@xyflow/react` visual builder that reads/writes the `flows`, `flow_nodes`, `flow_edges`, and `flow_triggers` Supabase tables built in Phase 2.

**Architecture:** A dedicated `useFlowBuilder(ownerId)` hook owns all flow CRUD and React Flow state. The hook maps DB rows to `@xyflow/react` `Node`/`Edge` objects, debounces position saves, and propagates changes back to DB. The page is split into `FlowList` (left panel), `FlowCanvas` (centre), `NodeConfigPanel` (right panel), and `TriggerPanel` (dialog). The old `BuilderPage.tsx` import in `App.tsx` is replaced with `FlowBuilderPage.tsx`.

**Tech Stack:** React 18, TypeScript, `@xyflow/react ^12`, Supabase JS v2, shadcn-ui (Dialog, Select, Input, Button), Tailwind CSS, Lucide React, Vitest + Testing Library.

---

## File Map

| Status | Path | Role |
|--------|------|------|
| Create | `src/integrations/supabase/flow-types.ts` | Hand-written TS types for flow tables |
| Create | `src/hooks/useFlowBuilder.ts` | Flow CRUD + React Flow state |
| Create | `src/components/dashboard/builder/FlowBuilderPage.tsx` | Page root — wires panels together |
| Create | `src/components/dashboard/builder/FlowList.tsx` | Left panel — list/create/select/delete flows |
| Create | `src/components/dashboard/builder/FlowCanvas.tsx` | `@xyflow/react` canvas + toolbar + add-node palette |
| Create | `src/components/dashboard/builder/NodeConfigPanel.tsx` | Right panel — config form per node type |
| Create | `src/components/dashboard/builder/EdgeConfigPanel.tsx` | Popover shown when an edge is clicked |
| Create | `src/components/dashboard/builder/TriggerPanel.tsx` | Dialog — list/add/remove flow triggers |
| Create | `src/components/dashboard/builder/nodes/FlowNode.tsx` | Single custom node component (renders all 10 types) |
| Create | `src/components/dashboard/builder/nodes/nodeTypes.ts` | Maps `'flowNode'` → `FlowNode` component |
| Modify | `src/hooks/useDashboardData.ts` | Remove broken chatbots/qa_pairs DB queries |
| Modify | `src/components/dashboard/TopBar.tsx` | Remove chatbot name/status badge (use owner name) |
| Modify | `src/components/dashboard/RightPanel.tsx` | Remove rootQuestions/getChildren; show placeholder |
| Modify | `src/components/dashboard/overview/OverviewPage.tsx` | Replace chatbot stats with flow stats |
| Modify | `src/components/dashboard/settings/SettingsPage.tsx` | Remove chatbot config card |
| Modify | `src/App.tsx` | Import `FlowBuilderPage` instead of `BuilderPage` |
| Create | `src/test/flow-builder/flow-types.test.ts` | Type-level compile test |
| Create | `src/test/flow-builder/useFlowBuilder.test.ts` | Hook unit tests (Supabase mocked) |
| Create | `src/test/flow-builder/FlowNode.test.tsx` | Node render tests |

---

## Task 1: Install `@xyflow/react` + create `flow-types.ts`

**Files:**
- Modify: `package.json`
- Create: `src/integrations/supabase/flow-types.ts`
- Create: `src/test/flow-builder/flow-types.test.ts`

- [ ] **Step 1: Write the failing compile test**

Create `src/test/flow-builder/flow-types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { Flow, FlowNode, FlowEdge, FlowTrigger, NodeType, ConditionType } from '@/integrations/supabase/flow-types'

describe('flow-types exports', () => {
  it('Flow type has expected shape', () => {
    const f: Flow = {
      id: 'abc', owner_id: 'xyz', name: 'Test Flow', description: null,
      status: 'draft', version: 1, entry_node_id: null,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    }
    expect(f.status).toBe('draft')
  })

  it('NodeType union covers all 10 types', () => {
    const types: NodeType[] = [
      'start','message','input','condition','api','delay','jump','subflow','handoff','end'
    ]
    expect(types.length).toBe(10)
  })

  it('ConditionType union covers all 7 types', () => {
    const types: ConditionType[] = [
      'always','equals','contains','starts_with','regex','variable_equals','variable_contains'
    ]
    expect(types.length).toBe(7)
  })

  it('FlowNode has config typed as Record<string,unknown>', () => {
    const n: FlowNode = {
      id: 'n1', flow_id: 'f1', owner_id: 'o1', node_type: 'message',
      label: 'Say hi', config: { text: 'Hello!' },
      position_x: 100, position_y: 200,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    }
    expect(n.config['text']).toBe('Hello!')
  })

  it('FlowEdge has source/target node ids', () => {
    const e: FlowEdge = {
      id: 'e1', flow_id: 'f1', owner_id: 'o1',
      source_node_id: 'n1', target_node_id: 'n2',
      condition_type: 'always', condition_value: null,
      condition_variable: null, is_fallback: false,
      priority: 0, label: null, created_at: '2026-01-01',
    }
    expect(e.condition_type).toBe('always')
  })

  it('FlowTrigger has trigger_type', () => {
    const t: FlowTrigger = {
      id: 't1', owner_id: 'o1', flow_id: 'f1', target_node_id: null,
      trigger_type: 'keyword', trigger_value: 'hi',
      priority: 0, is_active: true, created_at: '2026-01-01',
    }
    expect(t.trigger_type).toBe('keyword')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:/Users/krish/Projects/envalues" && npm test -- --run src/test/flow-builder/flow-types.test.ts
```
Expected: FAIL — "Cannot find module '@/integrations/supabase/flow-types'"

- [ ] **Step 3: Install `@xyflow/react`**

```bash
cd "C:/Users/krish/Projects/envalues" && npm install @xyflow/react
```
Expected: `@xyflow/react` added to `node_modules`.

- [ ] **Step 4: Create `src/integrations/supabase/flow-types.ts`**

```typescript
export type FlowStatus = 'draft' | 'published' | 'archived'

export type NodeType =
  | 'start' | 'message' | 'input' | 'condition'
  | 'api' | 'delay' | 'jump' | 'subflow' | 'handoff' | 'end'

export type ConditionType =
  | 'always' | 'equals' | 'contains' | 'starts_with'
  | 'regex' | 'variable_equals' | 'variable_contains'

export type TriggerType = 'keyword' | 'api' | 'default' | 'restart'

export interface Flow {
  id: string
  owner_id: string
  name: string
  description: string | null
  status: FlowStatus
  version: number
  entry_node_id: string | null
  created_at: string
  updated_at: string
}

export interface FlowNode {
  id: string
  flow_id: string
  owner_id: string
  node_type: NodeType
  label: string | null
  config: Record<string, unknown>
  position_x: number
  position_y: number
  created_at: string
  updated_at: string
}

export interface FlowEdge {
  id: string
  flow_id: string
  owner_id: string
  source_node_id: string
  target_node_id: string
  condition_type: ConditionType
  condition_value: string | null
  condition_variable: string | null
  is_fallback: boolean
  priority: number
  label: string | null
  created_at: string
}

export interface FlowTrigger {
  id: string
  owner_id: string
  flow_id: string
  target_node_id: string | null
  trigger_type: TriggerType
  trigger_value: string | null
  priority: number
  is_active: boolean
  created_at: string
}

// Config shapes per node type (stored as FlowNode.config)
export interface StartConfig   { greeting_message?: string }
export interface MessageConfig { text: string; media_url?: string; media_type?: 'image' | 'video' | 'document' }
export interface InputConfig   { prompt: string; variable: string; timeout_seconds?: number }
export interface ConditionConfig { /* empty — logic lives in edges */ }
export interface ApiConfig     { url: string; method: 'GET'|'POST'|'PUT'|'DELETE'; headers?: Record<string,string>; body?: string; response_variable?: string }
export interface DelayConfig   { seconds: number }
export interface JumpConfig    { target_node_id: string }
export interface SubflowConfig { target_flow_id: string }
export interface HandoffConfig { message?: string; notify?: boolean }
export interface EndConfig     { farewell_message?: string }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- --run src/test/flow-builder/flow-types.test.ts
```
Expected: 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/integrations/supabase/flow-types.ts src/test/flow-builder/flow-types.test.ts package.json package-lock.json
git commit -m "feat(phase3): install @xyflow/react, add flow-types.ts"
```

---

## Task 2: Clean up `useDashboardData` + fix dependent pages

**Files:**
- Modify: `src/hooks/useDashboardData.ts`
- Modify: `src/components/dashboard/TopBar.tsx`
- Modify: `src/components/dashboard/RightPanel.tsx`
- Modify: `src/components/dashboard/overview/OverviewPage.tsx`
- Modify: `src/components/dashboard/settings/SettingsPage.tsx`

Context: The `chatbots` and `qa_pairs` tables were dropped in migration `20260411000004`. Any query against them will throw "relation does not exist". We must remove those queries and update all UI that depends on them.

- [ ] **Step 1: Write a test that confirms useDashboardData no longer references chatbots table**

In `src/test/flow-builder/flow-types.test.ts`, add at the bottom:

```typescript
it('useDashboardData source does not query chatbots or qa_pairs', async () => {
  const { readFileSync } = await import('fs')
  const src = readFileSync('src/hooks/useDashboardData.ts', 'utf-8')
  expect(src).not.toContain("from('chatbots')")
  expect(src).not.toContain("from('qa_pairs')")
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run src/test/flow-builder/flow-types.test.ts
```
Expected: FAIL — "received: contains 'chatbots'"

- [ ] **Step 3: Remove chatbots/qa_pairs queries from `useDashboardData.ts`**

In `src/hooks/useDashboardData.ts`, make these changes:

**Remove** state declarations (lines ~46-72):
- `const [chatbot, setChatbot] = useState<any>(null)`
- `const [qaPairs, setQaPairs] = useState<any[]>([])`
- `const [editingChatbot, setEditingChatbot] = useState(false)`
- `const [editChatbotForm, setEditChatbotForm] = useState({...})`
- `const [editingQuestion, setEditingQuestion] = useState<string | null>(null)`
- `const [editQuestionForm, setEditQuestionForm] = useState({...})`
- `const [mainQuestionForm, setMainQuestionForm] = useState({...})`
- `const [mainButtonOptions, setMainButtonOptions] = useState([...])`
- `const [showAddQuestion, setShowAddQuestion] = useState(false)`
- `const [savingMainQuestion, setSavingMainQuestion] = useState(false)`
- `const [savingEdit, setSavingEdit] = useState(false)`
- `const [goLiveLoading, setGoLiveLoading] = useState(false)`

**Replace** in `checkUser` — delete lines 103–119 (chatbots query + subscription query) and replace with:

```typescript
// chatbots table dropped in Phase 2 — subscriptions no longer tied to chatbot
const { data: sd } = await supabase.from('subscriptions').select('*').eq('owner_id', user.id).maybeSingle()
if (sd) setSubscription(sd)
```

**Delete** entire `fetchQAPairs` function (lines ~126-132).

**Delete** the `useEffect` at line 82 (`if (chatbot) fetchQAPairs()`).

**Delete** these entire functions:
- `handleStartEditChatbot`
- `handleSaveChatbotEdit`
- `handleStartEditQuestion`
- `handleSaveQuestionEdit`
- `handleAddMainQuestion`
- `handleDeleteQuestion`
- `handleAddSubOptions`
- `handleGoLive`
- `handleApplyTemplate`
- `useTemplate`

**Delete** these computed values (lines ~377-383):
```typescript
// DELETE these:
const totalQuestions = qaPairs.length
const mainMenuCount = rootQuestions.length
const subOptionCount = totalQuestions - mainMenuCount
const isLive = chatbot?.is_active
const hasMenuItems = mainMenuCount > 0
const readyToGoLive = hasWhatsappCreds && hasMenuItems
const rootQuestions = qaPairs.filter(q => q.parent_question_id === null)
const getChildren = (parentId: string) => qaPairs.filter(q => q.parent_question_id === parentId)
```

**Replace** the `return` statement at the end of the hook with:

```typescript
return {
  // Auth
  user, ownerData, loading, error, setError,
  // WhatsApp settings
  whatsappForm, showToken, setShowToken,
  savingWhatsapp,
  handleLogout, handleWhatsappFormChange, handleSaveWhatsapp, handleSaveReceptionPhone,
  // Subscription
  subscription,
  handleCancelSubscription, formatAmount,
  // Enterprise / branding
  isEnterprise, isEnterpriseClient, brand,
  // Stubs kept for backward compile compat (removed in later cleanup)
  chatbot: null as null,
  qaPairs: [] as never[],
  rootQuestions: [] as never[],
  getChildren: (_id: string) => [] as never[],
  isLive: false,
  hasWhatsappCreds: !!(ownerData?.whatsapp_business_number?.trim() && ownerData?.whatsapp_api_token?.trim()),
}
```

- [ ] **Step 4: Fix `TopBar.tsx` — remove chatbot references**

Replace the destructure at line 14:

```typescript
// OLD:
const { chatbot, ownerData, isLive, handleLogout, savingEdit, editingChatbot, brand } = useDashboard()

// NEW:
const { ownerData, handleLogout, brand } = useDashboard()
```

Delete lines 46–51 (chatbot name segment in breadcrumb):
```tsx
// DELETE:
{chatbot && (
  <>
    <span className="text-xs font-medium text-muted-foreground truncate max-w-[120px]">{chatbot.chatbot_name}</span>
    <ChevronRight size={12} className="text-border" />
  </>
)}
```

Delete lines 65–77 (status badge block):
```tsx
// DELETE:
{chatbot && (
  <div className="ml-1">
    {isLive ? ( ... ) : ( ... )}
  </div>
)}
```

- [ ] **Step 5: Fix `RightPanel.tsx` — remove QA-pair validation**

Replace lines 12–25:

```typescript
// OLD:
const { rootQuestions, qaPairs, getChildren, hasWhatsappCreds } = useDashboard()
// ...validation using rootQuestions...

// NEW:
const { hasWhatsappCreds } = useDashboard()
const warnings: { message: string; severity: 'warning' | 'error' }[] = []
if (!hasWhatsappCreds) warnings.push({ message: 'WhatsApp credentials not configured', severity: 'warning' })
```

- [ ] **Step 6: Fix `OverviewPage.tsx` — replace chatbot stats with flow stats**

Replace the destructure at lines 12–14:

```typescript
// OLD:
const {
  chatbot, isLive, mainMenuCount, subOptionCount, totalQuestions,
  readyToGoLive, hasWhatsappCreds, hasMenuItems, handleGoLive,
  goLiveLoading, subscription, rootQuestions, qaPairs, getChildren
} = useDashboard()

// NEW:
const { ownerData, hasWhatsappCreds, subscription } = useDashboard()
```

Replace the entire checks/recommendations/checklist/stats section with a simplified version. Replace lines 24–140 with:

```tsx
const checks = [hasWhatsappCreds, !!subscription]
const completedChecks = checks.filter(Boolean).length

const checklist = [
  { label: 'Connect WhatsApp', desc: 'Add phone number & access token', done: hasWhatsappCreds, action: () => navigate('/dashboard/settings') },
  { label: 'Build your first flow', desc: 'Create nodes and publish a flow', done: false, action: () => navigate('/dashboard/builder') },
  { label: 'Activate subscription', desc: subscription ? 'Active' : '₹500/month', done: !!subscription && subscription.status === 'active' },
]

return (
  <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
    {/* Header */}
    <div>
      <h1 className="font-display font-bold text-xl text-foreground">Overview</h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        {ownerData?.full_name ? `Welcome back, ${ownerData.full_name}` : 'Welcome back'}
      </p>
    </div>

    {/* Setup checklist */}
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm text-foreground">Setup checklist</h2>
        <span className="text-xs text-muted-foreground">{completedChecks}/{checklist.length} done</span>
      </div>
      {checklist.map((item, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${item.done ? 'border-primary bg-primary/10' : 'border-border'}`}>
            {item.done && <Check size={11} className="text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
          {!item.done && item.action && (
            <button onClick={item.action} className="text-xs text-primary hover:underline shrink-0">Set up</button>
          )}
        </div>
      ))}
    </div>
  </div>
)
```

Add needed imports at the top (if not present): `Check` from `lucide-react`, `useNavigate` from `react-router-dom`.

- [ ] **Step 7: Fix `SettingsPage.tsx` — remove chatbot config card**

Replace the destructure at line 9:

```typescript
// OLD:
const { chatbot, ownerData, subscription, error, ... } = useDashboard()

// NEW:
const { ownerData, subscription, error, setError,
        whatsappForm, savingWhatsapp,
        handleWhatsappFormChange, handleSaveWhatsapp, handleSaveReceptionPhone } = useDashboard()
```

Delete the entire "Chatbot Configuration" card block (the section with `editChatbotForm`, chatbot_name, greeting_message, farewell_message fields).

- [ ] **Step 8: Run all tests — confirm 98 pass**

```bash
npm test -- --run
```
Expected: 98 tests PASS. (The compile-guard test now passes too, giving 99.)

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useDashboardData.ts \
        src/components/dashboard/TopBar.tsx \
        src/components/dashboard/RightPanel.tsx \
        src/components/dashboard/overview/OverviewPage.tsx \
        src/components/dashboard/settings/SettingsPage.tsx \
        src/test/flow-builder/flow-types.test.ts
git commit -m "refactor: remove chatbots/qa_pairs queries, update dependent pages for Phase 3"
```

---

## Task 3: `useFlowBuilder` hook

**Files:**
- Create: `src/hooks/useFlowBuilder.ts`
- Create: `src/test/flow-builder/useFlowBuilder.test.ts`

This hook owns all flow data and React Flow state. It must be called with the owner's user ID.

- [ ] **Step 1: Write failing tests**

Create `src/test/flow-builder/useFlowBuilder.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFlowBuilder } from '@/hooks/useFlowBuilder'

// Mock Supabase client
const mockFlows = [
  { id: 'f1', owner_id: 'o1', name: 'Main Flow', status: 'draft', version: 1,
    entry_node_id: null, description: null, created_at: '', updated_at: '' },
]
const mockNodes = [
  { id: 'n1', flow_id: 'f1', owner_id: 'o1', node_type: 'start', label: 'Start',
    config: {}, position_x: 100, position_y: 100, created_at: '', updated_at: '' },
  { id: 'n2', flow_id: 'f1', owner_id: 'o1', node_type: 'message', label: 'Hello',
    config: { text: 'Hi there!' }, position_x: 300, position_y: 100, created_at: '', updated_at: '' },
]
const mockEdges = [
  { id: 'e1', flow_id: 'f1', owner_id: 'o1', source_node_id: 'n1', target_node_id: 'n2',
    condition_type: 'always', condition_value: null, condition_variable: null,
    is_fallback: false, priority: 0, label: null, created_at: '' },
]

const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: table === 'flows' ? mockFlows : table === 'flow_nodes' ? mockNodes : table === 'flow_edges' ? mockEdges : [], error: null }),
        }),
        eq: () => Promise.resolve({ data: table === 'flows' ? mockFlows : [], error: null }),
      }),
      insert: (rows: unknown) => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'new-id', ...( Array.isArray(rows) ? rows[0] : rows) }, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}))

describe('useFlowBuilder', () => {
  it('returns empty state when ownerId is null', () => {
    const { result } = renderHook(() => useFlowBuilder(null))
    expect(result.current.flows).toEqual([])
    expect(result.current.selectedFlowId).toBeNull()
    expect(result.current.rfNodes).toEqual([])
    expect(result.current.rfEdges).toEqual([])
  })

  it('loads flows for owner', async () => {
    const { result } = renderHook(() => useFlowBuilder('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.flows.length).toBeGreaterThan(0)
  })

  it('selectFlow populates rfNodes and rfEdges', async () => {
    const { result } = renderHook(() => useFlowBuilder('o1'))
    await waitFor(() => expect(result.current.flows.length).toBeGreaterThan(0))
    act(() => result.current.selectFlow('f1'))
    await waitFor(() => expect(result.current.rfNodes.length).toBeGreaterThan(0))
    expect(result.current.rfNodes[0].id).toBe('n1')
    expect(result.current.rfEdges[0].id).toBe('e1')
  })

  it('rfNodes have correct position from DB', async () => {
    const { result } = renderHook(() => useFlowBuilder('o1'))
    await waitFor(() => expect(result.current.flows.length).toBeGreaterThan(0))
    act(() => result.current.selectFlow('f1'))
    await waitFor(() => expect(result.current.rfNodes.length).toBeGreaterThan(0))
    const startNode = result.current.rfNodes.find(n => n.id === 'n1')
    expect(startNode?.position).toEqual({ x: 100, y: 100 })
  })

  it('rfEdges map source/target from source_node_id/target_node_id', async () => {
    const { result } = renderHook(() => useFlowBuilder('o1'))
    await waitFor(() => expect(result.current.flows.length).toBeGreaterThan(0))
    act(() => result.current.selectFlow('f1'))
    await waitFor(() => expect(result.current.rfEdges.length).toBeGreaterThan(0))
    expect(result.current.rfEdges[0].source).toBe('n1')
    expect(result.current.rfEdges[0].target).toBe('n2')
  })

  it('getFlowNode returns the DB FlowNode by RF node id', async () => {
    const { result } = renderHook(() => useFlowBuilder('o1'))
    await waitFor(() => expect(result.current.flows.length).toBeGreaterThan(0))
    act(() => result.current.selectFlow('f1'))
    await waitFor(() => expect(result.current.rfNodes.length).toBeGreaterThan(0))
    const node = result.current.getFlowNode('n1')
    expect(node?.node_type).toBe('start')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run src/test/flow-builder/useFlowBuilder.test.ts
```
Expected: FAIL — "Cannot find module '@/hooks/useFlowBuilder'"

- [ ] **Step 3: Create `src/hooks/useFlowBuilder.ts`**

```typescript
import { useState, useCallback, useRef } from 'react'
import {
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
} from '@xyflow/react'
import { MarkerType } from '@xyflow/react'
import { supabase } from '@/integrations/supabase/client'
import type { Flow, FlowNode, FlowEdge, FlowTrigger, NodeType, ConditionType } from '@/integrations/supabase/flow-types'

// ── React Flow node data shape ────────────────────────────────────────────────
export interface RFNodeData extends Record<string, unknown> {
  nodeType: NodeType
  label: string | null
  config: Record<string, unknown>
}

// ── React Flow edge data shape ────────────────────────────────────────────────
export interface RFEdgeData extends Record<string, unknown> {
  condition_type: ConditionType
  condition_value: string | null
  condition_variable: string | null
  is_fallback: boolean
  priority: number
}

// ── Mappers ───────────────────────────────────────────────────────────────────
function toRFNode(n: FlowNode): Node<RFNodeData> {
  return {
    id: n.id,
    type: 'flowNode',
    position: { x: n.position_x, y: n.position_y },
    data: { nodeType: n.node_type, label: n.label, config: n.config },
  }
}

function toRFEdge(e: FlowEdge): Edge<RFEdgeData> {
  const condLabel =
    e.is_fallback ? 'fallback'
    : e.condition_type === 'always' ? ''
    : `${e.condition_type}(${e.condition_value ?? ''})`
  return {
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    type: 'smoothstep',
    label: e.label ?? condLabel,
    animated: e.condition_type === 'always' && !e.is_fallback,
    markerEnd: { type: MarkerType.ArrowClosed },
    data: {
      condition_type: e.condition_type,
      condition_value: e.condition_value,
      condition_variable: e.condition_variable,
      is_fallback: e.is_fallback,
      priority: e.priority,
    },
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useFlowBuilder(ownerId: string | null) {
  const [flows, setFlows] = useState<Flow[]>([])
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  const [dbNodes, setDbNodes] = useState<FlowNode[]>([])
  const [dbEdges, setDbEdges] = useState<FlowEdge[]>([])
  const [triggers, setTriggers] = useState<FlowTrigger[]>([])
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node<RFNodeData>>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge<RFEdgeData>>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const positionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load flows list ──────────────────────────────────────────────────────────
  const loadFlows = useCallback(async () => {
    if (!ownerId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('flows')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setFlows((data ?? []) as Flow[])
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  // Run on mount when ownerId is available
  useState(() => { if (ownerId) loadFlows() })

  // ── Select a flow (load its nodes + edges + triggers) ─────────────────────
  const selectFlow = useCallback(async (flowId: string) => {
    if (!ownerId) return
    setSelectedFlowId(flowId)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    const [nodesRes, edgesRes, triggersRes] = await Promise.all([
      supabase.from('flow_nodes').select('*').eq('flow_id', flowId).eq('owner_id', ownerId).order('created_at', { ascending: true }),
      supabase.from('flow_edges').select('*').eq('flow_id', flowId).eq('owner_id', ownerId).order('priority', { ascending: true }),
      supabase.from('flow_triggers').select('*').eq('flow_id', flowId).eq('owner_id', ownerId).order('priority', { ascending: true }),
    ])
    const nodes = (nodesRes.data ?? []) as FlowNode[]
    const edges = (edgesRes.data ?? []) as FlowEdge[]
    setDbNodes(nodes)
    setDbEdges(edges)
    setTriggers((triggersRes.data ?? []) as FlowTrigger[])
    setRfNodes(nodes.map(toRFNode))
    setRfEdges(edges.map(toRFEdge))
  }, [ownerId, setRfNodes, setRfEdges])

  // ── Position save debounce (called by onNodesChange wrapper) ──────────────
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    const positionChanges = changes.filter(c => c.type === 'position' && !c.dragging)
    if (positionChanges.length === 0) return
    if (positionSaveTimer.current) clearTimeout(positionSaveTimer.current)
    positionSaveTimer.current = setTimeout(async () => {
      for (const change of positionChanges) {
        if (change.type !== 'position' || !change.position) continue
        await supabase
          .from('flow_nodes')
          .update({ position_x: change.position.x, position_y: change.position.y })
          .eq('id', change.id)
      }
    }, 500)
  }, [onNodesChange])

  // ── Connect nodes (drag handle → creates edge) ────────────────────────────
  const onConnect = useCallback(async (connection: Connection) => {
    if (!selectedFlowId || !ownerId || !connection.source || !connection.target) return
    const { data, error } = await supabase
      .from('flow_edges')
      .insert([{
        flow_id: selectedFlowId,
        owner_id: ownerId,
        source_node_id: connection.source,
        target_node_id: connection.target,
        condition_type: 'always',
        is_fallback: false,
        priority: 0,
      }])
      .select()
      .single()
    if (error) { console.error('onConnect error:', error.message); return }
    const newEdge = data as FlowEdge
    setDbEdges(prev => [...prev, newEdge])
    setRfEdges(prev => addEdge(toRFEdge(newEdge), prev))
  }, [selectedFlowId, ownerId, setRfEdges])

  // ── Add node ──────────────────────────────────────────────────────────────
  const addNode = useCallback(async (nodeType: NodeType, position: { x: number; y: number }) => {
    if (!selectedFlowId || !ownerId) return
    const defaultConfigs: Record<NodeType, Record<string, unknown>> = {
      start:     { greeting_message: '' },
      message:   { text: 'Type your message here' },
      input:     { prompt: 'Please enter your response:', variable: 'user_input' },
      condition: {},
      api:       { url: '', method: 'GET' },
      delay:     { seconds: 5 },
      jump:      { target_node_id: '' },
      subflow:   { target_flow_id: '' },
      handoff:   { message: 'Connecting you to an agent...', notify: true },
      end:       { farewell_message: 'Thank you! Goodbye.' },
    }
    const { data, error } = await supabase
      .from('flow_nodes')
      .insert([{
        flow_id: selectedFlowId,
        owner_id: ownerId,
        node_type: nodeType,
        label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
        config: defaultConfigs[nodeType],
        position_x: position.x,
        position_y: position.y,
      }])
      .select()
      .single()
    if (error) { console.error('addNode error:', error.message); return }
    const newNode = data as FlowNode
    setDbNodes(prev => [...prev, newNode])
    setRfNodes(prev => [...prev, toRFNode(newNode)])
  }, [selectedFlowId, ownerId, setRfNodes])

  // ── Update node config ────────────────────────────────────────────────────
  const updateNodeConfig = useCallback(async (
    nodeId: string,
    config: Record<string, unknown>,
    label?: string,
  ) => {
    const updates: Record<string, unknown> = { config }
    if (label !== undefined) updates.label = label
    const { error } = await supabase.from('flow_nodes').update(updates).eq('id', nodeId)
    if (error) { console.error('updateNodeConfig error:', error.message); return }
    setDbNodes(prev => prev.map(n => n.id === nodeId ? { ...n, config, ...(label !== undefined ? { label } : {}) } : n))
    setRfNodes(prev => prev.map(n =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, config, ...(label !== undefined ? { label } : {}) } }
        : n,
    ))
  }, [setRfNodes])

  // ── Delete node (cascade deletes its edges via DB FK) ─────────────────────
  const deleteNode = useCallback(async (nodeId: string) => {
    const { error } = await supabase.from('flow_nodes').delete().eq('id', nodeId)
    if (error) { console.error('deleteNode error:', error.message); return }
    setDbNodes(prev => prev.filter(n => n.id !== nodeId))
    setDbEdges(prev => prev.filter(e => e.source_node_id !== nodeId && e.target_node_id !== nodeId))
    setRfNodes(prev => prev.filter(n => n.id !== nodeId))
    setRfEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId))
    if (selectedNodeId === nodeId) setSelectedNodeId(null)
  }, [selectedNodeId, setRfNodes, setRfEdges])

  // ── Update edge condition ─────────────────────────────────────────────────
  const updateEdge = useCallback(async (edgeId: string, params: {
    condition_type?: ConditionType
    condition_value?: string | null
    condition_variable?: string | null
    is_fallback?: boolean
    priority?: number
    label?: string | null
  }) => {
    const { error } = await supabase.from('flow_edges').update(params).eq('id', edgeId)
    if (error) { console.error('updateEdge error:', error.message); return }
    setDbEdges(prev => prev.map(e => e.id === edgeId ? { ...e, ...params } : e))
    setRfEdges(prev => prev.map(e => {
      if (e.id !== edgeId) return e
      const updated = { ...dbEdges.find(d => d.id === edgeId)!, ...params }
      return toRFEdge(updated)
    }))
  }, [dbEdges, setRfEdges])

  // ── Delete edge ───────────────────────────────────────────────────────────
  const deleteEdge = useCallback(async (edgeId: string) => {
    const { error } = await supabase.from('flow_edges').delete().eq('id', edgeId)
    if (error) { console.error('deleteEdge error:', error.message); return }
    setDbEdges(prev => prev.filter(e => e.id !== edgeId))
    setRfEdges(prev => prev.filter(e => e.id !== edgeId))
    if (selectedEdgeId === edgeId) setSelectedEdgeId(null)
  }, [selectedEdgeId, setRfEdges])

  // ── Flow CRUD ─────────────────────────────────────────────────────────────
  const createFlow = useCallback(async (name: string) => {
    if (!ownerId) return
    const { data, error } = await supabase
      .from('flows')
      .insert([{ owner_id: ownerId, name, status: 'draft' }])
      .select()
      .single()
    if (error) throw error
    const newFlow = data as Flow
    setFlows(prev => [...prev, newFlow])
    return newFlow
  }, [ownerId])

  const renameFlow = useCallback(async (flowId: string, name: string) => {
    const { error } = await supabase.from('flows').update({ name }).eq('id', flowId)
    if (error) throw error
    setFlows(prev => prev.map(f => f.id === flowId ? { ...f, name } : f))
  }, [])

  const deleteFlow = useCallback(async (flowId: string) => {
    const { error } = await supabase.from('flows').delete().eq('id', flowId)
    if (error) throw error
    setFlows(prev => prev.filter(f => f.id !== flowId))
    if (selectedFlowId === flowId) {
      setSelectedFlowId(null)
      setRfNodes([])
      setRfEdges([])
      setDbNodes([])
      setDbEdges([])
    }
  }, [selectedFlowId, setRfNodes, setRfEdges])

  const publishFlow = useCallback(async (flowId: string) => {
    const { error } = await supabase.from('flows').update({ status: 'published' }).eq('id', flowId)
    if (error) throw error
    setFlows(prev => prev.map(f => f.id === flowId ? { ...f, status: 'published' } : f))
  }, [])

  const unpublishFlow = useCallback(async (flowId: string) => {
    const { error } = await supabase.from('flows').update({ status: 'draft' }).eq('id', flowId)
    if (error) throw error
    setFlows(prev => prev.map(f => f.id === flowId ? { ...f, status: 'draft' } : f))
  }, [])

  // ── Triggers ──────────────────────────────────────────────────────────────
  const addTrigger = useCallback(async (trigger: Omit<FlowTrigger, 'id' | 'owner_id' | 'created_at'>) => {
    if (!ownerId) return
    const { data, error } = await supabase
      .from('flow_triggers')
      .insert([{ ...trigger, owner_id: ownerId }])
      .select()
      .single()
    if (error) throw error
    setTriggers(prev => [...prev, data as FlowTrigger])
  }, [ownerId])

  const removeTrigger = useCallback(async (id: string) => {
    const { error } = await supabase.from('flow_triggers').delete().eq('id', id)
    if (error) throw error
    setTriggers(prev => prev.filter(t => t.id !== id))
  }, [])

  const updateTrigger = useCallback(async (id: string, params: Partial<FlowTrigger>) => {
    const { error } = await supabase.from('flow_triggers').update(params).eq('id', id)
    if (error) throw error
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, ...params } : t))
  }, [])

  // ── Lookups ───────────────────────────────────────────────────────────────
  const getFlowNode = useCallback((rfNodeId: string) =>
    dbNodes.find(n => n.id === rfNodeId), [dbNodes])

  const getFlowEdge = useCallback((rfEdgeId: string) =>
    dbEdges.find(e => e.id === rfEdgeId), [dbEdges])

  return {
    // Flows list
    flows, loading, loadFlows,
    selectedFlowId,
    selectFlow, createFlow, renameFlow, deleteFlow, publishFlow, unpublishFlow,
    // Canvas state
    rfNodes, rfEdges,
    onNodesChange: handleNodesChange,
    onEdgesChange,
    onConnect,
    // Node operations
    addNode, updateNodeConfig, deleteNode,
    selectedNodeId, setSelectedNodeId,
    getFlowNode,
    // Edge operations
    updateEdge, deleteEdge,
    selectedEdgeId, setSelectedEdgeId,
    getFlowEdge,
    // Triggers
    triggers, addTrigger, removeTrigger, updateTrigger,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --run src/test/flow-builder/useFlowBuilder.test.ts
```
Expected: 6 tests PASS.

- [ ] **Step 5: Run all tests**

```bash
npm test -- --run
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useFlowBuilder.ts src/test/flow-builder/useFlowBuilder.test.ts
git commit -m "feat(phase3): add useFlowBuilder hook with flow CRUD and React Flow state"
```

---

## Task 4: `FlowNode` custom node component

**Files:**
- Create: `src/components/dashboard/builder/nodes/FlowNode.tsx`
- Create: `src/components/dashboard/builder/nodes/nodeTypes.ts`
- Create: `src/test/flow-builder/FlowNode.test.tsx`

A single React component renders all 10 node types. The type determines the icon, colour, and header label.

- [ ] **Step 1: Write failing render tests**

Create `src/test/flow-builder/FlowNode.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import FlowNode from '@/components/dashboard/builder/nodes/FlowNode'
import type { RFNodeData } from '@/hooks/useFlowBuilder'

function wrap(ui: React.ReactElement) {
  return render(<ReactFlowProvider>{ui}</ReactFlowProvider>)
}

const baseData: RFNodeData = { nodeType: 'message', label: 'Say hello', config: { text: 'Hello!' } }

describe('FlowNode', () => {
  it('renders the label text', () => {
    wrap(<FlowNode id="n1" data={baseData} selected={false} type="flowNode" />)
    expect(screen.getByText('Say hello')).toBeTruthy()
  })

  it('renders "start" type with correct label', () => {
    const data: RFNodeData = { nodeType: 'start', label: null, config: {} }
    wrap(<FlowNode id="n1" data={data} selected={false} type="flowNode" />)
    expect(screen.getByText('Start')).toBeTruthy()
  })

  it('renders "end" type with correct label', () => {
    const data: RFNodeData = { nodeType: 'end', label: 'Farewell', config: {} }
    wrap(<FlowNode id="n1" data={data} selected={false} type="flowNode" />)
    expect(screen.getByText('Farewell')).toBeTruthy()
  })

  it('renders "condition" type', () => {
    const data: RFNodeData = { nodeType: 'condition', label: 'Check answer', config: {} }
    wrap(<FlowNode id="n1" data={data} selected={false} type="flowNode" />)
    expect(screen.getByText('Check answer')).toBeTruthy()
  })

  it('applies selected styling when selected=true', () => {
    const { container } = wrap(<FlowNode id="n1" data={baseData} selected={true} type="flowNode" />)
    // Selected node has ring/border-primary class
    expect(container.innerHTML).toContain('border-primary')
  })

  it('falls back to nodeType as label when label is null', () => {
    const data: RFNodeData = { nodeType: 'delay', label: null, config: {} }
    wrap(<FlowNode id="n1" data={data} selected={false} type="flowNode" />)
    expect(screen.getByText('Delay')).toBeTruthy()  // capitalised nodeType
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run src/test/flow-builder/FlowNode.test.tsx
```
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create `src/components/dashboard/builder/nodes/FlowNode.tsx`**

```tsx
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  Play, MessageSquare, KeyRound, GitBranch, Globe,
  Clock, ArrowRight, Layers, Headphones, Square,
} from 'lucide-react'
import type { RFNodeData } from '@/hooks/useFlowBuilder'
import type { NodeType } from '@/integrations/supabase/flow-types'

// ── Node type metadata ────────────────────────────────────────────────────────
const NODE_META: Record<NodeType, { icon: React.ElementType; color: string; bg: string }> = {
  start:     { icon: Play,         color: 'text-green-400',  bg: 'bg-green-400/15' },
  message:   { icon: MessageSquare,color: 'text-primary',    bg: 'bg-primary/15' },
  input:     { icon: KeyRound,     color: 'text-blue-400',   bg: 'bg-blue-400/15' },
  condition: { icon: GitBranch,    color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  api:       { icon: Globe,        color: 'text-purple-400', bg: 'bg-purple-400/15' },
  delay:     { icon: Clock,        color: 'text-orange-400', bg: 'bg-orange-400/15' },
  jump:      { icon: ArrowRight,   color: 'text-cyan-400',   bg: 'bg-cyan-400/15' },
  subflow:   { icon: Layers,       color: 'text-indigo-400', bg: 'bg-indigo-400/15' },
  handoff:   { icon: Headphones,   color: 'text-pink-400',   bg: 'bg-pink-400/15' },
  end:       { icon: Square,       color: 'text-red-400',    bg: 'bg-red-400/15' },
}

interface FlowNodeProps {
  id: string
  data: RFNodeData
  selected: boolean
  type: string
}

function FlowNodeInner({ data, selected }: FlowNodeProps) {
  const { nodeType, label, config } = data
  const meta = NODE_META[nodeType]
  const Icon = meta.icon
  const displayLabel = label ?? (nodeType.charAt(0).toUpperCase() + nodeType.slice(1))

  // Sub-text hint per type
  const hint =
    nodeType === 'message' ? String(config.text ?? '').slice(0, 40) || 'No text set'
    : nodeType === 'input' ? `→ ${config.variable ?? 'variable'}`
    : nodeType === 'delay' ? `${config.seconds ?? 0}s`
    : nodeType === 'api' ? `${config.method ?? 'GET'} ${String(config.url ?? '').slice(0, 25) || '(no url)'}`
    : nodeType === 'condition' ? 'Check edges for conditions'
    : nodeType === 'jump' ? (config.target_node_id ? 'Jump configured' : 'Select target node')
    : nodeType === 'subflow' ? (config.target_flow_id ? 'Subflow set' : 'Select a flow')
    : nodeType === 'handoff' ? String(config.message ?? '').slice(0, 35) || 'Handoff to agent'
    : nodeType === 'start' ? (config.greeting_message ? 'Greeting set' : 'No greeting')
    : nodeType === 'end' ? (config.farewell_message ? 'Farewell set' : 'No farewell')
    : ''

  const showTarget = nodeType !== 'start'
  const showSource = nodeType !== 'end'

  return (
    <div
      className={`min-w-[200px] max-w-[240px] rounded-xl border-2 bg-card px-3 py-2.5 shadow-md transition-all duration-150 ${
        selected
          ? 'border-primary ring-2 ring-primary/25 shadow-primary/10'
          : 'border-border hover:border-primary/40'
      }`}
    >
      {showTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-card !border-2 !border-muted-foreground/40 hover:!border-primary"
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
          <Icon size={13} className={meta.color} />
        </div>
        <span className="text-xs font-bold text-foreground truncate">{displayLabel}</span>
        <span className={`ml-auto text-[9px] font-semibold uppercase tracking-wider ${meta.color} opacity-60`}>
          {nodeType}
        </span>
      </div>

      {/* Hint */}
      {hint && (
        <p className="mt-1.5 text-[10px] text-muted-foreground leading-tight truncate pl-9">
          {hint}
        </p>
      )}

      {showSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-card !border-2 !border-primary/50 hover:!border-primary"
        />
      )}
    </div>
  )
}

const FlowNode = memo(FlowNodeInner)
export default FlowNode
```

- [ ] **Step 4: Create `src/components/dashboard/builder/nodes/nodeTypes.ts`**

```typescript
import FlowNode from './FlowNode'

export const nodeTypes = {
  flowNode: FlowNode,
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --run src/test/flow-builder/FlowNode.test.tsx
```
Expected: 6 tests PASS.

- [ ] **Step 6: Run all tests**

```bash
npm test -- --run
```
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/builder/nodes/ src/test/flow-builder/FlowNode.test.tsx
git commit -m "feat(phase3): add FlowNode custom component for all 10 node types"
```

---

## Task 5: `FlowList` left panel

**Files:**
- Create: `src/components/dashboard/builder/FlowList.tsx`

Shows all flows for the owner. Allows selecting, creating, renaming, and deleting flows. Shows publish status badge.

- [ ] **Step 1: Write the component**

Create `src/components/dashboard/builder/FlowList.tsx`:

```tsx
import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X, ChevronRight } from 'lucide-react'
import type { Flow } from '@/integrations/supabase/flow-types'
import type { useFlowBuilder } from '@/hooks/useFlowBuilder'

type FB = ReturnType<typeof useFlowBuilder>

interface FlowListProps {
  flows: FB['flows']
  selectedFlowId: FB['selectedFlowId']
  onSelectFlow: (id: string) => void
  onCreateFlow: (name: string) => Promise<unknown>
  onRenameFlow: (id: string, name: string) => Promise<void>
  onDeleteFlow: (id: string) => Promise<void>
}

export default function FlowList({
  flows, selectedFlowId, onSelectFlow, onCreateFlow, onRenameFlow, onDeleteFlow,
}: FlowListProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    await onCreateFlow(name)
    setNewName('')
    setCreating(false)
  }

  const handleStartRename = (flow: Flow, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(flow.id)
    setEditName(flow.name)
  }

  const handleConfirmRename = async () => {
    if (!editingId || !editName.trim()) { setEditingId(null); return }
    await onRenameFlow(editingId, editName.trim())
    setEditingId(null)
  }

  const handleDelete = async (flowId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this flow and all its nodes?')) return
    await onDeleteFlow(flowId)
  }

  return (
    <div className="w-52 shrink-0 border-r border-border bg-surface-raised flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">Flows</span>
        <button
          onClick={() => setCreating(true)}
          className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="New flow"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* New flow input */}
      {creating && (
        <div className="px-2 py-1.5 border-b border-border bg-muted/30 flex items-center gap-1">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
            placeholder="Flow name..."
            className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
          />
          <button onClick={handleCreate} className="text-primary hover:text-primary/80"><Check size={13} /></button>
          <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
        </div>
      )}

      {/* Flow list */}
      <div className="flex-1 overflow-y-auto py-1">
        {flows.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-6 px-3">
            No flows yet.<br />Click + to create one.
          </p>
        )}
        {flows.map(flow => (
          <div
            key={flow.id}
            onClick={() => onSelectFlow(flow.id)}
            className={`group flex items-center gap-1.5 px-2.5 py-2 cursor-pointer transition-colors ${
              flow.id === selectedFlowId
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <ChevronRight size={11} className={flow.id === selectedFlowId ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'} />

            {editingId === flow.id ? (
              <input
                autoFocus
                value={editName}
                onClick={e => e.stopPropagation()}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setEditingId(null) }}
                onBlur={handleConfirmRename}
                className="flex-1 text-xs bg-transparent outline-none border-b border-primary"
              />
            ) : (
              <span className="flex-1 text-xs font-medium truncate">{flow.name}</span>
            )}

            {/* Status badge */}
            <span className={`text-[8px] font-bold uppercase tracking-wider shrink-0 ${
              flow.status === 'published' ? 'text-green-400' : 'text-muted-foreground/50'
            }`}>
              {flow.status === 'published' ? 'Live' : 'Draft'}
            </span>

            {/* Actions (visible on hover) */}
            {editingId !== flow.id && (
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button
                  onClick={e => handleStartRename(flow, e)}
                  className="w-5 h-5 rounded flex items-center justify-center hover:bg-muted"
                >
                  <Pencil size={10} />
                </button>
                <button
                  onClick={e => handleDelete(flow.id, e)}
                  className="w-5 h-5 rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test -- --run
```
Expected: all tests PASS (no new tests for this UI-only component).

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/builder/FlowList.tsx
git commit -m "feat(phase3): add FlowList left panel for flow select/create/delete"
```

---

## Task 6: `FlowCanvas` React Flow canvas

**Files:**
- Create: `src/components/dashboard/builder/FlowCanvas.tsx`

Wraps `@xyflow/react`'s `ReactFlow` component. Provides a toolbar (zoom, fit, publish toggle) and a node-add palette that drops a node at a default position.

- [ ] **Step 1: Create `src/components/dashboard/builder/FlowCanvas.tsx`**

```tsx
import { useCallback, useRef } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Play, MessageSquare, KeyRound, GitBranch, Globe,
  Clock, ArrowRight, Layers, Headphones, Square,
  ZoomIn, ZoomOut, Maximize2, Zap, Globe2,
} from 'lucide-react'
import { nodeTypes } from './nodes/nodeTypes'
import type { NodeType } from '@/integrations/supabase/flow-types'
import type { RFNodeData, RFEdgeData } from '@/hooks/useFlowBuilder'
import type { Flow } from '@/integrations/supabase/flow-types'

const ADD_NODE_ITEMS: { type: NodeType; icon: React.ElementType; label: string }[] = [
  { type: 'start',     icon: Play,         label: 'Start' },
  { type: 'message',   icon: MessageSquare,label: 'Message' },
  { type: 'input',     icon: KeyRound,     label: 'Input' },
  { type: 'condition', icon: GitBranch,    label: 'Condition' },
  { type: 'api',       icon: Globe,        label: 'API Call' },
  { type: 'delay',     icon: Clock,        label: 'Delay' },
  { type: 'jump',      icon: ArrowRight,   label: 'Jump' },
  { type: 'subflow',   icon: Layers,       label: 'Sub-flow' },
  { type: 'handoff',   icon: Headphones,   label: 'Handoff' },
  { type: 'end',       icon: Square,       label: 'End' },
]

interface FlowCanvasProps {
  selectedFlow: Flow | null
  rfNodes: Node<RFNodeData>[]
  rfEdges: Edge<RFEdgeData>[]
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  onNodeClick: (nodeId: string) => void
  onEdgeClick: (edgeId: string) => void
  onAddNode: (type: NodeType, position: { x: number; y: number }) => Promise<void>
  onPublish: () => Promise<void>
  onUnpublish: () => Promise<void>
}

// Inner component that can use useReactFlow()
function CanvasInner({
  selectedFlow, rfNodes, rfEdges,
  onNodesChange, onEdgesChange, onConnect,
  onNodeClick, onEdgeClick, onAddNode, onPublish, onUnpublish,
}: FlowCanvasProps) {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const canvasRef = useRef<HTMLDivElement>(null)

  const handleAddNode = useCallback((type: NodeType) => {
    // Place new node near centre of current viewport
    const rect = canvasRef.current?.getBoundingClientRect()
    const x = rect ? (rect.width / 2) + Math.random() * 60 - 30 : 300
    const y = rect ? (rect.height / 2) + Math.random() * 60 - 30 : 200
    onAddNode(type, { x, y })
  }, [onAddNode])

  const isPublished = selectedFlow?.status === 'published'

  if (!selectedFlow) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <Globe2 size={40} className="mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Select a flow from the left panel to start editing</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={canvasRef} className="flex-1 relative flex flex-col overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        {/* Add-node palette */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-2 py-1.5 shadow-lg pointer-events-auto">
          {ADD_NODE_ITEMS.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => handleAddNode(type)}
              title={`Add ${label}`}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 bg-card border border-border rounded-lg p-0.5 shadow-lg">
            <button onClick={() => zoomOut()} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <ZoomOut size={13} />
            </button>
            <button onClick={() => fitView({ padding: 0.15, duration: 300 })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Maximize2 size={13} />
            </button>
            <button onClick={() => zoomIn()} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Publish toggle */}
          <button
            onClick={isPublished ? onUnpublish : onPublish}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg ${
              isPublished
                ? 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            <Zap size={12} />
            {isPublished ? 'Published' : 'Publish'}
          </button>
        </div>
      </div>

      {/* React Flow canvas */}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_e, node) => onNodeClick(node.id)}
        onEdgeClick={(_e, edge) => onEdgeClick(edge.id)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        className="bg-background"
        defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
      >
        <Background color="hsl(var(--border))" gap={20} size={1} />
        <MiniMap
          nodeColor={() => 'hsl(var(--primary))'}
          maskColor="hsl(var(--background) / 0.8)"
          className="!bg-card !border !border-border !rounded-xl"
        />
      </ReactFlow>
    </div>
  )
}

// Export wrapped in ReactFlowProvider (required by useReactFlow)
import { ReactFlowProvider } from '@xyflow/react'

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test -- --run
```
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/builder/FlowCanvas.tsx
git commit -m "feat(phase3): add FlowCanvas with @xyflow/react, add-node palette, publish toggle"
```

---

## Task 7: `NodeConfigPanel` right panel

**Files:**
- Create: `src/components/dashboard/builder/NodeConfigPanel.tsx`

Shows config fields for the currently selected node. Each node type has distinct fields. On change, calls `updateNodeConfig` with debounce.

- [ ] **Step 1: Create `src/components/dashboard/builder/NodeConfigPanel.tsx`**

```tsx
import { useEffect, useState, useRef } from 'react'
import { X, Settings2 } from 'lucide-react'
import type { FlowNode, NodeType } from '@/integrations/supabase/flow-types'
import type { Flow } from '@/integrations/supabase/flow-types'

const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'
const labelCls = 'block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1'
const textareaCls = inputCls + ' resize-none'
const selectCls = inputCls

interface NodeConfigPanelProps {
  node: FlowNode | null
  flows: Flow[]
  allNodes: FlowNode[]
  onClose: () => void
  onUpdateConfig: (nodeId: string, config: Record<string, unknown>, label?: string) => Promise<void>
  onDeleteNode: (nodeId: string) => Promise<void>
}

export default function NodeConfigPanel({
  node, flows, allNodes, onClose, onUpdateConfig, onDeleteNode,
}: NodeConfigPanelProps) {
  const [label, setLabel] = useState('')
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync state when selected node changes
  useEffect(() => {
    if (!node) return
    setLabel(node.label ?? '')
    setConfig(node.config)
  }, [node?.id])

  const schedSave = (newConfig: Record<string, unknown>, newLabel?: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (!node) return
      onUpdateConfig(node.id, newConfig, newLabel)
    }, 600)
  }

  const setField = (key: string, value: unknown) => {
    const next = { ...config, [key]: value }
    setConfig(next)
    schedSave(next, label)
  }

  const setLabelValue = (v: string) => {
    setLabel(v)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (!node) return
      onUpdateConfig(node.id, config, v)
    }, 600)
  }

  if (!node) {
    return (
      <div className="w-64 shrink-0 border-l border-border bg-surface-raised flex flex-col items-center justify-center text-center p-6">
        <Settings2 size={28} className="text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">Click a node to configure it</p>
      </div>
    )
  }

  const nodeType = node.node_type as NodeType

  return (
    <div className="w-64 shrink-0 border-l border-border bg-surface-raised flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-xs font-bold text-foreground capitalize">{nodeType} node</span>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground">
          <X size={13} />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Label (all types) */}
        <div>
          <label className={labelCls}>Label</label>
          <input
            className={inputCls}
            value={label}
            onChange={e => setLabelValue(e.target.value)}
            placeholder={nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}
          />
        </div>

        {/* ── Type-specific fields ── */}

        {nodeType === 'start' && (
          <div>
            <label className={labelCls}>Greeting message</label>
            <textarea
              className={textareaCls}
              rows={4}
              value={String(config.greeting_message ?? '')}
              onChange={e => setField('greeting_message', e.target.value)}
              placeholder="Hi! How can I help you today?"
            />
          </div>
        )}

        {nodeType === 'message' && (<>
          <div>
            <label className={labelCls}>Message text</label>
            <textarea
              className={textareaCls}
              rows={4}
              value={String(config.text ?? '')}
              onChange={e => setField('text', e.target.value)}
              placeholder="Type your message here..."
            />
          </div>
          <div>
            <label className={labelCls}>Media URL (optional)</label>
            <input className={inputCls} value={String(config.media_url ?? '')} onChange={e => setField('media_url', e.target.value)} placeholder="https://..." />
          </div>
          {config.media_url && (
            <div>
              <label className={labelCls}>Media type</label>
              <select className={selectCls} value={String(config.media_type ?? 'image')} onChange={e => setField('media_type', e.target.value)}>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="document">Document</option>
              </select>
            </div>
          )}
        </>)}

        {nodeType === 'input' && (<>
          <div>
            <label className={labelCls}>Prompt</label>
            <textarea className={textareaCls} rows={3} value={String(config.prompt ?? '')} onChange={e => setField('prompt', e.target.value)} placeholder="Please enter your response:" />
          </div>
          <div>
            <label className={labelCls}>Save to variable</label>
            <input className={inputCls} value={String(config.variable ?? '')} onChange={e => setField('variable', e.target.value)} placeholder="user_input" />
          </div>
          <div>
            <label className={labelCls}>Timeout (seconds)</label>
            <input type="number" className={inputCls} value={Number(config.timeout_seconds ?? 300)} onChange={e => setField('timeout_seconds', Number(e.target.value))} min={0} />
          </div>
        </>)}

        {nodeType === 'condition' && (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            Conditions live on the outgoing edges. Click an edge to configure its condition.
          </p>
        )}

        {nodeType === 'api' && (<>
          <div>
            <label className={labelCls}>Method</label>
            <select className={selectCls} value={String(config.method ?? 'GET')} onChange={e => setField('method', e.target.value)}>
              <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>URL</label>
            <input className={inputCls} value={String(config.url ?? '')} onChange={e => setField('url', e.target.value)} placeholder="https://api.example.com/..." />
          </div>
          <div>
            <label className={labelCls}>Response variable</label>
            <input className={inputCls} value={String(config.response_variable ?? '')} onChange={e => setField('response_variable', e.target.value)} placeholder="api_response" />
          </div>
          <div>
            <label className={labelCls}>Body (JSON)</label>
            <textarea className={textareaCls} rows={3} value={String(config.body ?? '')} onChange={e => setField('body', e.target.value)} placeholder={'{\n  "key": "value"\n}'} />
          </div>
        </>)}

        {nodeType === 'delay' && (
          <div>
            <label className={labelCls}>Delay (seconds)</label>
            <input type="number" className={inputCls} value={Number(config.seconds ?? 5)} onChange={e => setField('seconds', Number(e.target.value))} min={1} max={3600} />
          </div>
        )}

        {nodeType === 'jump' && (
          <div>
            <label className={labelCls}>Jump to node</label>
            <select className={selectCls} value={String(config.target_node_id ?? '')} onChange={e => setField('target_node_id', e.target.value)}>
              <option value="">— select a node —</option>
              {allNodes.filter(n => n.id !== node.id).map(n => (
                <option key={n.id} value={n.id}>{n.label ?? n.node_type} ({n.node_type})</option>
              ))}
            </select>
          </div>
        )}

        {nodeType === 'subflow' && (
          <div>
            <label className={labelCls}>Target flow</label>
            <select className={selectCls} value={String(config.target_flow_id ?? '')} onChange={e => setField('target_flow_id', e.target.value)}>
              <option value="">— select a flow —</option>
              {flows.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}

        {nodeType === 'handoff' && (<>
          <div>
            <label className={labelCls}>Message to customer</label>
            <textarea className={textareaCls} rows={3} value={String(config.message ?? '')} onChange={e => setField('message', e.target.value)} placeholder="Connecting you to an agent..." />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notify"
              checked={Boolean(config.notify ?? true)}
              onChange={e => setField('notify', e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="notify" className="text-xs text-muted-foreground">Notify reception phone</label>
          </div>
        </>)}

        {nodeType === 'end' && (
          <div>
            <label className={labelCls}>Farewell message</label>
            <textarea className={textareaCls} rows={4} value={String(config.farewell_message ?? '')} onChange={e => setField('farewell_message', e.target.value)} placeholder="Thank you! Goodbye." />
          </div>
        )}
      </div>

      {/* Footer — delete button */}
      <div className="px-3 py-2.5 border-t border-border">
        <button
          onClick={() => { if (confirm('Delete this node?')) onDeleteNode(node.id) }}
          className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
        >
          Delete node
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test -- --run
```
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/builder/NodeConfigPanel.tsx
git commit -m "feat(phase3): add NodeConfigPanel with per-type config forms for all 10 node types"
```

---

## Task 8: `EdgeConfigPanel` + `TriggerPanel`

**Files:**
- Create: `src/components/dashboard/builder/EdgeConfigPanel.tsx`
- Create: `src/components/dashboard/builder/TriggerPanel.tsx`

`EdgeConfigPanel` is a small popover-style panel shown in the right area when an edge is selected.
`TriggerPanel` is a Dialog listing triggers for the selected flow.

- [ ] **Step 1: Create `src/components/dashboard/builder/EdgeConfigPanel.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { FlowEdge, ConditionType } from '@/integrations/supabase/flow-types'

const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'
const labelCls = 'block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1'
const selectCls = inputCls

const CONDITION_TYPES: { value: ConditionType; label: string }[] = [
  { value: 'always',           label: 'Always (default)' },
  { value: 'equals',           label: 'Input equals' },
  { value: 'contains',         label: 'Input contains' },
  { value: 'starts_with',      label: 'Input starts with' },
  { value: 'regex',            label: 'Input matches regex' },
  { value: 'variable_equals',  label: 'Variable equals' },
  { value: 'variable_contains',label: 'Variable contains' },
]

interface EdgeConfigPanelProps {
  edge: FlowEdge | null
  onClose: () => void
  onUpdate: (edgeId: string, params: Partial<FlowEdge>) => Promise<void>
  onDelete: (edgeId: string) => Promise<void>
}

export default function EdgeConfigPanel({ edge, onClose, onUpdate, onDelete }: EdgeConfigPanelProps) {
  const [condType, setCondType] = useState<ConditionType>('always')
  const [condValue, setCondValue] = useState('')
  const [condVar, setCondVar] = useState('')
  const [isFallback, setIsFallback] = useState(false)
  const [priority, setPriority] = useState(0)
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!edge) return
    setCondType(edge.condition_type)
    setCondValue(edge.condition_value ?? '')
    setCondVar(edge.condition_variable ?? '')
    setIsFallback(edge.is_fallback)
    setPriority(edge.priority)
    setLabel(edge.label ?? '')
  }, [edge?.id])

  const handleSave = () => {
    if (!edge) return
    onUpdate(edge.id, {
      condition_type: condType,
      condition_value: condType === 'always' ? null : condValue || null,
      condition_variable: (condType === 'variable_equals' || condType === 'variable_contains') ? condVar || null : null,
      is_fallback: isFallback,
      priority,
      label: label || null,
    })
  }

  if (!edge) {
    return (
      <div className="w-64 shrink-0 border-l border-border bg-surface-raised flex items-center justify-center">
        <p className="text-xs text-muted-foreground text-center px-4">Click an edge to configure its condition</p>
      </div>
    )
  }

  const needsValue = condType !== 'always'
  const needsVar = condType === 'variable_equals' || condType === 'variable_contains'

  return (
    <div className="w-64 shrink-0 border-l border-border bg-surface-raised flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-xs font-bold text-foreground">Edge condition</span>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground">
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <label className={labelCls}>Label</label>
          <input className={inputCls} value={label} onChange={e => setLabel(e.target.value)} placeholder="Optional label" />
        </div>

        <div>
          <label className={labelCls}>Condition type</label>
          <select className={selectCls} value={condType} onChange={e => setCondType(e.target.value as ConditionType)}>
            {CONDITION_TYPES.map(ct => (
              <option key={ct.value} value={ct.value}>{ct.label}</option>
            ))}
          </select>
        </div>

        {needsValue && (
          <div>
            <label className={labelCls}>Value to match</label>
            <input className={inputCls} value={condValue} onChange={e => setCondValue(e.target.value)} placeholder="e.g. yes / .*order.* / hello" />
          </div>
        )}

        {needsVar && (
          <div>
            <label className={labelCls}>Variable name</label>
            <input className={inputCls} value={condVar} onChange={e => setCondVar(e.target.value)} placeholder="e.g. user_answer" />
          </div>
        )}

        <div>
          <label className={labelCls}>Priority (lower = checked first)</label>
          <input type="number" className={inputCls} value={priority} onChange={e => setPriority(Number(e.target.value))} min={0} />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="fallback" checked={isFallback} onChange={e => setIsFallback(e.target.checked)} className="rounded border-border" />
          <label htmlFor="fallback" className="text-xs text-muted-foreground">Fallback edge (taken when no other matches)</label>
        </div>
      </div>

      <div className="px-3 py-2.5 border-t border-border flex flex-col gap-2">
        <button onClick={handleSave} className="w-full px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors">
          Save condition
        </button>
        <button onClick={() => { if (confirm('Delete this edge?')) onDelete(edge.id) }} className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors">
          Delete edge
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/dashboard/builder/TriggerPanel.tsx`**

```tsx
import { useState } from 'react'
import { Plus, Trash2, Zap } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import type { FlowTrigger, TriggerType } from '@/integrations/supabase/flow-types'

const TRIGGER_TYPES: { value: TriggerType; label: string; desc: string }[] = [
  { value: 'keyword',  label: 'Keyword',  desc: 'Triggered when message matches a keyword' },
  { value: 'default',  label: 'Default',  desc: 'Triggered when no other flow matches (only one allowed per owner)' },
  { value: 'restart',  label: 'Restart',  desc: 'Triggered by a "start over" keyword (e.g. "hi", "menu")' },
  { value: 'api',      label: 'API',      desc: 'Triggered programmatically via API call' },
]

const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'
const labelCls = 'block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1'

interface TriggerPanelProps {
  triggers: FlowTrigger[]
  flowId: string | null
  onAddTrigger: (trigger: Omit<FlowTrigger, 'id' | 'owner_id' | 'created_at'>) => Promise<void>
  onRemoveTrigger: (id: string) => Promise<void>
}

export default function TriggerPanel({ triggers, flowId, onAddTrigger, onRemoveTrigger }: TriggerPanelProps) {
  const [open, setOpen] = useState(false)
  const [triggerType, setTriggerType] = useState<TriggerType>('keyword')
  const [triggerValue, setTriggerValue] = useState('')
  const [priority, setPriority] = useState(0)
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!flowId) return
    if (triggerType !== 'default' && !triggerValue.trim()) return
    setSaving(true)
    try {
      await onAddTrigger({
        flow_id: flowId,
        target_node_id: null,
        trigger_type: triggerType,
        trigger_value: triggerType === 'default' ? null : triggerValue.trim(),
        priority,
        is_active: true,
      })
      setTriggerValue('')
      setPriority(0)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          title="Manage triggers"
        >
          <Zap size={13} className="text-yellow-400" />
          Triggers {triggers.length > 0 && <span className="text-primary">({triggers.length})</span>}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Flow Triggers</DialogTitle>
        </DialogHeader>

        {/* Existing triggers */}
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {triggers.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">No triggers yet. Add one below.</p>
          )}
          {triggers.map(t => (
            <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
              <Zap size={11} className="text-yellow-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground capitalize">{t.trigger_type}</p>
                {t.trigger_value && <p className="text-[10px] text-muted-foreground truncate">"{t.trigger_value}"</p>}
              </div>
              <span className={`text-[9px] font-bold uppercase ${t.is_active ? 'text-primary' : 'text-muted-foreground'}`}>
                {t.is_active ? 'active' : 'off'}
              </span>
              <button
                onClick={() => onRemoveTrigger(t.id)}
                className="w-5 h-5 rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>

        {/* Add trigger form */}
        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-xs font-bold text-foreground">Add trigger</p>

          <div>
            <label className={labelCls}>Type</label>
            <select className={inputCls} value={triggerType} onChange={e => setTriggerType(e.target.value as TriggerType)}>
              {TRIGGER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
              ))}
            </select>
          </div>

          {triggerType !== 'default' && (
            <div>
              <label className={labelCls}>Keyword / value</label>
              <input
                className={inputCls}
                value={triggerValue}
                onChange={e => setTriggerValue(e.target.value)}
                placeholder={triggerType === 'keyword' ? 'e.g. "order", "hi"' : triggerType === 'restart' ? 'e.g. "menu", "start"' : 'API trigger value'}
              />
            </div>
          )}

          <div>
            <label className={labelCls}>Priority (lower checked first)</label>
            <input type="number" className={inputCls} value={priority} onChange={e => setPriority(Number(e.target.value))} min={0} />
          </div>

          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Plus size={13} />
            {saving ? 'Adding...' : 'Add trigger'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
npm test -- --run
```
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/builder/EdgeConfigPanel.tsx src/components/dashboard/builder/TriggerPanel.tsx
git commit -m "feat(phase3): add EdgeConfigPanel and TriggerPanel for edge conditions and flow triggers"
```

---

## Task 9: `FlowBuilderPage` + route update

**Files:**
- Create: `src/components/dashboard/builder/FlowBuilderPage.tsx`
- Modify: `src/App.tsx`

Wires all Phase 3 components together. Handles node/edge selection routing to the correct panel. Updates `App.tsx` to import `FlowBuilderPage`.

- [ ] **Step 1: Create `src/components/dashboard/builder/FlowBuilderPage.tsx`**

```tsx
import { useEffect, useCallback } from 'react'
import { useDashboard } from '@/contexts/DashboardContext'
import { useFlowBuilder } from '@/hooks/useFlowBuilder'
import FlowList from './FlowList'
import FlowCanvas from './FlowCanvas'
import NodeConfigPanel from './NodeConfigPanel'
import EdgeConfigPanel from './EdgeConfigPanel'
import TriggerPanel from './TriggerPanel'
import type { FlowNode } from '@/integrations/supabase/flow-types'

export default function FlowBuilderPage() {
  const { user } = useDashboard()
  const fb = useFlowBuilder(user?.id ?? null)

  // Auto-select first flow on load
  useEffect(() => {
    if (!fb.selectedFlowId && fb.flows.length > 0) {
      fb.selectFlow(fb.flows[0].id)
    }
  }, [fb.flows.length, fb.selectedFlowId])

  const selectedFlow = fb.flows.find(f => f.id === fb.selectedFlowId) ?? null
  const selectedNode = fb.selectedNodeId ? fb.getFlowNode(fb.selectedNodeId) ?? null : null
  const selectedEdge = fb.selectedEdgeId ? fb.getFlowEdge(fb.selectedEdgeId) ?? null : null

  // dbNodes for jump/subflow selectors in NodeConfigPanel
  const allDbNodes = fb.rfNodes.map(n => ({
    id: n.id,
    node_type: (n.data as any).nodeType,
    label: (n.data as any).label,
  } as unknown as FlowNode))

  // Node click: deselect edge, select node
  const handleNodeClick = useCallback((nodeId: string) => {
    fb.setSelectedEdgeId(null)
    fb.setSelectedNodeId(nodeId === fb.selectedNodeId ? null : nodeId)
  }, [fb])

  // Edge click: deselect node, select edge
  const handleEdgeClick = useCallback((edgeId: string) => {
    fb.setSelectedNodeId(null)
    fb.setSelectedEdgeId(edgeId === fb.selectedEdgeId ? null : edgeId)
  }, [fb])

  const handlePublish = useCallback(async () => {
    if (!fb.selectedFlowId) return
    // Validate: must have a start node
    const hasStart = fb.rfNodes.some(n => (n.data as any).nodeType === 'start')
    if (!hasStart) {
      alert('A flow must have at least one Start node before publishing.')
      return
    }
    await fb.publishFlow(fb.selectedFlowId)
  }, [fb])

  const handleUnpublish = useCallback(async () => {
    if (!fb.selectedFlowId) return
    await fb.unpublishFlow(fb.selectedFlowId)
  }, [fb])

  const showNodePanel = !!fb.selectedNodeId
  const showEdgePanel = !showNodePanel && !!fb.selectedEdgeId

  return (
    <div className="h-[calc(100vh-52px)] flex overflow-hidden">
      {/* Left: Flow list */}
      <FlowList
        flows={fb.flows}
        selectedFlowId={fb.selectedFlowId}
        onSelectFlow={fb.selectFlow}
        onCreateFlow={async (name) => { await fb.createFlow(name) }}
        onRenameFlow={fb.renameFlow}
        onDeleteFlow={fb.deleteFlow}
      />

      {/* Centre: Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Canvas toolbar row with Triggers button */}
        {selectedFlow && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
            <span className="text-xs font-bold text-foreground">{selectedFlow.name}</span>
            <TriggerPanel
              triggers={fb.triggers}
              flowId={fb.selectedFlowId}
              onAddTrigger={fb.addTrigger}
              onRemoveTrigger={fb.removeTrigger}
            />
          </div>
        )}
        <FlowCanvas
          selectedFlow={selectedFlow}
          rfNodes={fb.rfNodes}
          rfEdges={fb.rfEdges}
          onNodesChange={fb.onNodesChange}
          onEdgesChange={fb.onEdgesChange}
          onConnect={fb.onConnect}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onAddNode={fb.addNode}
          onPublish={handlePublish}
          onUnpublish={handleUnpublish}
        />
      </div>

      {/* Right: Node config or Edge config */}
      {showNodePanel && (
        <NodeConfigPanel
          node={selectedNode}
          flows={fb.flows}
          allNodes={allDbNodes}
          onClose={() => fb.setSelectedNodeId(null)}
          onUpdateConfig={fb.updateNodeConfig}
          onDeleteNode={fb.deleteNode}
        />
      )}
      {showEdgePanel && (
        <EdgeConfigPanel
          edge={selectedEdge}
          onClose={() => fb.setSelectedEdgeId(null)}
          onUpdate={fb.updateEdge}
          onDelete={fb.deleteEdge}
        />
      )}
      {!showNodePanel && !showEdgePanel && (
        <NodeConfigPanel
          node={null}
          flows={fb.flows}
          allNodes={allDbNodes}
          onClose={() => {}}
          onUpdateConfig={fb.updateNodeConfig}
          onDeleteNode={fb.deleteNode}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `src/App.tsx` — swap `BuilderPage` import for `FlowBuilderPage`**

In `src/App.tsx`:

```typescript
// REMOVE:
import BuilderPage from "./components/dashboard/builder/BuilderPage";

// ADD:
import FlowBuilderPage from "./components/dashboard/builder/FlowBuilderPage";
```

And in the routes:

```tsx
// CHANGE:
<Route path="builder" element={<BuilderPage />} />

// TO:
<Route path="builder" element={<FlowBuilderPage />} />
```

- [ ] **Step 3: Run all tests**

```bash
npm test -- --run
```
Expected: all tests PASS.

- [ ] **Step 4: Start dev server and do a manual smoke check**

```bash
npm run dev
```

Navigate to `http://localhost:8080/dashboard/builder`. Expected:
- Left panel shows flow list (empty or with migrated flows)
- Click `+` to create a flow named "Test Flow" → appears in list
- Click flow → empty canvas
- Click a node type in the top palette → node appears on canvas
- Click node → right panel shows config fields
- Drag two nodes' handles to connect → edge appears
- Click edge → right panel shows edge condition config
- Click "Publish" → flow status changes to "Published" (green Live badge in list)
- Triggers button → dialog opens, can add a keyword trigger

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/builder/FlowBuilderPage.tsx src/App.tsx
git commit -m "feat(phase3): add FlowBuilderPage, wire all panels, update App.tsx route"
```

---

## Self-Review

**Spec coverage:**
- ✅ Replace `BuilderPage` with React Flow canvas — Task 9
- ✅ Custom node components for all 10 types — Task 4
- ✅ Multi-flow sidebar — Task 5
- ✅ Node config panels per type — Task 7
- ✅ Publish validation UI — Task 9 (requires start node)
- ✅ Trigger management UI — Task 8

**Placeholder scan:** None found. All steps include complete code.

**Type consistency:**
- `RFNodeData` defined in `useFlowBuilder.ts`, imported in `FlowNode.tsx` ✅
- `nodeTypes` map in `nodeTypes.ts` uses `FlowNode` from `./FlowNode` ✅
- `useFlowBuilder` return type used as `FB` in `FlowList` ✅
- `FlowCanvas` imports `nodeTypes` from `./nodes/nodeTypes` ✅
- `FlowBuilderPage` calls `fb.getFlowNode(id)` which returns `FlowNode | undefined` ✅

**Known scope boundary:** `@xyflow/react`'s `ReactFlow` component requires CSS import. This is done in `FlowCanvas.tsx` via `import '@xyflow/react/dist/style.css'`. The CSS only applies inside the ReactFlow container div.
