# Task: Add WhatsApp Interactive Button Support

## Project
AlaChat at `C:/Users/krish/Projects/envalues`
Branch: `main`
Path alias: `@/*` → `src/*`

## Goal
When a message node in the flow builder has buttons configured, send a WhatsApp interactive button message instead of plain text. Buttons are tappable quick replies in WhatsApp (max 3).

## Files to Change

### 1. `supabase/functions/whatsapp-webhook/engine/types.ts`

Read the file first. Then:

**Extend `OutboundMessage`** to add interactive type:
```typescript
export interface OutboundMessage {
  type: 'text' | 'image' | 'video' | 'document' | 'interactive'
  text?: string
  url?: string
  caption?: string
  // interactive-only fields:
  body?: string
  buttons?: Array<{ id: string; title: string }>
}
```

**Extend `MessageConfig`** to add optional buttons field:
```typescript
export interface MessageConfig {
  text?: string
  media_url?: string
  media_type?: string
  links?: Array<{ label?: string; url: string }>
  attachments?: Array<{ type: string; url: string; caption?: string }>
  buttons?: Array<{ id: string; title: string }>  // up to 3 quick reply buttons
}
```

### 2. `supabase/functions/whatsapp-webhook/engine/node-executors.ts`

In `executeMessageNode`, replace the plain text push with button-aware logic:

```typescript
// Replace:
if (config.text) {
  messages.push({ type: 'text', text: config.text })
}

// With:
if (config.text) {
  if (config.buttons && config.buttons.length > 0) {
    messages.push({
      type: 'interactive',
      body: config.text,
      buttons: config.buttons.slice(0, 3),
    })
  } else {
    messages.push({ type: 'text', text: config.text })
  }
}
```

### 3. `supabase/functions/whatsapp-webhook/index.ts`

In `sendWhatsAppMessage`, add an interactive branch. The function signature is:
```typescript
async function sendWhatsAppMessage(to: string, msg: OutboundMessage, creds: { accessToken: string; phoneNumberId: string }): Promise<void>
```

Add this branch before (or after) the existing `else` branch that handles media:
```typescript
} else if (msg.type === 'interactive') {
  payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: msg.body ?? '' },
      action: {
        buttons: (msg.buttons ?? []).map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  }
}
```

The complete if/else structure in `sendWhatsAppMessage` should be:
- `if (msg.type === 'text')` → text payload
- `else if (msg.type === 'interactive')` → interactive payload
- `else` → media payload (image/video/document)

### 4. `src/integrations/supabase/flow-types.ts`

Read the file. Find `MessageConfig` interface and add the `buttons` field:
```typescript
buttons?: Array<{ id: string; title: string }>
```

### 5. Find and update the MessageNode config panel

Run: `find src/components/dashboard/builder -name "*.tsx" | xargs grep -l "MessageConfig\|message.*node\|nodeType.*message" 2>/dev/null`

Also check: `src/components/dashboard/builder/panels/` and `src/components/dashboard/builder/nodes/`

Find the component that renders the config editor for message nodes. It likely has a text input for the message body.

Add a **"Quick Reply Buttons"** section below the text field:
- Section label: "Quick Reply Buttons" with a small note "(max 3, for WhatsApp)"
- List of existing buttons with a delete (×) button each
- "Add button" button (disabled when 3 buttons already added)
- Each button has a single text input for the title (20 char max)
- On change: call the existing node config save function with updated `config.buttons`
- `id` is auto-generated as `crypto.randomUUID()` (or `nanoid`) when button is added
- Show a yellow warning callout if buttons > 3 (shouldn't happen but guard it)

Follow the exact same styling/patterns as other fields in that config panel.

## Run Tests
```bash
cd "C:/Users/krish/Projects/envalues"
npm run test
```
All tests must pass.

## Deploy
```bash
npx supabase functions deploy whatsapp-webhook --project-ref tbfmturpclqponehhdjq
```

## Commit
```bash
git add -A
git commit -m "feat: add WhatsApp interactive button support in message nodes"
```

## Done Criteria
- `OutboundMessage` has `type: 'interactive'` + `body` + `buttons` fields
- `MessageConfig` has `buttons` field
- `executeMessageNode` sends interactive message when buttons configured
- `sendWhatsAppMessage` builds correct WhatsApp interactive payload
- Message node config panel has Add/Remove buttons UI
- All tests pass
