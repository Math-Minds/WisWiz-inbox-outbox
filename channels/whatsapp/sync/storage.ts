/**
 * Storage abstraction — Supports both local filesystem and Google Cloud Storage.
 *
 * When GCS_BUCKET is set, reads/writes go to GCS.
 * Otherwise, falls back to local filesystem (INFLUENCER_DATA_DIR).
 */

import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';

const GCS_BUCKET = process.env.GCS_BUCKET || '';
const GCS_PREFIX = process.env.GCS_PREFIX || 'influencers';
const LOCAL_DIR = process.env.INFLUENCER_DATA_DIR || '';

let gcs: Storage | null = null;

function getGcs(): Storage {
  if (!gcs) gcs = new Storage();
  return gcs;
}

function isCloud(): boolean {
  return !!GCS_BUCKET;
}

/**
 * Read a JSON file from storage.
 */
export async function readJson<T>(relativePath: string): Promise<T> {
  if (isCloud()) {
    const file = getGcs().bucket(GCS_BUCKET).file(`${GCS_PREFIX}/${relativePath}`);
    const [contents] = await file.download();
    return JSON.parse(contents.toString('utf-8'));
  } else {
    const raw = await fs.readFile(path.join(LOCAL_DIR, relativePath), 'utf-8');
    return JSON.parse(raw);
  }
}

/**
 * Write a JSON file to storage.
 */
export async function writeJson(relativePath: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2) + '\n';

  if (isCloud()) {
    const file = getGcs().bucket(GCS_BUCKET).file(`${GCS_PREFIX}/${relativePath}`);
    await file.save(content, { contentType: 'application/json' });
  } else {
    const fullPath = path.join(LOCAL_DIR, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }
}

/**
 * Check if a path exists in storage.
 */
export async function exists(relativePath: string): Promise<boolean> {
  if (isCloud()) {
    const file = getGcs().bucket(GCS_BUCKET).file(`${GCS_PREFIX}/${relativePath}`);
    const [ex] = await file.exists();
    return ex;
  } else {
    try {
      await fs.access(path.join(LOCAL_DIR, relativePath));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Read a text file from storage.
 */
export async function readText(relativePath: string): Promise<string> {
  if (isCloud()) {
    const file = getGcs().bucket(GCS_BUCKET).file(`${GCS_PREFIX}/${relativePath}`);
    const [contents] = await file.download();
    return contents.toString('utf-8');
  } else {
    return await fs.readFile(path.join(LOCAL_DIR, relativePath), 'utf-8');
  }
}

/**
 * Write a text file to storage.
 */
export async function writeText(relativePath: string, content: string): Promise<void> {
  if (isCloud()) {
    const file = getGcs().bucket(GCS_BUCKET).file(`${GCS_PREFIX}/${relativePath}`);
    await file.save(content, { contentType: 'text/markdown' });
  } else {
    const fullPath = path.join(LOCAL_DIR, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }
}

/**
 * Read a JSON file from the bucket root (not under GCS_PREFIX).
 */
export async function readRootJson<T>(key: string): Promise<T> {
  if (isCloud()) {
    const file = getGcs().bucket(GCS_BUCKET).file(key);
    const [contents] = await file.download();
    return JSON.parse(contents.toString('utf-8'));
  } else {
    const raw = await fs.readFile(path.join(LOCAL_DIR, '..', key), 'utf-8');
    return JSON.parse(raw);
  }
}

/**
 * Write a JSON file to the bucket root (not under GCS_PREFIX).
 */
export async function writeRootJson(key: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2) + '\n';

  if (isCloud()) {
    const file = getGcs().bucket(GCS_BUCKET).file(key);
    await file.save(content, { contentType: 'application/json' });
  } else {
    const fullPath = path.join(LOCAL_DIR, '..', key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }
}

/**
 * Get the storage mode for logging.
 */
export function getStorageMode(): string {
  return isCloud() ? `GCS (${GCS_BUCKET}/${GCS_PREFIX})` : `Local (${LOCAL_DIR})`;
}
