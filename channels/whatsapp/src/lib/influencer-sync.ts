/**
 * Influencer Sync Module
 *
 * Syncs incoming WhatsApp webhook messages to the influencer folder system.
 * Matches phone numbers against _index.json and appends messages to the
 * influencer's whatsapp.json. Unknown numbers get auto-created as new influencers.
 */

import fs from 'fs/promises';
import path from 'path';

const INFLUENCER_DIR = process.env.INFLUENCER_DATA_DIR || '';
const INDEX_FILE = '_index.json';

interface IndexData {
  by_identifier: Record<string, string>;
}

// Cached index data
let indexCache: IndexData | null = null;
let indexMtime: number = 0;

function phoneKey(phone: string): string { return `phone:${phone}`; }

/**
 * Load and cache _index.json, reloading when the file changes.
 */
async function getIndex(): Promise<IndexData> {
  if (!INFLUENCER_DIR) {
    throw new Error('INFLUENCER_DATA_DIR is not configured');
  }

  const indexPath = path.join(INFLUENCER_DIR, INDEX_FILE);
  const stat = await fs.stat(indexPath);
  const mtime = stat.mtimeMs;

  if (!indexCache || mtime !== indexMtime) {
    const raw = await fs.readFile(indexPath, 'utf-8');
    indexCache = JSON.parse(raw);
    indexMtime = mtime;
    console.log('[Influencer Sync] Index loaded/reloaded');
  }

  return indexCache!;
}

/**
 * Invalidate cache so next getIndex() re-reads from disk.
 */
function invalidateCache(): void {
  indexCache = null;
  indexMtime = 0;
}

/**
 * Generate a slug from a WhatsApp profile name.
 * "Levii" → "levii", "Jan de Vries" → "jan_de_vries"
 */
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Ensure slug is unique by appending _2, _3, etc. if the folder already exists.
 */
async function uniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let i = 2;
  while (true) {
    try {
      await fs.access(path.join(INFLUENCER_DIR, slug));
      // Folder exists, try next
      slug = `${baseSlug}_${i}`;
      i++;
    } catch {
      // Folder doesn't exist — slug is available
      return slug;
    }
  }
}

/**
 * Create a new influencer: folder, profile.json, whatsapp.json, and update _index.json.
 */
async function createInfluencer(
  phone: string,
  name: string,
  date: string
): Promise<string> {
  const baseSlug = nameToSlug(name) || phone.replace(/\+/g, '');
  const slug = await uniqueSlug(baseSlug);
  const folderPath = path.join(INFLUENCER_DIR, slug);

  // Create folder
  await fs.mkdir(folderPath, { recursive: true });

  // Create profile.json
  const profile = {
    tiktok: null,
    naam: name,
    phones: [phone],
    emails: [],
    kanalen: ['whatsapp'],
    eerste_contact: date,
    notities: null,
  };
  await fs.writeFile(
    path.join(folderPath, 'profile.json'),
    JSON.stringify(profile, null, 2) + '\n',
    'utf-8'
  );

  // Create empty whatsapp.json
  const whatsapp = { phone: phone.replace('+', ''), messages: [] };
  await fs.writeFile(
    path.join(folderPath, 'whatsapp.json'),
    JSON.stringify(whatsapp, null, 2) + '\n',
    'utf-8'
  );

  // Update _index.json
  const index = await getIndex();
  index.by_identifier[phoneKey(phone)] = slug;
  await fs.writeFile(
    path.join(INFLUENCER_DIR, INDEX_FILE),
    JSON.stringify(index, null, 2) + '\n',
    'utf-8'
  );
  invalidateCache();

  console.log(`[Influencer Sync] Created new influencer: ${slug} (${name}, ${phone})`);
  return slug;
}

/**
 * Sync an incoming WhatsApp message to the influencer folder system.
 *
 * - Known phone: appends to existing influencer's whatsapp.json
 * - Unknown phone: auto-creates influencer folder, then appends
 */
export async function syncToInfluencer(
  phone: string,
  senderName: string | undefined,
  text: string | undefined,
  timestamp: string
): Promise<void> {
  if (!INFLUENCER_DIR) {
    console.log('[Influencer Sync] Skipped: INFLUENCER_DATA_DIR not configured');
    return;
  }

  // Only sync text messages
  if (!text) return;

  const index = await getIndex();
  let slug = index.by_identifier[phoneKey(phone)];

  // Format timestamp to match existing format (no milliseconds, no timezone)
  const ts = timestamp.replace(/\.\d{3}Z$/, '').replace('Z', '');
  const date = ts.split('T')[0]; // YYYY-MM-DD

  // Auto-create influencer if unknown number
  if (!slug) {
    const name = senderName || phone;
    slug = await createInfluencer(phone, name, date);
  }

  const message = {
    timestamp: ts,
    sender: senderName || phone,
    text,
    direction: 'inbound' as const,
  };

  await appendToInfluencer(slug, message);
  console.log(`[Influencer Sync] Message synced to ${slug}`);
}

/**
 * Append a message to an influencer's whatsapp.json.
 */
async function appendToInfluencer(
  slug: string,
  message: { timestamp: string; sender: string; text: string; direction: string }
): Promise<void> {
  const filePath = path.join(INFLUENCER_DIR, slug, 'whatsapp.json');

  let data: { phone?: string; folder?: string; messages: typeof message[] };

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    data = JSON.parse(raw);
  } catch {
    data = { messages: [] };
  }

  data.messages.push(message);

  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
