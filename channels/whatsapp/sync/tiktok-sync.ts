/**
 * TikTok Sync — Auto-discover collaboration videos
 *
 * Fetches TikTok videos for all influencers with a TikTok handle.
 * Filters for videos mentioning @wiswiz or @wiswiznl.
 * Merges into each influencer's videos.json.
 *
 * Uses ScrapeCreators API: https://scrapecreators.com
 */

import { readJson, writeJson, readRootJson, writeRootJson } from './storage';

interface Video {
  id: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  url: string | null;
  titel: string | null;
  datum_gepost: string | null;
  status: 'concept' | 'in_review' | 'gepost';
  views: number | null;
  likes: number | null;
  comments: number | null;
  notitie: string | null;
}

const API_BASE = 'https://api.scrapecreators.com/v2/tiktok/user/posts';
const API_KEY = process.env.SCRAPECREATORS_API_KEY || '';

interface SyncState {
  lastSyncedAt: Record<string, string>; // handle → ISO timestamp
}

interface TikTokVideo {
  id: string;
  desc: string;
  createTime: number;
  stats: {
    playCount: number;
    diggCount: number;
    commentCount: number;
  };
}

interface TikTokApiResponse {
  data: {
    videos: TikTokVideo[];
    cursor: string;
    hasMore: boolean;
  };
}

function mentionsWiswiz(desc: string): boolean {
  const lower = desc.toLowerCase();
  return lower.includes('@wiswiz') || lower.includes('@wiswiznl');
}

function toVideoRecord(video: TikTokVideo, username: string): Video {
  const titel = video.desc.length > 80
    ? video.desc.slice(0, 80) + '…'
    : video.desc;

  return {
    id: `tt_${video.id}`,
    platform: 'tiktok',
    url: `https://www.tiktok.com/@${username}/video/${video.id}`,
    titel,
    datum_gepost: new Date(video.createTime * 1000).toISOString().split('T')[0],
    status: 'gepost',
    views: video.stats.playCount,
    likes: video.stats.diggCount,
    comments: video.stats.commentCount,
    notitie: null,
  };
}

async function fetchUserVideos(
  handle: string,
  lastSyncedAt: string | null,
): Promise<TikTokVideo[]> {
  const allVideos: TikTokVideo[] = [];
  let cursor = '';
  const cutoff = lastSyncedAt ? new Date(lastSyncedAt).getTime() / 1000 : 0;

  while (true) {
    const url = new URL(API_BASE);
    url.searchParams.set('handle', handle);
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: { 'x-api-key': API_KEY },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`  ⚠ API error for @${handle}: ${res.status} ${text}`);
      break;
    }

    const json = (await res.json()) as TikTokApiResponse;
    const videos = json.data?.videos ?? [];

    if (videos.length === 0) break;

    // Check if we've gone past the cutoff
    let reachedCutoff = false;
    for (const v of videos) {
      if (v.createTime < cutoff) {
        reachedCutoff = true;
        break;
      }
      allVideos.push(v);
    }

    if (reachedCutoff || !json.data?.hasMore) break;
    cursor = json.data.cursor;
  }

  return allVideos;
}

export async function startTikTokSync(): Promise<void> {
  if (!API_KEY) {
    console.log('⏭ TikTok sync: SCRAPECREATORS_API_KEY not set, skipping.');
    return;
  }

  console.log('🎵 TikTok sync: gestart...');

  // Load index → extract tiktok handles
  const index = await readJson<{ by_tiktok: Record<string, string> }>('_index.json');
  const tiktokEntries: { handle: string; slug: string }[] = [];
  for (const [handle, slug] of Object.entries(index.by_tiktok)) {
    // handle is "@username" — strip the @
    tiktokEntries.push({ handle: handle.replace(/^@/, ''), slug });
  }

  console.log(`   ${tiktokEntries.length} influencers met TikTok handle`);

  // Load sync state
  let syncState: SyncState;
  try {
    syncState = await readRootJson<SyncState>('tiktok-sync-state.json');
  } catch {
    syncState = { lastSyncedAt: {} };
  }

  let totalNew = 0;
  let totalUpdated = 0;

  for (const { handle, slug } of tiktokEntries) {
    try {
      const lastSynced = syncState.lastSyncedAt[handle] || null;
      const videos = await fetchUserVideos(handle, lastSynced);

      // Filter for @wiswiz mentions
      const collabVideos = videos.filter((v) => mentionsWiswiz(v.desc));

      if (collabVideos.length === 0 && videos.length > 0) {
        // Update sync timestamp even if no collab videos found
        syncState.lastSyncedAt[handle] = new Date().toISOString();
        continue;
      }

      if (collabVideos.length === 0) continue;

      // Load existing videos
      let existing: Video[];
      try {
        const data = await readJson<{ videos: Video[] }>(`${slug}/videos.json`);
        existing = data.videos;
      } catch {
        existing = [];
      }

      const existingById = new Map(existing.map((v) => [v.id, v]));
      let newCount = 0;
      let updatedCount = 0;

      for (const tv of collabVideos) {
        const id = `tt_${tv.id}`;
        const existingVideo = existingById.get(id);

        if (existingVideo) {
          // Update stats only
          existingVideo.views = tv.stats.playCount;
          existingVideo.likes = tv.stats.diggCount;
          existingVideo.comments = tv.stats.commentCount;
          updatedCount++;
        } else {
          // New video
          existing.push(toVideoRecord(tv, handle));
          newCount++;
        }
      }

      // Sort by date descending
      existing.sort((a, b) => {
        const da = a.datum_gepost || '';
        const db = b.datum_gepost || '';
        return db.localeCompare(da);
      });

      await writeJson(`${slug}/videos.json`, { videos: existing });

      if (newCount > 0 || updatedCount > 0) {
        console.log(`   @${handle}: ${newCount} nieuw, ${updatedCount} bijgewerkt`);
      }

      totalNew += newCount;
      totalUpdated += updatedCount;
      syncState.lastSyncedAt[handle] = new Date().toISOString();
    } catch (err) {
      console.error(`  ⚠ Fout bij @${handle}:`, err);
    }
  }

  // Save sync state
  await writeRootJson('tiktok-sync-state.json', syncState);

  console.log(`🎵 TikTok sync: klaar — ${totalNew} nieuw, ${totalUpdated} bijgewerkt`);
}
