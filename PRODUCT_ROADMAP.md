# AlaChat — Product Roadmap & Admin Dashboard Specification

> **Document Purpose:** Comprehensive overview of missing customer-facing features, platform improvements, and a full Admin Dashboard specification for the AlaChat platform owner.
> **Date:** March 2026

---

## Table of Contents

1. [Customer-Facing Gaps & Improvements](#1-customer-facing-gaps--improvements)
2. [Admin Dashboard — Platform Owner View](#2-admin-dashboard--platform-owner-view)
3. [Priority Matrix](#3-priority-matrix)
4. [Implementation Order](#4-implementation-order)

---

## 1. Customer-Facing Gaps & Improvements

These are features missing from the current product that paying customers will ask for — organized by impact.

---

### 1.1 Analytics & Insights Dashboard

**The Problem:** Once a chatbot goes live, the owner is completely blind. They have no idea if the bot is working, how many customers are using it, or which flows are most popular.

**What to Build:**

| Metric | Description |
|---|---|
| Total conversations | Unique customer sessions per day/week/month |
| Messages exchanged | Total inbound + outbound message count |
| Button click heatmap | Which menu options customers click most |
| Drop-off points | Where in the flow customers abandon the conversation |
| Active hours | What time of day customers message most |
| Resolution rate | How many chats reached a farewell vs. dropped |

**UI:**
- A new `/dashboard/analytics` page
- Date range picker (today / 7d / 30d / custom)
- Bar charts for conversations over time
- Tree view showing click counts per node in the flow
- Export to CSV button

**Data Source:** Already captured in `customer_sessions` table. Needs aggregation queries and a new Supabase view or edge function.

---

### 1.2 Conversation History & Inbox

**The Problem:** Business owners cannot review what customers said. They have no context on customer needs, complaints, or frequently asked questions.

**What to Build:**

- `/dashboard/inbox` page listing all customer conversations
- Each row: customer phone number (masked), last message, timestamp, session status
- Click to expand full conversation thread (message-by-message view, WhatsApp-style)
- Search by phone number or keyword
- Filter: today / unresolved / all time

**Data Source:**
- Need a new `messages` table to log every inbound and outbound message with timestamp, direction, and content
- Currently messages are processed and discarded — they must be persisted

**Schema Addition:**
```sql
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES chatbots(id),
  customer_phone text NOT NULL,
  direction text CHECK (direction IN ('inbound', 'outbound')),
  content text NOT NULL,
  message_type text DEFAULT 'text', -- text | button | interactive
  created_at timestamptz DEFAULT now()
);
```

---

### 1.3 Human Takeover / Live Chat Escalation

**The Problem:** Every real business hits conversations the bot cannot handle. Right now the bot says "I don't understand" and the customer walks away.

**What to Build:**

- **"Talk to Agent" button** — special Q&A pair that flags the session as needing human attention
- **Escalation inbox** — shows conversations waiting for human response
- **Manual reply box** — owner can type and send a WhatsApp message directly from the dashboard
- **Takeover mode** — while an agent is active in the conversation, bot responses are paused
- **Notification** — browser notification or email when a customer requests human help

**Session State Changes:**
- Add `session_status: 'bot' | 'human' | 'closed'` to `customer_sessions`
- Edge function checks status before auto-responding: if `human`, skip bot logic

---

### 1.4 Chatbot Preview & Testing (Before Going Live)

**The Problem:** Users build a flow, have no way to test it, and hesitate to pay ₹500 to go live without confidence it works. This directly hurts conversion.

**What to Build:**

- **Interactive preview panel** in the Builder page (extend existing right panel)
- Clicking buttons in the preview simulates customer interactions
- Shows exactly what a customer would see (button labels, response text, next options)
- "Restart" button to reset simulation to the greeting
- Separate from the static WhatsApp preview currently shown

**No backend needed** — simulation runs entirely client-side using the Q&A tree already in memory.

---

### 1.5 Rich Media Support

**The Problem:** WhatsApp Business API supports images, PDFs, videos, and list messages. AlaChat only uses plain text and 3-button interactive messages, which severely limits real-world usefulness.

**What to Add:**

| Type | Use Case |
|---|---|
| Image | Restaurant menu photo, product image |
| PDF | Service brochure, price list |
| List message | Up to 10 options (vs. current 3-button limit) |
| Video | Product demo, tutorial |
| Location | Show shop address on map |

**Implementation:**
- Extend Q&A pair schema with `response_type: 'text' | 'image' | 'document' | 'list'`
- Add `media_url` field to `qa_pairs` table
- Upload via Supabase Storage
- Builder UI: response type selector, file uploader
- Edge function: format appropriate WhatsApp API payload per type

---

### 1.6 Broadcast / Outbound Messaging

**The Problem:** The bot only reacts to incoming messages. WhatsApp's biggest value for businesses is proactive outreach — promotions, reminders, order updates. This feature is completely absent.

**What to Build:**

- `/dashboard/broadcasts` page
- Create a broadcast: select template, write message, choose recipients
- Recipients: all customers who have messaged before (from `customer_sessions`)
- Schedule: send now or schedule for later
- Status tracking: sent / delivered / read counts (via WhatsApp webhook events)

**Constraints:**
- WhatsApp requires pre-approved **Message Templates** for outbound messages to users who haven't messaged in 24h
- Need to guide users through Meta's template approval process
- Only send to customers who have opted in (messaged the bot at least once)

**Schema Addition:**
```sql
CREATE TABLE broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES chatbots(id),
  owner_id uuid REFERENCES owners(id),
  template_name text,
  message_body text NOT NULL,
  recipient_count int DEFAULT 0,
  sent_count int DEFAULT 0,
  status text DEFAULT 'draft', -- draft | scheduled | sending | completed
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

---

### 1.7 Subscription & Billing Management

**The Problem:** Users have no way to view, manage, pause, or cancel their subscription from within the app. This creates support burden and causes silent churn.

**What to Build:**

- `/dashboard/billing` page showing:
  - Current plan, status, amount, next renewal date
  - Payment history (last 6 invoices)
  - Cancel subscription button (with confirmation)
  - Reactivate button (if cancelled)
- Renewal reminder email 7 days before expiry
- Grace period: 3-day window after expiry before chatbot deactivates

**Backend:**
- Razorpay webhook already handles status changes — just need frontend to surface it
- Cancel: call Razorpay cancel subscription API from a new edge function
- Renewal emails: Supabase scheduled functions or Resend integration

---

### 1.8 Starter Templates

**The Problem:** New users face a blank canvas. The time to "aha moment" is too long, increasing churn before the first payment.

**What to Build:**

- Template picker shown on first login (after signup, before builder)
- 6–8 industry templates: Restaurant, Salon, Real Estate, E-commerce, Clinic, Education, Hotel, General FAQ
- Each template pre-loads example Q&A pairs the user can edit
- "Start from scratch" option always available

**Implementation:**
- `templates` table with seeded industry flows
- Clone template Q&A pairs into user's chatbot on selection

---

### 1.9 AI-Powered Free-Text Understanding

**The Problem:** Customers will type free-text questions. Currently all non-button messages get "I don't understand." This is jarring and unhelpful.

**What to Add:**

- **Keyword matching** (Phase 1, simple): if message contains keywords from Q&A answers, route to that node
- **AI intent detection** (Phase 2): send customer message to Claude API, return the most relevant Q&A pair
- **Fallback message customization**: let owner write a custom "I didn't understand" message

**Phase 1 Implementation:**
- Index all `question_text` values for the chatbot
- On free-text input, fuzzy-match against question labels
- If confidence > threshold, respond with that Q&A pair's answer + buttons
- If no match, send owner-configured fallback

---

### 1.10 Multi-Language Support

**The Problem:** Many Indian businesses serve customers in regional languages (Hindi, Tamil, Telugu, Malayalam, Kannada). A chatbot in English only alienates a large segment.

**What to Build:**

- Owner selects default language in settings
- Q&A pairs can have translations for each language
- Bot detects customer message language (via API) and responds in matching language
- Greeting/farewell messages also translated

---

### 1.11 Customer Profiles & Contact Management

**The Problem:** Customers are anonymous phone numbers. Businesses have no way to build a relationship or understand repeat customers.

**What to Build:**

- `/dashboard/contacts` page
- Each customer: phone, first seen, last active, total conversations, which flows they used
- Add notes on a customer (internal, not sent to customer)
- Tag customers: VIP / Follow-up / Interested / etc.
- Export contacts to CSV

---

## 2. Admin Dashboard — Platform Owner View

This is a **separate, protected section** of the application accessible only to you (the AlaChat platform owner). It gives you full visibility into the business — users, revenue, activity, and system health.

**Access:** `/admin/*` routes, gated behind a hardcoded admin email check or a separate `is_platform_admin` flag in the `owners` table.

---

### 2.1 Admin Overview — Command Center

**Route:** `/admin`

**Cards (Top Row):**

| Card | Metric |
|---|---|
| Total Users | Count of rows in `owners` table |
| Active Subscriptions | Subscriptions with status = 'active' |
| MRR (Monthly Recurring Revenue) | Active subscriptions × ₹500 |
| New Signups Today | owners created in last 24h |
| Active Chatbots | chatbots with is_active = true |
| Messages Today | Messages processed by webhook today |

**Charts:**
- Line chart: Signups over last 30 days
- Line chart: MRR over last 12 months
- Bar chart: Daily active chatbots
- Funnel: Signups → Built first menu → Added WhatsApp creds → Paid → Active

**Quick Actions:**
- Search any user by email or phone
- Impersonate user (view their dashboard)
- Broadcast system announcement to all users

---

### 2.2 User Management

**Route:** `/admin/users`

**Table Columns:**

| Column | Description |
|---|---|
| Name / Email | Owner full name and email |
| Joined | Account creation date |
| Chatbot Name | Their chatbot's name |
| Subscription Status | active / inactive / cancelled |
| Last Active | Last login or webhook activity |
| Messages (30d) | Message volume in last 30 days |
| Health Score | Their chatbot's health score (0–100) |
| Actions | View / Impersonate / Suspend / Delete |

**Filters:**
- Status: All / Active / Inactive / Suspended
- Date range: joined between X and Y
- Search: by name, email, phone number

**User Detail Page (`/admin/users/:id`):**
- All their chatbot settings (read-only view)
- Full Q&A tree
- Subscription history
- Audit log for their account
- Message volume chart
- Manual actions: extend subscription, reset password email, suspend account, delete account

---

### 2.3 Subscription & Revenue Management

**Route:** `/admin/subscriptions`

**Table Columns:**

| Column | Description |
|---|---|
| Owner | Name + email |
| Razorpay ID | Subscription ID link to Razorpay dashboard |
| Status | active / paused / cancelled / expired |
| Amount | ₹500/month |
| Start Date | When subscription began |
| Next Billing | Next charge date |
| Total Paid | Cumulative amount collected |
| Actions | View / Cancel / Refund (opens Razorpay) |

**Revenue Summary Panel:**
- MRR: ₹X
- ARR: ₹X × 12
- Churn rate (last 30 days): X%
- New MRR (new subscriptions this month): ₹X
- Churned MRR (cancelled this month): ₹X
- Net MRR growth: ₹X

**Filters:**
- Status, date range, sort by amount / date / name

---

### 2.4 Chatbot Activity Monitor

**Route:** `/admin/activity`

**Real-Time Feed:**
- Live log of webhook events (messages processed, errors, signature failures)
- Each row: timestamp, owner name, event type, customer phone (masked), status
- Auto-refreshes every 10 seconds

**Aggregated Stats:**
- Total messages processed today / this week / this month
- Error rate (failed webhook calls / total)
- Average response time (time between inbound and outbound message)
- Top 10 most active chatbots by message volume
- Top 10 owners by conversation count

**Error Log:**
- All entries from `security_events` table
- Filter by event type: signature failure / rate limit / unknown error
- Timestamp, owner, IP address, metadata

---

### 2.5 Audit Log Viewer

**Route:** `/admin/audit`

**Table:**

| Column | Description |
|---|---|
| Timestamp | When the action happened |
| Owner | Who did it |
| Action | chatbot_updated / qa_pair_created / etc. |
| Resource | What was affected |
| Details | Metadata JSON (readable format) |
| IP Address | Request origin |

**Filters:**
- Filter by owner, action type, date range
- Search by resource ID
- Export to CSV

---

### 2.6 System Health & Monitoring

**Route:** `/admin/system`

**Panels:**

**Edge Function Health:**
- Last 24h invocation counts per function (create-subscription, razorpay-webhook, whatsapp-webhook)
- Error rate per function
- Average execution time
- Last successful invocation timestamp

**Database Health:**
- Row counts per table
- Largest tables by size
- Slow query log (top 10 queries)

**WhatsApp API Health:**
- Overall webhook success rate
- Failed deliveries in last 24h
- Rate limit hits per owner

**Supabase Quotas:**
- Database size used vs. limit
- Auth users vs. limit
- Edge function invocations vs. monthly limit
- Storage used vs. limit

**Alerts Panel:**
- Any owner with >50% webhook error rate (likely bad credentials)
- Any subscription that should be active but chatbot is not active (sync issue)
- Any owner with active subscription but 0 messages in 30 days (churn risk)
- Database approaching quota limits

---

### 2.7 Announcements & Communications

**Route:** `/admin/communications`

**Features:**

- **In-App Banner:** Write a message that appears as a dismissable banner across all user dashboards (e.g., "Scheduled maintenance on Saturday 2am IST")
- **Email Broadcast:** Send email to all users / specific segment (active users, churned users, trial users)
- **Individual Email:** Send a direct email to a specific owner
- **Release Notes:** Publish what's new — appears in a "What's New" modal on the user dashboard

**Email Templates Pre-Built:**
- Welcome email (on signup)
- Payment successful
- Subscription expiring in 7 days
- Subscription expired — reactivate now
- We miss you (inactive for 30 days)

---

### 2.8 Settings & Configuration

**Route:** `/admin/settings`

**Platform Settings:**
- Razorpay Plan ID (editable without code deploy)
- Subscription price (₹/month)
- WhatsApp Verify Token
- Feature flags: enable/disable broadcast messaging, AI features, analytics per plan
- Maintenance mode toggle (disables all user logins with a custom message)

**Admin Users:**
- List of admin accounts
- Add / remove admin access
- Admin action log (who did what in the admin panel)

---

### 2.9 Admin Navigation Structure

```
/admin
├── /admin                    ← Overview / Command Center
├── /admin/users              ← User Management
│   └── /admin/users/:id      ← User Detail
├── /admin/subscriptions      ← Revenue & Subscriptions
├── /admin/activity           ← Chatbot Activity Monitor
├── /admin/audit              ← Audit Log Viewer
├── /admin/system             ← System Health
├── /admin/communications     ← Announcements & Emails
└── /admin/settings           ← Platform Configuration
```

**Layout:** Separate from the user dashboard. Its own sidebar, topbar with "Admin Mode" indicator, and a distinct color scheme (e.g., dark blue instead of dark green) so it's clearly differentiated.

**Access Control:**
```typescript
// In App.tsx
const ADMIN_EMAILS = ['your@email.com']; // platform owner email

// Route guard
if (!ADMIN_EMAILS.includes(user.email)) {
  return <Navigate to="/dashboard" />;
}
```

---

## 3. Priority Matrix

| Feature | Impact | Effort | Priority |
|---|---|---|---|
| Chatbot preview / testing | High — unlocks conversion | Low | P0 |
| Analytics dashboard | High — retention & trust | Medium | P0 |
| Admin overview + user management | High — you need visibility | Medium | P0 |
| Admin subscription / revenue view | High — track your MRR | Low | P0 |
| Conversation history (inbox) | High — core business need | Medium | P1 |
| Subscription billing page (user) | High — reduce churn | Low | P1 |
| Human takeover / escalation | High — trust | High | P1 |
| Admin activity monitor | Medium — ops visibility | Medium | P1 |
| Starter templates | Medium — faster onboarding | Low | P1 |
| Broadcast messaging | High — revenue driver | High | P2 |
| Rich media support | Medium — usefulness | Medium | P2 |
| AI free-text understanding | Medium — differentiation | High | P2 |
| Customer profiles & contacts | Medium — CRM value | Medium | P2 |
| Admin system health | Medium — reliability | Medium | P2 |
| Multi-language support | Medium — market expansion | High | P3 |
| Admin communications / email | Medium — engagement | Medium | P3 |
| Multi-chatbot per account | Low — future growth | High | P3 |

---

## 4. Implementation Order

### Phase 1 — Foundation (Weeks 1–3)
**Goal:** Give the platform owner visibility and give users confidence before paying.

1. **Admin Dashboard** — Overview, User Management, Subscription/Revenue view
2. **Chatbot Preview Mode** — interactive simulation in Builder (client-side only)
3. **Billing Page** (user-facing) — show subscription status, next billing, cancel option

### Phase 2 — Retention (Weeks 4–7)
**Goal:** Make users feel the product is worth keeping.

4. **Analytics Dashboard** — conversations, button heatmap, drop-off points
5. **Conversation Inbox** — message history, customer thread view
6. **Starter Templates** — pre-built flows for 6 industries
7. **Admin Activity Monitor + Audit Viewer**

### Phase 3 — Growth (Weeks 8–12)
**Goal:** Expand use cases and revenue potential.

8. **Human Takeover / Escalation** — live chat fallback
9. **Rich Media Support** — images, PDFs, list messages
10. **Broadcast Messaging** — outbound campaigns
11. **Customer Profiles** — contacts management

### Phase 4 — Differentiation (Weeks 13+)
**Goal:** Features that set AlaChat apart from competitors.

12. **AI Free-Text Understanding** — Claude API integration
13. **Multi-Language Support** — Hindi, Tamil, Telugu, etc.
14. **Multi-Chatbot per Account** — agency/enterprise use
15. **Admin Communications** — in-app banners, email blasts

---

*Document last updated: March 2026*
*Repository: alachat-main*
