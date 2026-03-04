/**
 * File-based Storage Layer
 *
 * Stores contacts, chats, and outbox messages as local files.
 * This enables Claude Code to read/write directly via the file system.
 *
 * Structure:
 *   data/
 *     contacts/
 *       +31612345678.json
 *     chats/
 *       +31612345678/
 *         thread.json
 *         messages.jsonl
 *     outbox/
 *       pending/
 *         1735034100000_+31612345678.json
 *       sent/
 *         1735034100000_+31612345678.json
 *     media/
 *       +31612345678/
 *         img_20241224_001.jpg
 */

import fs from 'fs/promises';
import path from 'path';
import type { Contact, Message, Thread, OutboxMessage } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONTACTS_DIR = path.join(DATA_DIR, 'contacts');
const CHATS_DIR = path.join(DATA_DIR, 'chats');
const OUTBOX_DIR = path.join(DATA_DIR, 'outbox');
const MEDIA_DIR = path.join(DATA_DIR, 'media');

// ============================================================================
// HELPERS
// ============================================================================

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function normalizePhone(phone: string): string {
  // Ensure E.164 format with +
  if (!phone.startsWith('+')) {
    return `+${phone}`;
  }
  return phone;
}

// ============================================================================
// CONTACTS
// ============================================================================

export async function getContact(phone: string): Promise<Contact | null> {
  const normalizedPhone = normalizePhone(phone);
  const filePath = path.join(CONTACTS_DIR, `${normalizedPhone}.json`);

  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as Contact;
  } catch {
    return null;
  }
}

export async function saveContact(contact: Contact): Promise<void> {
  await ensureDir(CONTACTS_DIR);
  const filePath = path.join(CONTACTS_DIR, `${contact.phone}.json`);
  await fs.writeFile(filePath, JSON.stringify(contact, null, 2));
}

export async function updateContact(
  phone: string,
  updates: Partial<Contact>
): Promise<Contact> {
  const normalizedPhone = normalizePhone(phone);
  let contact = await getContact(normalizedPhone);

  if (!contact) {
    // Create new contact
    contact = {
      id: `contact_${Date.now()}`,
      phone: normalizedPhone,
      whatsappId: normalizedPhone.replace('+', ''),
      profile: {},
      metadata: {
        firstContact: new Date().toISOString(),
        lastContact: new Date().toISOString(),
        messageCount: 0,
        tags: [],
      },
    };
  }

  // Merge updates
  const updated: Contact = {
    ...contact,
    ...updates,
    profile: { ...contact.profile, ...updates.profile },
    metadata: { ...contact.metadata, ...updates.metadata },
  };

  await saveContact(updated);
  return updated;
}

export async function listContacts(): Promise<Contact[]> {
  await ensureDir(CONTACTS_DIR);

  try {
    const files = await fs.readdir(CONTACTS_DIR);
    const contacts: Contact[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = await fs.readFile(path.join(CONTACTS_DIR, file), 'utf-8');
        contacts.push(JSON.parse(data));
      }
    }

    // Sort by last contact (most recent first)
    return contacts.sort(
      (a, b) =>
        new Date(b.metadata.lastContact).getTime() -
        new Date(a.metadata.lastContact).getTime()
    );
  } catch {
    return [];
  }
}

// ============================================================================
// MESSAGES / CHATS
// ============================================================================

function getChatDir(phone: string): string {
  return path.join(CHATS_DIR, normalizePhone(phone));
}

export async function getThread(phone: string): Promise<Thread | null> {
  const chatDir = getChatDir(phone);
  const filePath = path.join(chatDir, 'thread.json');

  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as Thread;
  } catch {
    return null;
  }
}

export async function saveThread(phone: string, thread: Thread): Promise<void> {
  const chatDir = getChatDir(phone);
  await ensureDir(chatDir);
  const filePath = path.join(chatDir, 'thread.json');
  await fs.writeFile(filePath, JSON.stringify(thread, null, 2));
}

export async function appendMessage(
  phone: string,
  message: Message
): Promise<void> {
  const chatDir = getChatDir(phone);
  await ensureDir(chatDir);

  // Append to messages.jsonl (JSON Lines format)
  const filePath = path.join(chatDir, 'messages.jsonl');
  const line = JSON.stringify(message) + '\n';
  await fs.appendFile(filePath, line);

  // Update thread metadata
  const thread: Thread = {
    contactPhone: normalizePhone(phone),
    lastMessageAt: message.ts,
    lastMessagePreview:
      message.body?.substring(0, 50) || `[${message.type}]` || '',
    unreadCount: message.dir === 'in' ? 1 : 0,
    isOpen: true,
    windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  await saveThread(phone, thread);

  // Update contact's last contact time
  await updateContact(phone, {
    metadata: {
      firstContact: message.ts,
      lastContact: message.ts,
      messageCount: 0,
      tags: [],
    },
  });
}

export async function getMessages(
  phone: string,
  options: { limit?: number; offset?: number } = {}
): Promise<Message[]> {
  const { limit = 100, offset = 0 } = options;
  const chatDir = getChatDir(phone);
  const filePath = path.join(chatDir, 'messages.jsonl');

  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const lines = data.trim().split('\n').filter(Boolean);
    const messages = lines.map((line) => JSON.parse(line) as Message);

    // Return with offset and limit, newest first
    return messages.reverse().slice(offset, offset + limit);
  } catch {
    return [];
  }
}

export async function listChats(): Promise<
  Array<{ contact: Contact | null; thread: Thread }>
> {
  await ensureDir(CHATS_DIR);

  try {
    const phones = await fs.readdir(CHATS_DIR);
    const chats: Array<{ contact: Contact | null; thread: Thread }> = [];

    for (const phone of phones) {
      const thread = await getThread(phone);
      if (thread) {
        const contact = await getContact(phone);
        chats.push({ contact, thread });
      }
    }

    // Sort by last message (most recent first)
    return chats.sort(
      (a, b) =>
        new Date(b.thread.lastMessageAt).getTime() -
        new Date(a.thread.lastMessageAt).getTime()
    );
  } catch {
    return [];
  }
}

// ============================================================================
// OUTBOX
// ============================================================================

export async function createOutboxMessage(
  message: Omit<OutboxMessage, 'createdAt'>
): Promise<string> {
  const pendingDir = path.join(OUTBOX_DIR, 'pending');
  await ensureDir(pendingDir);

  const timestamp = Date.now();
  const filename = `${timestamp}_${normalizePhone(message.to)}.json`;
  const filePath = path.join(pendingDir, filename);

  const outboxMessage: OutboxMessage = {
    ...message,
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(filePath, JSON.stringify(outboxMessage, null, 2));
  return filename;
}

export async function getPendingMessages(): Promise<
  Array<{ filename: string; message: OutboxMessage }>
> {
  const pendingDir = path.join(OUTBOX_DIR, 'pending');
  await ensureDir(pendingDir);

  try {
    const files = await fs.readdir(pendingDir);
    const messages: Array<{ filename: string; message: OutboxMessage }> = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = await fs.readFile(path.join(pendingDir, file), 'utf-8');
        messages.push({
          filename: file,
          message: JSON.parse(data) as OutboxMessage,
        });
      }
    }

    // Sort by timestamp in filename (oldest first for FIFO)
    return messages.sort((a, b) => a.filename.localeCompare(b.filename));
  } catch {
    return [];
  }
}

export async function markMessageSent(
  filename: string,
  messageId: string
): Promise<void> {
  const pendingPath = path.join(OUTBOX_DIR, 'pending', filename);
  const sentDir = path.join(OUTBOX_DIR, 'sent');
  await ensureDir(sentDir);

  try {
    const data = await fs.readFile(pendingPath, 'utf-8');
    const message = JSON.parse(data);

    // Add sent metadata
    message.sentAt = new Date().toISOString();
    message.messageId = messageId;

    // Write to sent folder
    const sentPath = path.join(sentDir, filename);
    await fs.writeFile(sentPath, JSON.stringify(message, null, 2));

    // Remove from pending
    await fs.unlink(pendingPath);
  } catch (error) {
    console.error('Failed to mark message as sent:', error);
  }
}

// ============================================================================
// MEDIA
// ============================================================================

export async function saveMedia(
  phone: string,
  mediaId: string,
  data: Buffer,
  mimeType: string
): Promise<string> {
  const mediaDir = path.join(MEDIA_DIR, normalizePhone(phone));
  await ensureDir(mediaDir);

  // Determine extension from mime type
  const ext =
    {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'application/pdf': 'pdf',
    }[mimeType] || 'bin';

  const filename = `${mediaId}.${ext}`;
  const filePath = path.join(mediaDir, filename);

  await fs.writeFile(filePath, data);

  // Return relative path from data directory
  return path.relative(DATA_DIR, filePath);
}

export function getMediaPath(phone: string, filename: string): string {
  return path.join(MEDIA_DIR, normalizePhone(phone), filename);
}
