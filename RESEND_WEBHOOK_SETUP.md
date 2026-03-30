# Email Reply Setup Guide for BizCivitas Conversation Feature

## Using Resend.com + Zapier (Recommended)

Resend.com doesn't capture incoming email replies natively. Use **Zapier** to forward customer replies to your conversation webhook.

### Step 1: Get Your Webhook URL

Your webhook URL is:
```
POST http://localhost:8090/pm/webhooks/email
```

(For production, replace `localhost:8090` with your live domain)

### Step 2: Set Up Zapier

1. **Sign up at zapier.com** (free tier available)
2. **Create a new Zap** → Click "Create"
3. **Set Trigger**: 
   - Search for "**Catch Email by Zapier**"
   - Select it and click "Continue"
   - You'll get a unique email address like: `catch.xyzabc@zapiermail.com`
   - **This is your catch-all inbox!**

4. **Set Action**:
   - Search for "**Webhooks by Zapier**"
   - Select "POST" method
   - **URL**: `http://localhost:8090/pm/webhooks/email`
   - **Payload Type**: `JSON`
   - **Data** section, add these fields:
     ```
     from = Email Address (Zapier field)
     to = 
     subject = Subject (Zapier field)
     text = Plain Text (Zapier field)
     timestamp = Created (Zapier field)
     senderName = From Name (Zapier field)
     ```

5. **Test the Zap** and turn it on ✓

### Step 3: Forward Customer Replies to Zapier

**Option A: Domain Email Forwarding (Best)**
- Forward `hello@yourdomain.com` → `catch.xyzabc@zapiermail.com`
- Any customer reply to your domain will auto-forward to Zapier

**Option B: Check Email Manually**
- Give the Zapier catch email to customers: `catch.xyzabc@zapiermail.com`
- Zapier will receive all replies sent to that email

**Option C: Gmail Forwarding**
- If customers reply to your Gmail:
  1. Set up Gmail "Auto-forward" rule
  2. Auto-forward to `catch.xyzabc@zapiermail.com`

### Step 4: Test It

1. Someone replies to an inquiry email
2. Zapier catches the reply
3. Zapier POSTs to your webhook
4. Message automatically appears in the conversation! ✓

---

## Alternative: Direct Email Forwarding Service

If you prefer not to use Zapier, try:
- **webhook.cool** - Direct email-to-webhook forwarding
- **Mailparser.io** - Email parsing + webhook
- **Formspree Email** - Simple email forwarding

---

## Webhook Payload Format

When an email is forwarded, the webhook expects:

```json
{
  "from": "customer@email.com",
  "to": "your@email.com",
  "subject": "Original Subject",
  "text": "Email body text",
  "senderName": "Customer Name",
  "timestamp": "2026-03-30T12:00:00Z"
}
```

---

## Testing the Webhook

Send a test POST to verify setup:

```bash
curl -X POST http://localhost:8090/pm/webhooks/email \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@example.com",
    "subject": "Test Reply",
    "text": "This is a test",
    "senderName": "Test User"
  }'
```

Should return:
```json
{
  "success": true,
  "data": { ... message object ... }
}
```

---

## Troubleshooting

**"Inquiry not found"** error?
- Make sure the **from email matches** an inquiry in your database
- Check email case sensitivity

**Email not appearing?**
- Check conversation auto-refresh every 3 seconds
- Check backend logs for webhook hits
- Verify Zapier is turned ON

**Duplicate messages?**
- The system automatically deduplicates within 5 minutes
