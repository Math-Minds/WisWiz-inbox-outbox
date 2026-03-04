/**
 * Influencer Store — Data layer for influencer folder system
 *
 * Supports local filesystem (INFLUENCER_DATA_DIR) and GCS (GCS_BUCKET).
 * Each influencer has a folder with profile.json, whatsapp.json, videos.json,
 * optionally deal.json, and optionally an email/ directory with .md files.
 */

import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import type {
  Profile,
  InfluencerMessage,
  InfluencerSummary,
  Deal,
  DealStatus,
  Video,
  EmailThread,
} from './types';

const INFLUENCER_DIR = process.env.INFLUENCER_DATA_DIR || '';
const GCS_BUCKET = process.env.GCS_BUCKET || '';
const GCS_PREFIX = process.env.GCS_PREFIX || 'influencers';
const INDEX_FILE = '_index.json';

function isCloud(): boolean {
  return !!GCS_BUCKET;
}

let gcs: Storage | null = null;
function getGcs(): Storage {
  if (!gcs) gcs = new Storage();
  return gcs;
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

async function readFile(relativePath: string): Promise<string> {
  if (isCloud()) {
    const file = getGcs().bucket(GCS_BUCKET).file(`${GCS_PREFIX}/${relativePath}`);
    const [contents] = await file.download();
    return contents.toString('utf-8');
  } else {
    return fs.readFile(path.join(INFLUENCER_DIR, relativePath), 'utf-8');
  }
}

async function writeFile(relativePath: string, content: string): Promise<void> {
  if (isCloud()) {
    const file = getGcs().bucket(GCS_BUCKET).file(`${GCS_PREFIX}/${relativePath}`);
    await file.save(content, { contentType: 'application/json' });
  } else {
    const fullPath = path.join(INFLUENCER_DIR, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }
}

async function readJson<T>(relativePath: string): Promise<T> {
  const raw = await readFile(relativePath);
  return JSON.parse(raw);
}

async function writeJson(relativePath: string, data: unknown): Promise<void> {
  await writeFile(relativePath, JSON.stringify(data, null, 2) + '\n');
}

async function listDirs(): Promise<string[]> {
  if (isCloud()) {
    const bucket = getGcs().bucket(GCS_BUCKET);
    const [files] = await bucket.getFiles({
      prefix: `${GCS_PREFIX}/`,
      delimiter: '/',
    });
    // When using delimiter, GCS returns prefixes (directories) via apiResponse
    const [, , apiResponse] = await bucket.getFiles({
      prefix: `${GCS_PREFIX}/`,
      delimiter: '/',
      autoPaginate: false,
    });
    const prefixes: string[] = (apiResponse as any)?.prefixes || [];
    return prefixes
      .map((p: string) => p.replace(`${GCS_PREFIX}/`, '').replace(/\/$/, ''))
      .filter((d: string) => d && !d.startsWith('_'));
  } else {
    if (!INFLUENCER_DIR) return [];
    const entries = await fs.readdir(INFLUENCER_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  }
}

async function listFilesInDir(dir: string, extension?: string): Promise<string[]> {
  if (isCloud()) {
    const prefix = `${GCS_PREFIX}/${dir}/`;
    const [files] = await getGcs().bucket(GCS_BUCKET).getFiles({ prefix });
    return files
      .map((f) => f.name.replace(prefix, ''))
      .filter((name) => !name.includes('/') && (!extension || name.endsWith(extension)));
  } else {
    try {
      const entries = await fs.readdir(path.join(INFLUENCER_DIR, dir));
      return extension ? entries.filter((f) => f.endsWith(extension)) : entries;
    } catch {
      return [];
    }
  }
}

// ============================================================================
// INDEX
// ============================================================================

interface IndexData {
  by_identifier: Record<string, string>;
}

function phoneKey(phone: string): string { return `phone:${phone}`; }
function emailKey(email: string): string { return `email:${email.toLowerCase()}`; }
function tiktokKey(handle: string): string { return `tiktok:${handle}`; }

export function lookupByPhone(index: IndexData, phone: string): string | undefined {
  return index.by_identifier[phoneKey(phone)];
}

export function lookupByEmail(index: IndexData, email: string): string | undefined {
  return index.by_identifier[emailKey(email)];
}

export function lookupByTiktok(index: IndexData, handle: string): string | undefined {
  return index.by_identifier[tiktokKey(handle)];
}

export function allPhones(index: IndexData): string[] {
  return Object.keys(index.by_identifier)
    .filter((k) => k.startsWith('phone:'))
    .map((k) => k.slice(6));
}

export function allEmails(index: IndexData): string[] {
  return Object.keys(index.by_identifier)
    .filter((k) => k.startsWith('email:'))
    .map((k) => k.slice(6));
}

export function allEmailsForSlug(index: IndexData, slug: string): string[] {
  return Object.entries(index.by_identifier)
    .filter(([k, v]) => k.startsWith('email:') && v === slug)
    .map(([k]) => k.slice(6));
}

export { type IndexData };

let indexCache: IndexData | null = null;
let indexCacheTime: number = 0;
const INDEX_TTL = 10_000; // 10 seconds

async function getIndex(): Promise<IndexData> {
  const now = Date.now();
  if (indexCache && now - indexCacheTime < INDEX_TTL) {
    return indexCache;
  }

  if (!isCloud() && !INFLUENCER_DIR) {
    throw new Error('INFLUENCER_DATA_DIR is not configured');
  }

  indexCache = await readJson<IndexData>(INDEX_FILE);
  indexCacheTime = now;
  return indexCache;
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

export async function listInfluencers(): Promise<InfluencerSummary[]> {
  if (!isCloud() && !INFLUENCER_DIR) return [];

  const dirs = await listDirs();
  const summaries: InfluencerSummary[] = [];

  for (const slug of dirs) {
    try {
      const profile = await readJson<Profile>(`${slug}/profile.json`);

      let dealStatus: DealStatus | null = null;
      try {
        const deal = await readJson<Deal>(`${slug}/deal.json`);
        dealStatus = deal.status;
      } catch {
        // No deal.json
      }

      let laatsteActiviteit: string | null = null;
      try {
        const waData = await readJson<{ messages?: InfluencerMessage[] }>(`${slug}/whatsapp.json`);
        if (waData.messages?.length) {
          laatsteActiviteit = waData.messages[waData.messages.length - 1].timestamp;
        }
      } catch {
        // No whatsapp.json
      }

      summaries.push({
        slug,
        naam: profile.naam,
        tiktok: profile.tiktok,
        kanalen: profile.kanalen,
        dealStatus,
        laatsteActiviteit,
        archived: profile.archived ?? false,
      });
    } catch {
      // Skip invalid folders
    }
  }

  return summaries.sort((a, b) => {
    if (a.laatsteActiviteit && b.laatsteActiviteit) {
      return b.laatsteActiviteit.localeCompare(a.laatsteActiviteit);
    }
    if (a.laatsteActiviteit) return -1;
    if (b.laatsteActiviteit) return 1;
    return a.naam.localeCompare(b.naam);
  });
}

export async function getInfluencer(slug: string): Promise<Profile | null> {
  try {
    return await readJson<Profile>(`${slug}/profile.json`);
  } catch {
    return null;
  }
}

export async function getInfluencerByPhone(
  phone: string
): Promise<{ slug: string; profile: Profile } | null> {
  try {
    const index = await getIndex();
    const slug = lookupByPhone(index, phone);
    if (!slug) return null;

    const profile = await getInfluencer(slug);
    if (!profile) return null;

    return { slug, profile };
  } catch {
    return null;
  }
}

// ============================================================================
// PROFILE
// ============================================================================

export async function updateProfile(
  slug: string,
  updates: Partial<Profile>
): Promise<Profile> {
  const current = await readJson<Profile>(`${slug}/profile.json`);
  const updated: Profile = { ...current, ...updates };
  await writeJson(`${slug}/profile.json`, updated);

  if (updates.phones !== undefined || updates.emails !== undefined || updates.tiktok !== undefined) {
    const index = await getIndex();

    // Remove all old identifiers for this slug
    for (const [k, v] of Object.entries(index.by_identifier)) {
      if (v === slug) delete index.by_identifier[k];
    }

    // Re-add current identifiers
    if (updated.tiktok) index.by_identifier[tiktokKey(updated.tiktok)] = slug;
    for (const phone of updated.phones) {
      index.by_identifier[phoneKey(phone)] = slug;
    }
    for (const email of updated.emails) {
      index.by_identifier[emailKey(email)] = slug;
    }

    await writeJson(INDEX_FILE, index);
    indexCache = null;
    indexCacheTime = 0;
  }

  return updated;
}

// ============================================================================
// WHATSAPP MESSAGES
// ============================================================================

export async function getWhatsAppMessages(
  slug: string
): Promise<InfluencerMessage[]> {
  try {
    const data = await readJson<{ messages?: InfluencerMessage[] }>(`${slug}/whatsapp.json`);
    return data.messages || [];
  } catch {
    return [];
  }
}

export async function appendWhatsAppMessage(
  slug: string,
  msg: InfluencerMessage
): Promise<void> {
  let data: { phone?: string; folder?: string; messages: InfluencerMessage[] };
  try {
    data = await readJson(`${slug}/whatsapp.json`);
  } catch {
    data = { messages: [] };
  }

  data.messages.push(msg);
  await writeJson(`${slug}/whatsapp.json`, data);
}

// ============================================================================
// EMAIL THREADS
// ============================================================================

export async function getEmailThreads(slug: string): Promise<EmailThread[]> {
  const threads: EmailThread[] = [];
  const mdFiles = await listFilesInDir(`${slug}/email`, '.md');

  for (const file of mdFiles) {
    try {
      const raw = await readFile(`${slug}/email/${file}`);

      const subjectMatch = raw.match(/^# Thread: (.+)$/m);
      const participantsMatch = raw.match(/\*\*Participants:\*\* (.+)$/m);
      const statusMatch = raw.match(/\*\*Status:\*\* (.+)$/m);

      threads.push({
        filename: file,
        subject: subjectMatch?.[1] || file.replace('.md', ''),
        participants: participantsMatch?.[1]?.split(', ') || [],
        status: statusMatch?.[1] || 'Onbekend',
        content: raw,
      });
    } catch {
      // Skip unreadable files
    }
  }

  return threads;
}

// ============================================================================
// DEAL
// ============================================================================

function emptyDeal(): Deal {
  return {
    status: 'prospect',
    afspraken: {
      vergoeding: null,
      vergoeding_type: null,
      aantal_videos: null,
      prijs_per_1k_views: null,
      platform: null,
      deadline: null,
      notities: null,
    },
    betalingen: [],
    tijdlijn: [
      {
        timestamp: new Date().toISOString(),
        type: 'status_change',
        to: 'prospect',
      },
    ],
  };
}

export async function getDeal(slug: string): Promise<Deal | null> {
  try {
    return await readJson<Deal>(`${slug}/deal.json`);
  } catch {
    return null;
  }
}

export async function saveDeal(slug: string, deal: Deal): Promise<void> {
  await writeJson(`${slug}/deal.json`, deal);
}

export async function getOrCreateDeal(slug: string): Promise<Deal> {
  const existing = await getDeal(slug);
  if (existing) return existing;

  const deal = emptyDeal();
  await saveDeal(slug, deal);
  return deal;
}

// ============================================================================
// VIDEOS
// ============================================================================

export async function getVideos(slug: string): Promise<Video[]> {
  try {
    const data = await readJson<{ videos?: Video[] }>(`${slug}/videos.json`);
    return data.videos || [];
  } catch {
    return [];
  }
}

export async function saveVideos(slug: string, videos: Video[]): Promise<void> {
  await writeJson(`${slug}/videos.json`, { videos });
}
