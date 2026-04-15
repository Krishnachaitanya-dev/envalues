# 🤖 WhatsApp Chatbot - Supabase Edge Function

Serverless WhatsApp webhook handler built with **Supabase Edge Functions** (TypeScript/Deno).

---

## 📁 Project Structure

```
supabase-edge-function/
├── config.toml                          # Supabase configuration
├── .gitignore                           # Protect secrets
├── QUICK_START.md                       # 5-minute deployment ⚡
├── README.md                            # This file (full docs)
└── functions/
    ├── .env.example                     # Environment template
    └── whatsapp-webhook/
        └── index.ts                     # Main webhook (410 lines)
```

---

## 🎯 What This Does

This Edge Function is a **WhatsApp webhook** that:

1. ✅ Receives messages from WhatsApp customers
2. ✅ Matches business number to chatbot owner
3. ✅ Handles button-based conversations
4. ✅ Sends responses with interactive buttons
5. ✅ Supports unlimited nested Q&A trees

---

## 🏗️ Architecture

```
Customer (WhatsApp)
      ↓
WhatsApp Business API
      ↓
Edge Function (this code)
      ↓
Supabase Database
      ↓
Edge Function (this code)
      ↓
WhatsApp Business API
      ↓
Customer (WhatsApp)
```

---

## 🔄 Message Flow

### **1. Customer Sends "hi"**

```
Customer: "hi"
   ↓
Function: Get business number from webhook
   ↓
Database: Find owner by business_number → Get chatbot
   ↓
Database: Get main menu questions (parent_question_id IS NULL)
   ↓
WhatsApp: Send greeting + main menu buttons (max 3)
```

### **2. Customer Clicks Button**

```
Customer: Clicks "Services"
   ↓
Function: Receives button callback with qa_pair.id
   ↓
Database: Get clicked Q&A pair → Get child questions
   ↓
WhatsApp: Send answer + child buttons OR main menu
```

### **3. Customer Says "thank you"**

```
Customer: "thank you"
   ↓
Function: Detect farewell keyword
   ↓
WhatsApp: Send farewell message (no buttons)
```

### **4. Customer Sends Unknown Text**

```
Customer: "random text"
   ↓
Function: No match found
   ↓
WhatsApp: "I don't understand. Please click buttons!"
```

---

## 🗄️ Database Schema

### **owners table**
```sql
id                          UUID (primary key)
email                       TEXT
whatsapp_business_number    TEXT (e.g., "+919876543210")
full_name                   TEXT
```

### **chatbots table**
```sql
id                UUID (primary key)
owner_id          UUID (foreign key → owners.id)
chatbot_name      TEXT
greeting_message  TEXT (sent when customer says "hi")
farewell_message  TEXT (sent when customer says "thank you")
is_active         BOOLEAN
```

### **qa_pairs table**
```sql
id                    UUID (primary key)
chatbot_id            UUID (foreign key → chatbots.id)
question_text         TEXT (button label)
answer_text           TEXT (response when button clicked)
is_main_question      BOOLEAN
parent_question_id    UUID (NULL for root, else → qa_pairs.id)
display_order         INTEGER
is_active             BOOLEAN
```

---

## 🔐 Environment Variables

Set these as **Supabase secrets** (NOT in .env file):

```bash
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-key
supabase secrets set WHATSAPP_API_URL=https://graph.facebook.com/v21.0
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=123456789
supabase secrets set WHATSAPP_ACCESS_TOKEN=your-token
supabase secrets set WHATSAPP_VERIFY_TOKEN=your-verify-token
```

**Why secrets instead of .env?**
- ✅ Encrypted at rest
- ✅ Not exposed in code
- ✅ Managed by Supabase

---

## 🚀 Deployment

### **Quick Deploy (5 minutes)**

See `QUICK_START.md` for step-by-step guide.

### **Manual Steps**

```bash
# 1. Install CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link project
cd functions
supabase link --project-ref YOUR_PROJECT_REF

# 4. Set secrets (all 6)
supabase secrets set SUPABASE_URL=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set WHATSAPP_API_URL=...
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=...
supabase secrets set WHATSAPP_ACCESS_TOKEN=...
supabase secrets set WHATSAPP_VERIFY_TOKEN=...

# 5. Deploy
supabase functions deploy whatsapp-webhook
```

---

## 🔗 WhatsApp Configuration

1. Go to [Meta Developers](https://developers.facebook.com/apps/)
2. Your App → WhatsApp → Configuration
3. **Webhook Setup:**
   - Callback URL: `https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-webhook`
   - Verify Token: (same as `WHATSAPP_VERIFY_TOKEN` secret)
   - Subscribe to: `messages`

---

## 📊 Monitoring & Logs

### **View Logs (CLI)**

```bash
# Real-time logs
supabase functions logs whatsapp-webhook --follow

# Last 100 logs
supabase functions logs whatsapp-webhook --limit 100
```

### **View Logs (Dashboard)**

https://app.supabase.com → Functions → whatsapp-webhook → Logs

### **Log Output Examples**

**Successful message:**
```
Webhook verification request: { mode: 'subscribe', token: 'chatbot-verify-2024' }
Webhook verified successfully!
```

**Customer sends "hi":**
```
Message from +919876543210 to business +911234567890
Greeting message from: +919876543210
Interactive message sent to +919876543210 with 3 buttons
```

**Button click:**
```
Button clicked: 550e8400-e29b-41d4-a716-446655440000
Interactive message sent to +919876543210 with 2 buttons
```

**Error:**
```
No chatbot found for business number: +911234567890
```

---

## 🐛 Troubleshooting

### **1. Webhook Verification Fails**

**Symptoms:**
- Meta says "Verification failed"
- Can't save webhook URL

**Solutions:**
- ✅ Verify `WHATSAPP_VERIFY_TOKEN` secret matches exactly
- ✅ Test manually:
  ```bash
  curl "https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
  ```
- ✅ Should return: `test`

---

### **2. "Chatbot not found" Error**

**Symptoms:**
- Customer sends message, no response
- Logs show: "No chatbot found for business number"

**Solutions:**
- ✅ Check `owners` table has correct phone number
- ✅ Format must be: `+CountryCodePhoneNumber` (e.g., `+919876543210`)
- ✅ Run SQL query:
  ```sql
  SELECT * FROM owners 
  WHERE whatsapp_business_number = '+919876543210';
  ```
- ✅ If empty, update in dashboard:
  ```sql
  UPDATE owners 
  SET whatsapp_business_number = '+919876543210' 
  WHERE email = 'owner@example.com';
  ```

---

### **3. No Response to Messages**

**Symptoms:**
- Customer sends "hi", nothing happens
- No errors in logs

**Solutions:**
- ✅ Check `chatbots.is_active = true`
- ✅ Check Q&A pairs exist with `is_active = true`
- ✅ Verify webhook subscription in Meta dashboard
- ✅ Check WhatsApp access token hasn't expired

---

### **4. Buttons Not Showing**

**Symptoms:**
- Only text appears, no buttons
- Logs show warnings

**Solutions:**
- ✅ WhatsApp limit: **Max 3 buttons** per message
- ✅ Button text limit: **Max 20 characters**
- ✅ Check logs for: "Too many buttons" warning
- ✅ Function automatically truncates, but check if you need fewer questions

---

### **5. Internal Server Error**

**Symptoms:**
- 500 error in logs
- "Internal server error" in Meta

**Solutions:**
- ✅ Check all 6 secrets are set:
  ```bash
  supabase secrets list
  ```
- ✅ Verify `SUPABASE_SERVICE_ROLE_KEY` (NOT anon key!)
- ✅ Check function logs for stack trace
- ✅ Redeploy function:
  ```bash
  supabase functions deploy whatsapp-webhook
  ```

---

## 🔄 Updating the Code

After modifying `index.ts`:

```bash
# Deploy updated function
supabase functions deploy whatsapp-webhook

# Verify deployment
supabase functions list
```

No restart needed! Changes are live immediately.

---

## 📈 Scaling & Performance

### **Auto-Scaling**
- ✅ Handles traffic spikes automatically
- ✅ No configuration needed
- ✅ Scales to millions of requests

### **Cold Start**
- ⚡ ~50-100ms (very fast!)
- Much faster than containers

### **Concurrent Requests**
- ✅ Unlimited concurrent requests
- Each request runs in isolated environment

### **Global Deployment**
- 🌍 Deployed to multiple regions
- Low latency worldwide

---

## 💰 Pricing

### **Supabase Free Tier**
- ✅ **500,000 requests/month**
- ✅ **50 GB bandwidth**
- Perfect for getting started!

### **Pro Plan ($25/month)**
- ✅ **2,000,000 requests/month**
- ✅ Included in plan
- Additional: **$0.50 per 1M requests**

### **Cost Estimate**

| Daily Messages | Monthly Requests | Cost |
|----------------|------------------|------|
| 100 | ~3,000 | **FREE** |
| 1,000 | ~30,000 | **FREE** |
| 10,000 | ~300,000 | **FREE** |
| 20,000 | ~600,000 | **$25/month (Pro plan)** |
| 100,000 | ~3,000,000 | **$25/month + $0.50** |

*1 customer message = ~1 request (webhook call)*

---

## 🔐 Security Best Practices

### **1. Secrets Management**
- ✅ Never commit secrets to Git
- ✅ Use `supabase secrets set` (encrypted)
- ✅ Rotate tokens regularly

### **2. Webhook Security**
- ✅ Verify token prevents unauthorized requests
- ✅ HTTPS by default (Supabase provides)
- ✅ Rate limiting built-in

### **3. Database Security**
- ✅ Use `service_role` key (server-side only)
- ✅ Never expose in frontend
- ✅ Row Level Security (RLS) on tables

### **4. Input Validation**
- ✅ Function validates all incoming data
- ✅ Sanitizes user inputs
- ✅ Prevents SQL injection (Supabase handles)

---

## 🧪 Testing

### **Local Testing**

```bash
# Serve function locally
supabase functions serve whatsapp-webhook

# Test with curl
curl -X POST http://localhost:54321/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### **Production Testing**

```bash
# Test verification
curl "https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"

# Should return: test123
```

### **End-to-End Test**

1. Send "hi" from WhatsApp
2. Check logs: `supabase functions logs whatsapp-webhook`
3. Verify response received

---

## 📚 API Reference

### **Webhook Endpoints**

#### **GET /webhook**
Verifies webhook with Meta.

**Query Parameters:**
- `hub.mode` - Should be "subscribe"
- `hub.verify_token` - Your verify token
- `hub.challenge` - Random string to return

**Response:** Returns challenge string

---

#### **POST /webhook**
Receives WhatsApp messages.

**Request Body:**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "919876543210",
          "type": "text",
          "text": { "body": "hi" }
        }],
        "metadata": {
          "display_phone_number": "+911234567890"
        }
      }
    }]
  }]
}
```

**Response:**
```json
{ "status": "ok" }
```

---

## 🆘 Support

### **Documentation**
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)

### **Community**
- [Supabase Discord](https://discord.supabase.com)
- [WhatsApp Developers Forum](https://developers.facebook.com/community)

### **Issues**
- Check function logs first
- Verify all secrets are set
- Test webhook verification manually

---

## ✅ Pre-Launch Checklist

Before going live:

- [ ] All 6 environment secrets set
- [ ] Function deployed successfully
- [ ] Webhook verified in Meta dashboard
- [ ] Subscribed to "messages" event
- [ ] Business number correct in `owners` table
- [ ] Test: Send "hi" → Get response ✅
- [ ] Test: Click button → Get answer ✅
- [ ] Test: Send "thank you" → Get farewell ✅
- [ ] Logs checked (no errors)
- [ ] WhatsApp access token valid

---

## 🎯 What's Next?

### **Optional Enhancements**

1. **Conversation Logging**
   - Track customer interactions
   - Analytics & insights

2. **Multi-language Support**
   - Detect language
   - Send responses in customer's language

3. **Rich Media**
   - Send images, videos
   - Product catalogs

4. **CRM Integration**
   - Sync with Salesforce, HubSpot
   - Auto-create leads

5. **Analytics Dashboard**
   - Message volume
   - Popular questions
   - Response times

---

## 🎉 You're All Set!

Your WhatsApp chatbot webhook is:
- ✅ Deployed serverless
- ✅ Auto-scaling
- ✅ Secure (encrypted secrets)
- ✅ Fast (edge deployment)
- ✅ Free tier available

**Webhook URL:**
```
https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-webhook
```

Send "hi" to your business number and watch it work! 🚀

---

**Questions?** Check `QUICK_START.md` for deployment help!