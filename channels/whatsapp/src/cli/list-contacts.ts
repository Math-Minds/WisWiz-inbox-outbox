#!/usr/bin/env npx tsx
/**
 * CLI: List all contacts
 *
 * Usage:
 *   npx tsx src/cli/list-contacts.ts          # All contacts
 *   npx tsx src/cli/list-contacts.ts --json   # JSON output
 *   npx tsx src/cli/list-contacts.ts --tag customer  # Filter by tag
 */

import { listContacts } from '../lib/file-store';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const tagFilter = args.find((a, i) => args[i - 1] === '--tag');

  try {
    let contacts = await listContacts();

    // Filter by tag if specified
    if (tagFilter) {
      contacts = contacts.filter((c) =>
        c.metadata.tags?.includes(tagFilter)
      );
    }

    if (jsonOutput) {
      console.log(JSON.stringify(contacts, null, 2));
      return;
    }

    if (contacts.length === 0) {
      console.log('No contacts found.');
      return;
    }

    console.log(`Found ${contacts.length} contacts:\n`);
    console.log(
      'Phone'.padEnd(16) +
        'Name'.padEnd(25) +
        'Tags'.padEnd(20) +
        'Last Contact'
    );
    console.log('─'.repeat(75));

    for (const contact of contacts) {
      const name =
        contact.profile.name || contact.profile.pushName || '-';
      const tags = contact.metadata.tags?.join(', ') || '-';
      const lastContact = formatDistanceToNow(
        new Date(contact.metadata.lastContact),
        { addSuffix: true, locale: nl }
      );

      console.log(
        contact.phone.padEnd(16) +
          name.substring(0, 23).padEnd(25) +
          tags.substring(0, 18).padEnd(20) +
          lastContact
      );
    }

    console.log('');
  } catch (error) {
    console.error('Failed to list contacts:', error);
    process.exit(1);
  }
}

main();
