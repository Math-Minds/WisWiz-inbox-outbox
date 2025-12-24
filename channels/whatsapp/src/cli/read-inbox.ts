#!/usr/bin/env npx tsx
/**
 * CLI: Read recent messages from all chats
 *
 * Usage:
 *   npx tsx src/cli/read-inbox.ts              # All recent messages
 *   npx tsx src/cli/read-inbox.ts --unread     # Only unread
 *   npx tsx src/cli/read-inbox.ts --limit 20   # Limit per chat
 */

import { listChats, getMessages } from '../lib/file-store';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find((a, i) => args[i - 1] === '--limit') || '10');
  const unreadOnly = args.includes('--unread');

  try {
    const chats = await listChats();

    if (chats.length === 0) {
      console.log('No chats found.');
      return;
    }

    console.log(`Found ${chats.length} chats:\n`);

    for (const { contact, thread } of chats) {
      if (unreadOnly && thread.unreadCount === 0) continue;

      const name =
        contact?.profile.name || contact?.profile.pushName || thread.contactPhone;
      const timeAgo = formatDistanceToNow(new Date(thread.lastMessageAt), {
        addSuffix: true,
        locale: nl,
      });

      console.log('─'.repeat(60));
      console.log(`📱 ${name} (${thread.contactPhone})`);
      console.log(`   Last message: ${timeAgo}`);
      if (thread.unreadCount > 0) {
        console.log(`   Unread: ${thread.unreadCount}`);
      }
      console.log('');

      // Get recent messages
      const messages = await getMessages(thread.contactPhone, { limit });

      for (const msg of messages.reverse()) {
        const dir = msg.dir === 'in' ? '←' : '→';
        const time = new Date(msg.ts).toLocaleTimeString('nl-NL', {
          hour: '2-digit',
          minute: '2-digit',
        });

        let content = msg.body || `[${msg.type}]`;
        if (msg.caption) content = `${msg.caption} [${msg.type}]`;
        if (content.length > 60) content = content.substring(0, 57) + '...';

        const claudeMarker = msg.createdBy === 'claude' ? ' 🤖' : '';

        console.log(`   ${dir} ${time}: ${content}${claudeMarker}`);
      }

      console.log('');
    }
  } catch (error) {
    console.error('Failed to read inbox:', error);
    process.exit(1);
  }
}

main();
