/**
 * Migration script: Convert old _index.json (3 separate maps) and profile.json
 * (telefoon/email as single strings) to new unified format.
 *
 * Usage: npx tsx scripts/migrate-identity.ts [data-dir]
 * Default data-dir: INFLUENCER_DATA_DIR env var or ../../../Marketing/Influencers/influencers
 */

import fs from 'fs/promises';
import path from 'path';

const dataDir = process.argv[2]
  || process.env.INFLUENCER_DATA_DIR
  || path.resolve(__dirname, '../../../../Marketing/Influencers/influencers');

interface OldIndex {
  by_tiktok: Record<string, string>;
  by_phone: Record<string, string>;
  by_email: Record<string, string>;
}

interface NewIndex {
  by_identifier: Record<string, string>;
}

interface OldProfile {
  tiktok: string | null;
  naam: string;
  telefoon?: string | null;
  email?: string | null;
  phones?: string[];
  emails?: string[];
  kanalen: string[];
  eerste_contact: string;
  notities: string | null;
}

interface NewProfile {
  tiktok: string | null;
  naam: string;
  phones: string[];
  emails: string[];
  kanalen: string[];
  eerste_contact: string;
  notities: string | null;
}

async function migrate() {
  console.log(`Migrating data in: ${dataDir}\n`);

  // 1. Read old _index.json
  const indexPath = path.join(dataDir, '_index.json');
  const raw = await fs.readFile(indexPath, 'utf-8');
  const oldIndex: OldIndex = JSON.parse(raw);

  // Check if already migrated
  if ('by_identifier' in oldIndex) {
    console.log('_index.json already uses by_identifier format. Skipping index migration.');
  }

  // 2. Build new unified index
  const newIndex: NewIndex = { by_identifier: {} };

  for (const [handle, slug] of Object.entries(oldIndex.by_tiktok || {})) {
    newIndex.by_identifier[`tiktok:${handle}`] = slug;
  }
  for (const [phone, slug] of Object.entries(oldIndex.by_phone || {})) {
    newIndex.by_identifier[`phone:${phone}`] = slug;
  }
  for (const [email, slug] of Object.entries(oldIndex.by_email || {})) {
    newIndex.by_identifier[`email:${email.toLowerCase()}`] = slug;
  }

  console.log(`Index: ${Object.keys(oldIndex.by_tiktok || {}).length} tiktok, ${Object.keys(oldIndex.by_phone || {}).length} phone, ${Object.keys(oldIndex.by_email || {}).length} email → ${Object.keys(newIndex.by_identifier).length} unified identifiers`);

  // 3. Backup old index
  await fs.writeFile(indexPath + '.backup', raw, 'utf-8');
  console.log('Backed up _index.json → _index.json.backup');

  // 4. Write new index
  await fs.writeFile(indexPath, JSON.stringify(newIndex, null, 2) + '\n', 'utf-8');
  console.log('Wrote new _index.json\n');

  // 5. Migrate all profile.json files
  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  let migrated = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;

    const profilePath = path.join(dataDir, entry.name, 'profile.json');
    try {
      const profileRaw = await fs.readFile(profilePath, 'utf-8');
      const old: OldProfile = JSON.parse(profileRaw);

      // Already migrated?
      if (Array.isArray(old.phones) && Array.isArray(old.emails)) {
        skipped++;
        continue;
      }

      const newProfile: NewProfile = {
        tiktok: old.tiktok,
        naam: old.naam,
        phones: old.telefoon ? [old.telefoon] : [],
        emails: old.email ? [old.email] : [],
        kanalen: old.kanalen,
        eerste_contact: old.eerste_contact,
        notities: old.notities,
      };

      await fs.writeFile(profilePath, JSON.stringify(newProfile, null, 2) + '\n', 'utf-8');
      migrated++;
    } catch {
      // No profile.json in this dir
    }
  }

  console.log(`Profiles: ${migrated} migrated, ${skipped} already up-to-date`);
  console.log('\nDone!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
