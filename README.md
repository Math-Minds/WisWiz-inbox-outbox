# WisWiz Inbox + Outbox

Multi-channel inbox/outbox management for WisWiz, designed for Claude Code integration.

## Structure

```
WisWiz-inbox-outbox/
├── contacts/           # Shared contacts across channels
├── prompts/            # AI prompts for message processing
│   ├── inbox/          # Prompts for incoming messages
│   ├── outbox/         # Prompts for drafting responses
│   └── shared/         # Shared context and guidelines
└── channels/           # Per-medium implementations
    ├── whatsapp/       # WhatsApp Business integration ✅
    ├── email/          # Email integration (planned)
    ├── trello/         # Trello integration (planned)
    ├── github/         # GitHub integration (planned)
    └── tiktok/         # TikTok integration (planned)
```

## Channels

### WhatsApp Business ✅

Full implementation with:
- Local GUI for viewing/sending messages
- Webhook receiver for incoming messages
- File-based storage (readable by Claude)
- CLI tools for Claude Code integration

See [channels/whatsapp/README.md](channels/whatsapp/README.md) for setup instructions.

### Email (Planned)

IMAP/SMTP integration for email management.

### Trello (Planned)

Trello cards and comments as inbox items.

### GitHub (Planned)

Issues, PRs, and notifications management.

### TikTok (Planned)

Comments and DMs management.

## How Claude Uses This

1. **Read messages**: Claude reads files in `channels/*/data/` to see conversation history
2. **Send messages**: Claude writes to outbox folders, services pick up and send
3. **Use prompts**: Prompts in `prompts/` guide Claude's responses
4. **Track contacts**: Shared contact info with notes and tags

## Philosophy

- **File-based**: Everything is stored as readable files (JSON, JSONL, Markdown)
- **Local-first**: All data stays on your machine
- **Claude-native**: Designed for seamless Claude Code integration
- **Modular**: Each channel is independent, add what you need

## Getting Started

1. Clone this repo
2. Pick a channel (start with WhatsApp)
3. Follow the channel-specific README
4. Configure credentials
5. Start using with Claude Code

## Team

- Managed by WisWiz team
- Claude Code assists with message processing and drafting
