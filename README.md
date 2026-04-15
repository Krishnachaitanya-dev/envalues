# AlaChat / Envalues

AlaChat, maintained in the Envalues repository, is a multi-tenant conversational automation platform for WhatsApp-based businesses. It combines a React dashboard, a graph-based flow builder, Supabase-backed runtime services, and edge functions for inbound webhooks, outbound messaging, billing, reminders, and admin operations.

The app is designed around named conversation flows rather than a single hardcoded chatbot tree. Owners can configure WhatsApp credentials, build and publish flows, manage contacts and clients, send broadcasts, monitor analytics, hand conversations to an inbox, and manage billing. Admin users get a separate workspace for platform activity, revenue, users, security, and Evolution connection management.

## Core Capabilities

- Flow builder for graph-based WhatsApp automations, including nodes, edges, triggers, templates, media, and draft/published flow states.
- Runtime engine for inbound WhatsApp messages with trigger routing, session handling, node execution, edge evaluation, and duplicate message protection.
- Dashboard workspace for overview, builder, settings, billing, analytics, inbox, contacts, clients, broadcast, and help content.
- Admin workspace for platform overview, user management, revenue, activity, security, and Evolution integration status.
- Supabase Auth, Postgres, Storage, generated database types, and edge functions.
- Razorpay subscription and webhook support.
- Broadcast and direct-message functions for owner-managed WhatsApp accounts.

## Architecture

### Frontend

- React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, and shadcn/ui components.
- React Flow powers the visual flow-builder canvas.
- Supabase browser client is imported from `src/integrations/supabase/client.ts`.
- Main routing is defined in `src/App.tsx`.

### Backend and Data

- Supabase Postgres stores owners, subscriptions, audit logs, legacy chatbot records, flow data, sessions, contacts, inbox logs, template data, and related runtime state.
- Supabase Auth controls owner sessions in the browser.
- Supabase Storage is used for chatbot and flow media.
- Supabase Edge Functions provide webhook handling, messaging, billing, reminders, client creation, and Evolution integration.
- Database migrations live under `supabase/migrations`.

### Conversation Runtime

Inbound messages arrive through `supabase/functions/whatsapp-webhook`. The runtime resolves the tenant, checks duplicate messages, chooses an active session or trigger entry point, executes flow nodes, evaluates edges, persists state, and sends outbound WhatsApp messages through the configured provider.

Important runtime areas:

- `supabase/functions/whatsapp-webhook/engine/trigger-engine.ts`
- `supabase/functions/whatsapp-webhook/engine/turn-executor.ts`
- `supabase/functions/whatsapp-webhook/engine/node-executors.ts`
- `supabase/functions/whatsapp-webhook/engine/edge-evaluator.ts`

### Integrations

- WhatsApp Cloud API for inbound and outbound customer messaging.
- Evolution API for connection management and reminder delivery workflows.
- Razorpay for subscriptions and payment webhooks.
- Netlify for frontend hosting.

## Routes

Public routes:

- `/` - landing page
- `/login` - owner login
- `/signup` - owner signup
- `/forgot-password` - password reset request
- `/reset-password` - password reset completion
- `/auth/callback` - Supabase auth callback
- `/profile` - owner profile

Dashboard routes:

- `/dashboard` - owner overview
- `/dashboard/builder` - flow builder
- `/dashboard/settings` - WhatsApp and account settings
- `/dashboard/billing` - subscription management
- `/dashboard/analytics` - flow and messaging analytics
- `/dashboard/inbox` - human handoff inbox
- `/dashboard/contacts` - contacts
- `/dashboard/clients` - client accounts
- `/dashboard/broadcast` - broadcast messages
- `/dashboard/help` - help articles

Admin routes:

- `/admin` - admin overview
- `/admin/users` - users and enterprise settings
- `/admin/revenue` - revenue
- `/admin/activity` - platform activity
- `/admin/security` - security events
- `/admin/evolution` - Evolution connection tools

## Local Setup

Use Node.js 20. Netlify is configured to build with Node 20, so matching it locally avoids version drift.

```sh
npm install
cp .env.example .env.local
npm run dev
```

The Vite dev server prints the local URL after startup, usually `http://localhost:5173`.

## Environment Variables

Do not commit real secrets. Keep local values in `.env.local`, and configure production values in Supabase, Netlify, or the relevant hosting environment.

Browser variables used by the Vite app:

```sh
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Supabase and function variables:

```sh
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

WhatsApp variables:

```sh
WHATSAPP_API_URL=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

Razorpay variables:

```sh
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_PLAN_ID=
RAZORPAY_WEBHOOK_SECRET=
```

Evolution and reminder variables:

```sh
EVOLUTION_URL=
EVOLUTION_KEY=
EVOLUTION_INSTANCE=
```

Scheduler compatibility variable:

```sh
SUPABASE_SERVICE_KEY=
```

Most owner-specific WhatsApp credentials are stored in Supabase owner records after setup. The WhatsApp environment variables are used by webhook or broadcast functions as provider-level configuration or fallbacks.

## Scripts

```sh
npm run dev
npm run build
npm run build:dev
npm run preview
npm run lint
npm test
npm run test:watch
```

- `dev` starts the Vite development server.
- `build` creates a production build in `dist`.
- `build:dev` builds with Vite's development mode.
- `preview` serves the built app locally.
- `lint` runs ESLint across the repository.
- `test` runs the Vitest suite once.
- `test:watch` runs Vitest in watch mode.

## Supabase Functions

The current edge-function surface includes:

- `whatsapp-webhook` - inbound WhatsApp webhook and flow runtime entry point.
- `send-message` - direct outbound WhatsApp message sending.
- `send-broadcast` - broadcast delivery.
- `create-client` - client account creation.
- `create-subscription` - Razorpay subscription creation.
- `cancel-subscription` - subscription cancellation.
- `razorpay-webhook` - Razorpay webhook verification and handling.
- `evolution-webhook` - Evolution webhook integration.
- `process-reminders` - scheduled reminder delivery.

Function JWT settings are configured in `supabase/config.toml`. Public provider webhooks are configured with `verify_jwt = false` where required.

## Deployment

Netlify deployment is configured in `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `20`
- SPA fallback: all routes redirect to `/index.html`
- Security and asset-cache headers are configured for deployed responses.

Supabase functions, migrations, storage buckets, and function secrets are deployed through the Supabase workflow for the target project.

## Development Workflow

1. Query the graphify knowledge graph before architecture or codebase work.
2. Keep source changes scoped to the requested feature or fix.
3. Run focused tests for the touched area, then broader checks when runtime behavior changes.
4. For docs-only work, verify the README diff and run the test suite when practical.
5. If code files change, run `python -m graphify update .` so `graphify-out/` stays current.

Useful checks:

```sh
npm test -- --run
npm run build
```

Known build warnings may include stale Browserslist data or large Vite chunks, depending on dependency state.
