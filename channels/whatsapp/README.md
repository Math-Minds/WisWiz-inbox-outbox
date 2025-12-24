# WisWiz WhatsApp Integration

Local WhatsApp Business API integration with GUI and Claude Code support.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   WhatsApp Cloud API (Meta)                      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
          ┌────────────────────┴────────────────────┐
          ▼                                         │
┌─────────────────────┐                   ┌─────────────────────┐
│   Webhook Server    │                   │    REST API Send    │
│  (Next.js API)      │                   │   (via API client)  │
└─────────┬───────────┘                   └──────────▲──────────┘
          │                                          │
          │              LOCAL FILE SYSTEM           │
          ▼                                          │
┌─────────────────────────────────────────────────────────────────┐
│  data/                                                          │
│  ├── contacts/          → Contact JSON files                    │
│  ├── chats/{phone}/     → Message history (JSONL)              │
│  ├── outbox/pending/    → Messages to send                     │
│  └── media/             → Downloaded images/documents          │
└─────────────────────────────────────────────────────────────────┘
          │                                          ▲
          │              CLAUDE CODE                 │
          ▼                                          │
┌─────────────────────────────────────────────────────────────────┐
│  • Read contacts/*.json → knows who people are                  │
│  • Read chats/*/messages.jsonl → sees conversation history     │
│  • Write to outbox/pending/ → messages get sent automatically  │
│  • CLI tools for quick operations                               │
└─────────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure WhatsApp API

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Get credentials from [Meta Business Suite](https://business.facebook.com/) → WhatsApp → API Setup.

### 3. Start the app

```bash
npm run dev
```

Open http://localhost:3000 to see the GUI.

### 4. Expose webhook (for receiving messages)

```bash
npm run tunnel
# or: ngrok http 3000
```

Copy the ngrok URL and configure it in Meta Business Suite:
- Webhook URL: `https://your-ngrok-url.ngrok.io/api/webhook`
- Verify Token: Same as `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your `.env`

### 5. Start outbox watcher (for sending queued messages)

```bash
npx tsx src/services/outbox-watcher.ts
```

## CLI Tools for Claude

Claude Code can use these commands to interact with WhatsApp:

### Send a message

```bash
npx tsx src/cli/send.ts +31612345678 "Hallo, hoe gaat het?"
```

### Read inbox

```bash
npx tsx src/cli/read-inbox.ts
npx tsx src/cli/read-inbox.ts --unread
```

### Get chat history

```bash
npx tsx src/cli/get-chat.ts +31612345678
npx tsx src/cli/get-chat.ts +31612345678 --json
```

### List contacts

```bash
npx tsx src/cli/list-contacts.ts
npx tsx src/cli/list-contacts.ts --tag customer
```

## File Formats

### Contact (data/contacts/+31612345678.json)

```json
{
  "id": "contact_123",
  "phone": "+31612345678",
  "whatsappId": "31612345678",
  "profile": {
    "name": "Jan de Vries",
    "pushName": "Jan"
  },
  "metadata": {
    "firstContact": "2024-01-15T10:30:00Z",
    "lastContact": "2024-12-24T09:15:00Z",
    "messageCount": 47,
    "tags": ["customer", "premium"],
    "notes": "Interested in math tutoring"
  }
}
```

### Messages (data/chats/+31612345678/messages.jsonl)

Each line is a JSON object:

```jsonl
{"id":"wamid.xxx","ts":"2024-12-24T09:00:00Z","dir":"in","type":"text","body":"Hallo!","status":"read"}
{"id":"wamid.yyy","ts":"2024-12-24T09:05:00Z","dir":"out","type":"text","body":"Hallo! Hoe kan ik helpen?","status":"delivered","createdBy":"user"}
```

### Outbox (data/outbox/pending/*.json)

```json
{
  "to": "+31612345678",
  "type": "text",
  "body": "Bedankt voor uw bericht!",
  "createdAt": "2024-12-24T09:15:00Z",
  "createdBy": "claude"
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhook` | GET | WhatsApp webhook verification |
| `/api/webhook` | POST | Receive incoming messages |
| `/api/send` | POST | Send a message |
| `/api/contacts` | GET | List contacts |
| `/api/contacts?phone=x` | GET | Get specific contact |
| `/api/messages` | GET | List all chats |
| `/api/messages?phone=x` | GET | Get messages for a contact |

## How Claude Uses This

1. **Read incoming messages**: Claude reads `data/chats/*/messages.jsonl` to see conversation history

2. **Send messages**: Claude writes to `data/outbox/pending/` and the outbox-watcher sends them

3. **Manage contacts**: Claude reads/writes `data/contacts/*.json` for contact info and notes

4. **Use prompts**: Prompts in `../../prompts/` provide context for drafting responses

## Security Notes

- Never commit `.env` or `data/` folders (they're in `.gitignore`)
- The webhook uses signature verification when `WHATSAPP_APP_SECRET` is set
- All data is stored locally - no external database needed
