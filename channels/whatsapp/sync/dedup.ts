/**
 * Deduplication — Tracks sync state per chat and deduplicates messages.
 *
 * sync-state.json stores the last synced timestamp per chat ID,
 * so subsequent runs only process new messages.
 *
 * Supports local filesystem and GCS (when GCS_BUCKET is set).
 */

import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dir = path.dirname(__filename);

const GCS_BUCKET = process.env.GCS_BUCKET || '';
const STATE_GCS_KEY = 'whatsapp-sync-state.json';
const STATE_LOCAL_FILE = path.join(__dir, 'sync-state.json');

interface SyncState {
  [chatId: string]: { lastSyncedTimestamp: number };
}

export async function loadSyncState(): Promise<SyncState> {
  try {
    if (GCS_BUCKET) {
      const storage = new Storage();
      const [contents] = await storage.bucket(GCS_BUCKET).file(STATE_GCS_KEY).download();
      return JSON.parse(contents.toString('utf-8'));
    } else {
      const raw = await fs.readFile(STATE_LOCAL_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    return {};
  }
}

export async function saveSyncState(state: SyncState): Promise<void> {
  const content = JSON.stringify(state, null, 2) + '\n';

  if (GCS_BUCKET) {
    const storage = new Storage();
    await storage.bucket(GCS_BUCKET).file(STATE_GCS_KEY).save(content, {
      contentType: 'application/json',
    });
  } else {
    await fs.writeFile(STATE_LOCAL_FILE, content, 'utf-8');
  }
}

export function getLastSyncedTimestamp(state: SyncState, chatId: string): number {
  return state[chatId]?.lastSyncedTimestamp ?? 0;
}

export function updateLastSynced(state: SyncState, chatId: string, timestamp: number): void {
  state[chatId] = { lastSyncedTimestamp: timestamp };
}

/**
 * Check if a message already exists in the influencer's message list.
 * Compares timestamp + text + direction to avoid duplicates.
 */
export function isDuplicate(
  existing: { timestamp: string; text: string; direction: string }[],
  msg: { timestamp: string; text: string; direction: string }
): boolean {
  return existing.some(
    (e) => e.timestamp === msg.timestamp && e.text === msg.text && e.direction === msg.direction
  );
}
