#!/usr/bin/env npx tsx
/**
 * CLI: Get full chat history with a contact
 *
 * Usage:
 *   npx tsx src/cli/get-chat.ts +31612345678
 *   npx tsx src/cli/get-chat.ts +31612345678 --limit 50
 *   npx tsx src/cli/get-chat.ts +31612345678 --json
 */

import { getContact, getMessages, getThread } from '../lib/file-store';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: get-chat.ts <phone> [--limit N] [--json]');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx src/cli/get-chat.ts +31612345678');
    console.log('  npx tsx src/cli/get-chat.ts +31612345678 --limit 50');
    console.log('  npx tsx src/cli/get-chat.ts +31612345678 --json');
    process.exit(1);
  }

  const phone = args[0];
  const limit = parseInt(args.find((a, i) => args[i - 1] === '--limit') || '100');
  const jsonOutput = args.includes('--json');

  try {
    const contact = await getContact(phone);
    const thread = await getThread(phone);
    const messages = await getMessages(phone, { limit });

    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            contact,
            thread,
            messages: messages.reverse(),
          },
          null,
          2
        )
      );
      return;
    }

    // Header
    const name =
      contact?.profile.name || contact?.profile.pushName || phone;
    console.log('═'.repeat(60));
    console.log(`Chat with: ${name}`);
    console.log(`Phone: ${phone}`);
    if (contact?.metadata.tags?.length) {
      console.log(`Tags: ${contact.metadata.tags.join(', ')}`);
    }
    if (contact?.metadata.notes) {
      console.log(`Notes: ${contact.metadata.notes}`);
    }
    console.log('═'.repeat(60));
    console.log('');

    if (messages.length === 0) {
      console.log('No messages found.');
      return;
    }

    // Messages (reverse to show oldest first)
    let lastDate = '';
    for (const msg of messages.reverse()) {
      const msgDate = format(new Date(msg.ts), 'EEEE d MMMM yyyy', { locale: nl });
      const msgTime = format(new Date(msg.ts), 'HH:mm', { locale: nl });

      // Date separator
      if (msgDate !== lastDate) {
        console.log(`\n--- ${msgDate} ---\n`);
        lastDate = msgDate;
      }

      const dir = msg.dir === 'in' ? '◀' : '▶';
      const sender = msg.dir === 'in' ? name : 'Jij';
      const claudeMarker = msg.createdBy === 'claude' ? ' [Claude]' : '';

      console.log(`${dir} ${msgTime} ${sender}${claudeMarker}:`);

      // Content
      if (msg.body) {
        console.log(`   ${msg.body}`);
      } else if (msg.type === 'image') {
        console.log(`   [Afbeelding${msg.caption ? `: ${msg.caption}` : ''}]`);
        if (msg.mediaPath) console.log(`   📎 ${msg.mediaPath}`);
      } else if (msg.type === 'document') {
        console.log(`   [Document: ${msg.filename || 'bestand'}]`);
        if (msg.mediaPath) console.log(`   📎 ${msg.mediaPath}`);
      } else if (msg.type === 'audio') {
        console.log(`   [Spraakbericht]`);
      } else if (msg.type === 'location' && msg.location) {
        console.log(`   [Locatie: ${msg.location.name || msg.location.address || 'Geen naam'}]`);
      } else if (msg.type === 'reaction' && msg.reaction) {
        console.log(`   ${msg.reaction.emoji} (reactie)`);
      } else {
        console.log(`   [${msg.type}]`);
      }

      console.log('');
    }

    console.log('═'.repeat(60));
    console.log(`Total: ${messages.length} messages`);
  } catch (error) {
    console.error('Failed to get chat:', error);
    process.exit(1);
  }
}

main();
