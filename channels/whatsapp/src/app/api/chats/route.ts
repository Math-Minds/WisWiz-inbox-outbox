import { NextResponse } from 'next/server';
import { listChats } from '@/lib/file-store';
import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';

const GCS_BUCKET = process.env.GCS_BUCKET || '';
const GCS_PREFIX = process.env.GCS_PREFIX || 'influencers';

async function getLinkedPhones(): Promise<Set<string>> {
  try {
    let raw: string;
    if (GCS_BUCKET) {
      const storage = new Storage();
      const [contents] = await storage.bucket(GCS_BUCKET).file(`${GCS_PREFIX}/_index.json`).download();
      raw = contents.toString('utf-8');
    } else if (process.env.INFLUENCER_DATA_DIR) {
      raw = await fs.readFile(
        path.join(process.env.INFLUENCER_DATA_DIR, '_index.json'),
        'utf-8'
      );
    } else {
      return new Set();
    }
    const index = JSON.parse(raw);
    const phones = Object.keys(index.by_identifier || {})
      .filter((k: string) => k.startsWith('phone:'))
      .map((k: string) => k.slice(6));
    return new Set(phones);
  } catch {
    return new Set();
  }
}

export async function GET() {
  try {
    const [chats, linkedPhones] = await Promise.all([
      listChats(),
      getLinkedPhones(),
    ]);

    const unmatched = chats.filter(
      (c) => !linkedPhones.has(c.thread.contactPhone)
    );

    const result = unmatched.map((c) => ({
      phone: c.thread.contactPhone,
      name: c.contact?.profile?.name || c.contact?.profile?.pushName || c.thread.contactPhone,
      lastMessage: c.thread.lastMessagePreview,
      lastMessageAt: c.thread.lastMessageAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to list unmatched chats:', error);
    return NextResponse.json([]);
  }
}
