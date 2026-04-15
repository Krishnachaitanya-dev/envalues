# Task: Build In-App Help System

## Project
AlaChat at `C:/Users/krish/Projects/envalues`
Branch: `main`
Path alias: `@/*` → `src/*`
Stack: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui (Radix) + React Router v6

## Goal
Build a complete in-app help/documentation system at `/dashboard/help`. Customers should be able to learn every AlaChat feature from this page without leaving the app.

## Design
- Left sidebar: article navigation (collapsible sections)
- Right area: article content with section headings, numbered steps, code examples, callout boxes
- Dark theme matching the rest of the app
- Mobile: sidebar collapses to a dropdown

## Files to Create/Modify

### New files to create:

**`src/components/dashboard/help/HelpPage.tsx`** — Main layout
- Left sidebar (~240px) with article nav
- Content area (flex-1)
- Active article highlighted in sidebar
- URL hash navigation: clicking article updates `?article=<id>`
- Default article: `getting-started`

**`src/components/dashboard/help/HelpArticle.tsx`** — Reusable article renderer
- Props: `title`, `sections: Section[]`
- Each `Section` has `heading`, `body` (ReactNode)
- Renders section headings (h2 style), body content

**`src/components/dashboard/help/articles/GettingStarted.tsx`**
Content:
1. **Welcome to AlaChat** — WhatsApp chatbot builder for businesses
2. **Quick Start (5 steps)**:
   1. Connect your WhatsApp number in Settings → WhatsApp
   2. Create your first Flow in the Builder
   3. Add a Start node + Message node
   4. Set a trigger keyword (e.g. "hi")
   5. Publish the flow and test it
3. **What you can build** — appointment bots, lead capture, customer support, broadcasting

**`src/components/dashboard/help/articles/FlowBuilder.tsx`**
Content:
1. **What is a Flow?** — automated conversation script
2. **Node Types** (one subsection per type):
   - **Start** — entry point, every flow needs one
   - **Message** — sends text, images, videos, PDFs, or quick reply buttons (up to 3)
   - **Input** — asks user a question, saves their reply to a variable (e.g. `{{name}}`)
   - **Condition** — branch based on variable value or text match
   - **API** — call an external webhook/API with context variables
   - **Delay** — pause execution (useful before follow-up messages)
   - **Jump** — jump to another node or flow
   - **Subflow** — nest another flow inside this one
   - **Handoff** — transfer to human agent in Inbox
   - **End** — close the session
3. **Connecting nodes** — drag from a node's right handle to another node's left handle
4. **Using variables** — `{{variable_name}}` in message text gets replaced with saved values
5. **Publishing** — click Publish to make a flow live; Unpublish to stop it

**`src/components/dashboard/help/articles/Triggers.tsx`**
Content:
1. **What are triggers?** — rules that start a flow when a user sends a message
2. **Trigger types**:
   - **Keyword** — exact or partial match (e.g. "hi", "book appointment")
   - **Default** — fires when no keyword matches (one per account)
   - **Restart** — kills active session and restarts (e.g. "menu", "start over")
   - **API** — triggered programmatically
3. **Priority** — lower number = checked first. Use 0 for most important
4. **Managing triggers** — click ⚡ Triggers button on canvas, add/remove triggers per flow
5. **Tip**: always add a `hi` keyword trigger as the main entry point

**`src/components/dashboard/help/articles/WhatsAppSetup.tsx`**
Content:
1. **Prerequisites** — Meta Business account, WhatsApp Business API app
2. **3 credentials needed**:
   - **Business Number** — your WhatsApp phone number (e.g. +91XXXXXXXXXX)
   - **Phone Number ID** — found in Meta Developer Portal → WhatsApp → API Setup
   - **Access Token** — permanent system user token from Meta Business Manager
3. **Step-by-step setup** in Settings → WhatsApp
4. **Webhook URL** — `https://tbfmturpclqponehhdjq.supabase.co/functions/v1/whatsapp-webhook`
5. **Verify Token** — set in Meta webhook config, must match `WHATSAPP_VERIFY_TOKEN` env var
6. **Troubleshooting** — invalid token (check credentials), not receiving messages (check webhook URL)

**`src/components/dashboard/help/articles/InboxHandoff.tsx`**
Content:
1. **What is Inbox?** — live chat panel where agents see real conversations
2. **How handoff works** — add a Handoff node to a flow; when reached, bot goes silent
3. **Inbox UI**:
   - Orange "HANDOFF" badge = waiting for agent
   - Green "ACTIVE" badge = bot is handling
   - Click a conversation to open it
   - Type a reply and hit Send to reply as agent
4. **Release to Bot** — click this button to let the bot resume handling the conversation
5. **End Chat** — closes the session entirely

**`src/components/dashboard/help/articles/Broadcasting.tsx`**
Content:
1. **What is Broadcasting?** — send a message to multiple contacts at once
2. **Creating a broadcast** — go to Broadcast page, compose message, upload contacts CSV
3. **CSV format** — one phone per line, international format (+91XXXXXXXXXX)
4. **Scheduling** — set a send time or send immediately
5. **Limits** — WhatsApp enforces rate limits; AlaChat respects them

**`src/components/dashboard/help/articles/Scheduler.tsx`**
Content:
1. **What is the Scheduler?** — automated reminders and follow-up messages
2. **Creating a reminder** — go to Scheduler, set phone number, message, date/time
3. **Use cases** — appointment reminders, follow-ups, re-engagement
4. **Cancelling** — delete a scheduled message before it fires

### Modify existing files:

**`src/App.tsx`** — Add route:
```tsx
import HelpPage from '@/components/dashboard/help/HelpPage'
// Inside the /dashboard/* route section:
<Route path="help" element={<HelpPage />} />
```

**`src/components/dashboard/DashboardSidebar.tsx`** — Add Help link:
- Import `HelpCircle` from lucide-react
- Add a "Help" nav item linking to `/dashboard/help`
- Place it near the bottom of the nav, above any logout/settings links
- Same styling as other nav items

## Article Nav Structure (for HelpPage sidebar)

```
Getting Started
Flow Builder
  - Node Types
  - Connections
  - Variables
  - Publishing
Triggers
WhatsApp Setup
Inbox & Handoff
Broadcasting
Scheduler
```

## Styling Guidelines
- Use existing Tailwind dark theme CSS variables: `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-primary`
- Article headings: `text-lg font-bold text-foreground`
- Section headings: `text-sm font-bold text-foreground mt-6 mb-2`
- Body text: `text-sm text-muted-foreground leading-relaxed`
- Code/values in `<code className="px-1.5 py-0.5 rounded bg-muted text-primary text-xs font-mono">`
- Callout/tip boxes: `rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary`
- Warning boxes: `rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-400`
- Numbered steps: `ol` with `list-decimal pl-5 space-y-2 text-sm text-muted-foreground`

## Run Tests
```bash
cd "C:/Users/krish/Projects/envalues"
npm run test
```
All tests must pass.

## Commit
```bash
git add -A
git commit -m "feat: add in-app help system with 7 articles"
```

## Done Criteria
- `/dashboard/help` route renders HelpPage
- All 7 articles accessible via sidebar nav
- DashboardSidebar has "Help" link
- Articles contain accurate, complete content for all features
- All tests pass
