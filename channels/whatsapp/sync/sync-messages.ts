/**
 * Core Sync Logic — Processes messages from Baileys events,
 * transforms them, deduplicates, and writes to influencer storage.
 *
 * Storage: local filesystem (INFLUENCER_DATA_DIR) or GCS (GCS_BUCKET).
 */

import type { WASocket, proto } from '@whiskeysockets/baileys';
import {
  loadSyncState,
  saveSyncState,
  getLastSyncedTimestamp,
  updateLastSynced,
  isDuplicate,
} from './dedup';
import { readJson, writeJson, exists } from './storage';

const DEFAULT_SENDER_NAME = 'WisWiz';

export interface SyncOptions {
  /** Skip chats with unknown phone numbers (no auto-create). Default: false */
  skipUnknown?: boolean;
  /** Sender name for outbound messages. Default: 'WisWiz' */
  senderName?: string;
  /** Source label for outbound messages, shown in CRM (e.g. 'philip_persoonlijk') */
  sourceLabel?: string;
}

interface IndexData {
  by_identifier: Record<string, string>;
}

function phoneKey(phone: string): string { return `phone:${phone}`; }

interface InfluencerMessage {
  timestamp: string;
  sender: string;
  text: string;
  direction: 'inbound' | 'outbound';
  source?: string; // e.g. 'philip_persoonlijk' — only set for non-default accounts
}

interface WhatsAppData {
  phone?: string;
  folder?: string;
  messages: InfluencerMessage[];
}

function normalizePhone(jid: string): { indexPhone: string; filePhone: string } {
  const raw = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
  return {
    indexPhone: `+${raw}`,
    filePhone: raw,
  };
}

function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, '');
}

function getMessageText(msg: proto.IWebMessageInfo): string | null {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    null
  );
}

function isIndividualChat(jid: string): boolean {
  return jid.endsWith('@s.whatsapp.net') && jid !== '0@s.whatsapp.net';
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function uniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let i = 2;
  while (true) {
    if (await exists(slug)) {
      slug = `${baseSlug}_${i}`;
      i++;
    } else {
      return slug;
    }
  }
}

async function createInfluencer(
  phone: string,
  filePhone: string,
  name: string,
  date: string,
  index: IndexData
): Promise<string> {
  const baseSlug = nameToSlug(name) || filePhone;
  const slug = await uniqueSlug(baseSlug);

  const profile = {
    tiktok: null,
    naam: name,
    phones: [phone],
    emails: [],
    kanalen: ['whatsapp'],
    eerste_contact: date,
    notities: null,
  };
  await writeJson(`${slug}/profile.json`, profile);

  const whatsapp: WhatsAppData = { phone: filePhone, messages: [] };
  await writeJson(`${slug}/whatsapp.json`, whatsapp);

  index.by_identifier[phoneKey(phone)] = slug;
  await writeJson('_index.json', index);

  console.log(`  📁 Nieuwe influencer: ${slug} (${name}, ${phone})`);
  return slug;
}

async function loadWhatsAppData(slug: string): Promise<WhatsAppData> {
  try {
    return await readJson<WhatsAppData>(`${slug}/whatsapp.json`);
  } catch {
    return { messages: [] };
  }
}

async function processBatch(messages: proto.IWebMessageInfo[], source: string, options: SyncOptions = {}): Promise<void> {
  const { skipUnknown = false, senderName = DEFAULT_SENDER_NAME, sourceLabel } = options;
  const syncState = await loadSyncState();
  let index: IndexData;
  try {
    index = await readJson<IndexData>('_index.json');
  } catch {
    console.error('❌ _index.json niet gevonden in storage');
    return;
  }

  const byChat = new Map<string, proto.IWebMessageInfo[]>();
  const names = new Map<string, string>();

  for (const msg of messages) {
    const jid = msg.key?.remoteJid;
    if (!jid || !isIndividualChat(jid)) continue;

    const text = getMessageText(msg);
    if (!text) continue;

    if (!byChat.has(jid)) byChat.set(jid, []);
    byChat.get(jid)!.push(msg);

    if (msg.pushName && !names.has(jid)) {
      names.set(jid, msg.pushName);
    }
  }

  let totalSynced = 0;
  let totalSkipped = 0;
  let totalNew = 0;

  for (const [jid, msgs] of byChat) {
    const { indexPhone, filePhone } = normalizePhone(jid);
    const lastSynced = getLastSyncedTimestamp(syncState, jid);
    const pushName = names.get(jid);

    const newMsgs = msgs.filter((m) => {
      const ts = Number(m.messageTimestamp || 0);
      return ts > lastSynced && getMessageText(m);
    });

    if (newMsgs.length === 0) continue;

    let slug = index.by_identifier[phoneKey(indexPhone)];
    if (!slug) {
      if (skipUnknown) continue; // Skip unknown contacts for personal accounts
      const name = pushName || filePhone;
      const firstTs = Number(newMsgs[0].messageTimestamp || 0);
      const firstDate = formatTimestamp(firstTs).split('T')[0];
      slug = await createInfluencer(indexPhone, filePhone, name, firstDate, index);
      totalNew++;
    }

    const waData = await loadWhatsAppData(slug);
    let addedCount = 0;
    let maxTs = lastSynced;

    for (const msg of newMsgs) {
      const ts = Number(msg.messageTimestamp || 0);
      const text = getMessageText(msg)!;
      const fromMe = msg.key?.fromMe ?? false;

      const transformed: InfluencerMessage = {
        timestamp: formatTimestamp(ts),
        sender: fromMe ? senderName : (pushName || indexPhone),
        text,
        direction: fromMe ? 'outbound' : 'inbound',
        ...(sourceLabel ? { source: sourceLabel } : {}),
      };

      if (!isDuplicate(waData.messages, transformed)) {
        waData.messages.push(transformed);
        addedCount++;
      } else {
        totalSkipped++;
      }

      if (ts > maxTs) maxTs = ts;
    }

    if (addedCount > 0) {
      waData.messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      await writeJson(`${slug}/whatsapp.json`, waData);
      totalSynced += addedCount;
      console.log(`  💬 ${slug}: +${addedCount} berichten`);
    }

    updateLastSynced(syncState, jid, maxTs);
  }

  await saveSyncState(syncState);

  if (totalSynced > 0 || totalNew > 0) {
    console.log(`  📊 ${source}: ${totalSynced} nieuw, ${totalSkipped} duplicaten, ${totalNew} nieuwe influencers`);
  }
}

export function processHistorySync(sock: WASocket, options?: SyncOptions): void {
  const label = options?.sourceLabel || 'WisWiz';
  sock.ev.on('messaging-history.set', async ({ messages, progress }) => {
    console.log(`📥 [${label}] History sync: ${messages.length} berichten (${progress ?? '?'}%)`);
    if (messages.length > 0) {
      await processBatch(messages, 'History sync', options);
    }
  });
}

export function processIncomingMessages(sock: WASocket, options?: SyncOptions): void {
  const label = options?.sourceLabel || 'WisWiz';
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type === 'notify') {
      console.log(`📨 [${label}] Nieuw bericht ontvangen: ${messages.length}`);
      await processBatch(messages, 'Real-time', options);
    } else {
      if (messages.length > 0) {
        console.log(`📨 [${label}] Backfill: ${messages.length} berichten`);
        await processBatch(messages, 'Backfill', options);
      }
    }
  });
}
