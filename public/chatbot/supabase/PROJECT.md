# 📂 Supabase Edge Function - Project Overview

## 🎯 What Is This?

A **serverless WhatsApp webhook** that handles button-based chatbot conversations.

Built with:
- ✅ Supabase Edge Functions (TypeScript/Deno)
- ✅ WhatsApp Business Cloud API
- ✅ Supabase Database (PostgreSQL)

---

## 📦 Complete File Structure

```
supabase-edge-function/
│
├── config.toml                          # Supabase configuration
├── .gitignore                           # Protect secrets from Git
├── PROJECT.md                           # This file (overview)
├── QUICK_START.md                       # ⚡ 5-minute deployment guide
├── README.md                            # 📚 Full documentation
│
└── functions/
    ├── .env.example                     # Environment template
    │
    └── whatsapp-webhook/
        └── index.ts                     # 🚀 Main webhook (410 lines)
```

---

## 📄 File Descriptions

### **config.toml**
- Supabase Edge Functions configuration
- Disables JWT verification (we handle webhook verification)

### **.gitignore**
- Protects sensitive files (.env, secrets)
- IDE and OS files

### **QUICK_START.md** ⭐
- **START HERE!**
- 5-minute deployment guide
- Step-by-step instructions
- Troubleshooting

### **README.md**
- Complete technical documentation
- API reference
- Database schema
- Advanced troubleshooting

### **functions/.env.example**
- Template for environment variables
- Shows what secrets you need
- Not used directly (use `supabase secrets set`)

### **functions/whatsapp-webhook/index.ts** 🚀
- **MAIN CODE FILE**
- 410 lines of TypeScript
- Handles all webhook logic
- Database queries
- WhatsApp API calls

---

## 🔄 How It Works

```
1. Customer sends WhatsApp message
   ↓
2. WhatsApp → Edge Function (index.ts)
   ↓
3. Edge Function → Supabase DB (query chatbot)
   ↓
4. Edge Function → WhatsApp API (send response)
   ↓
5. Customer receives message + buttons
```

---

## 🚀 Quick Deploy

```bash
# 1. Install CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link project
cd functions
supabase link --project-ref tbfmturpclqponehhdjq

# 4. Set secrets (6 total)
supabase secrets set SUPABASE_URL=https://tbfmturpclqponehhdjq.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
supabase secrets set WHATSAPP_API_URL=https://graph.facebook.com/v21.0
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=your-phone-id
supabase secrets set WHATSAPP_ACCESS_TOKEN=your-token
supabase secrets set WHATSAPP_VERIFY_TOKEN=chatbot-verify-2024

# 5. Deploy
supabase functions deploy whatsapp-webhook
```

**Your webhook URL:**
```
https://tbfmturpclqponehhdjq.supabase.co/functions/v1/whatsapp-webhook
```

---

## 📊 Code Breakdown

### **index.ts (410 lines)**

1. **Imports & Types** (Lines 1-50)
   - Deno HTTP server
   - Supabase client
   - TypeScript interfaces

2. **Configuration** (Lines 52-60)
   - Load environment secrets
   - Initialize Supabase client
   - WhatsApp API config

3. **Main Handler** (Lines 62-120)
   - GET: Webhook verification
   - POST: Receive messages
   - Route to handlers

4. **Database Functions** (Lines 122-200)
   - `getChatbotByBusinessNumber()`
   - `getMainMenuQuestions()`
   - `getQAPairById()`
   - `getChildQuestions()`

5. **Message Handlers** (Lines 202-280)
   - `handleTextMessage()` - "hi", "thank you", unknown
   - `handleButtonClick()` - Button press handling

6. **WhatsApp API** (Lines 282-410)
   - `sendTextMessage()` - Plain text
   - `sendInteractiveMessage()` - Buttons (max 3)

---

## 🎯 Key Features

✅ **Serverless** - No servers to manage
✅ **Auto-scaling** - Handles any traffic
✅ **Secure** - Encrypted secrets
✅ **Fast** - <100ms cold start
✅ **Free tier** - 500K requests/month
✅ **Global** - Multi-region deployment

---

## 🔧 What You Need

### **From Supabase:**
1. Project URL: `https://tbfmturpclqponehhdjq.supabase.co`
2. Service Role Key: Dashboard → Settings → API
3. Database password (for CLI linking)

### **From Meta/WhatsApp:**
1. Phone Number ID
2. Access Token
3. App setup complete

### **From You:**
1. Verify Token (make one up, e.g., `chatbot-verify-2024`)

---

## 📚 Where to Start

### **New to This?**
1. Read `QUICK_START.md` first
2. Follow 5 steps to deploy
3. Test with WhatsApp

### **Want Details?**
1. Read `README.md`
2. Check API reference
3. Review troubleshooting

### **Ready to Deploy?**
1. Open terminal
2. Follow `QUICK_START.md`
3. Deploy in 5 minutes!

---

## 🎓 Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Deno |
| Language | TypeScript |
| Framework | Supabase Edge Functions |
| Database | PostgreSQL (Supabase) |
| API | WhatsApp Business Cloud API |
| Hosting | Supabase (serverless) |

---

## 💡 Why Edge Functions?

**vs Traditional Server (FastAPI, Express):**
- ✅ No server maintenance
- ✅ Auto-scaling included
- ✅ Cheaper (free tier!)
- ✅ Faster deployment
- ✅ Built-in monitoring

**vs AWS Lambda:**
- ✅ Simpler deployment
- ✅ Integrated with database
- ✅ Better logs
- ✅ Lower cold starts

---

## ✅ Success Checklist

Before testing:

- [ ] CLI installed: `npm install -g supabase`
- [ ] Logged in: `supabase login`
- [ ] Project linked: `supabase link`
- [ ] All 6 secrets set
- [ ] Function deployed
- [ ] Webhook verified in Meta
- [ ] Subscribed to "messages"

After deployment:

- [ ] Send "hi" → Get greeting ✅
- [ ] Click button → Get answer ✅
- [ ] Send "thank you" → Get farewell ✅
- [ ] Check logs → No errors ✅

---

## 🚨 Common Issues

**"Can't verify webhook"**
→ Check `WHATSAPP_VERIFY_TOKEN` matches

**"Chatbot not found"**
→ Check phone number format: `+CountryCodeNumber`

**"No response"**
→ Check function logs: `supabase functions logs whatsapp-webhook`

---

## 📞 Support

- **Quick Help**: `QUICK_START.md`
- **Full Docs**: `README.md`
- **Code**: `functions/whatsapp-webhook/index.ts`

---

## 🎉 You're Ready!

Everything you need is in these 7 files.

**Next step:** Open `QUICK_START.md` and deploy! 🚀

---

Built with ❤️ using Supabase Edge Functions