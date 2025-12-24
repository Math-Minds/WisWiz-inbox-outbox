#!/usr/bin/env npx tsx
/**
 * CLI: Send a WhatsApp message
 *
 * Usage:
 *   npx tsx src/cli/send.ts +31612345678 "Hello, world!"
 *   npx tsx src/cli/send.ts +31612345678 "Reply message" --reply-to wamid.xxx
 *
 * This command:
 * 1. Creates a message file in outbox/pending/
 * 2. The outbox-watcher service picks it up and sends it
 * 3. Or if the Next.js app is running, it sends immediately via API
 */

import { createOutboxMessage } from '../lib/file-store';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: send.ts <phone> <message> [--reply-to <message_id>]');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx src/cli/send.ts +31612345678 "Hallo!"');
    console.log(
      '  npx tsx src/cli/send.ts +31612345678 "Dit is een antwoord" --reply-to wamid.xxx'
    );
    process.exit(1);
  }

  const phone = args[0];
  const body = args[1];
  let replyTo: string | undefined;

  // Parse optional flags
  const replyToIndex = args.indexOf('--reply-to');
  if (replyToIndex !== -1 && args[replyToIndex + 1]) {
    replyTo = args[replyToIndex + 1];
  }

  // Validate phone number
  if (!phone.match(/^\+?[0-9]{10,15}$/)) {
    console.error('Error: Invalid phone number format. Use E.164 format (e.g., +31612345678)');
    process.exit(1);
  }

  try {
    const filename = await createOutboxMessage({
      to: phone.startsWith('+') ? phone : `+${phone}`,
      type: 'text',
      body,
      replyTo,
      createdBy: 'claude',
    });

    console.log(`Message queued: ${filename}`);
    console.log(`To: ${phone}`);
    console.log(`Body: ${body}`);
    if (replyTo) {
      console.log(`Reply to: ${replyTo}`);
    }
    console.log('');
    console.log('The message will be sent by the outbox-watcher service.');
  } catch (error) {
    console.error('Failed to queue message:', error);
    process.exit(1);
  }
}

main();
