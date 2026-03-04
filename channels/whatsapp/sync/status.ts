/**
 * Sync Status — Shared status file between sync script and CRM.
 *
 * The sync script writes status updates to sync-status.json.
 * The CRM API reads it and the frontend polls for updates.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dir = path.dirname(__filename);
const STATUS_FILE = path.join(__dir, 'sync-status.json');

export type SyncStatusType = 'idle' | 'connecting' | 'qr' | 'ready' | 'syncing' | 'done' | 'error';

export interface SyncStatus {
  status: SyncStatusType;
  qrDataUrl: string | null;
  updatedAt: string;
  progress: { current: number; total: number; lastChat: string } | null;
  result: { synced: number; skipped: number; newInfluencers: number; errors: string[] } | null;
  error: string | null;
}

function makeStatus(partial: Partial<SyncStatus>): SyncStatus {
  return {
    status: 'idle',
    qrDataUrl: null,
    updatedAt: new Date().toISOString(),
    progress: null,
    result: null,
    error: null,
    ...partial,
  };
}

export async function writeStatus(partial: Partial<SyncStatus>): Promise<void> {
  const status = makeStatus(partial);
  await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2) + '\n', 'utf-8');
}

export async function readStatus(): Promise<SyncStatus> {
  try {
    const raw = await fs.readFile(STATUS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return makeStatus({ status: 'idle' });
  }
}
