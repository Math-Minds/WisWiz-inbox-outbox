/**
 * Email Sync — Imports emails from Gmail into influencer markdown files.
 *
 * Runs every 5 minutes alongside the WhatsApp sync worker.
 * Queries Gmail API for messages matching known influencer emails,
 * transforms them into the same markdown format as manually created threads.
 *
 * Storage: {slug}/email/{subject_slug}.md (same format as existing files)
 */

import { getGmailClient } from './email-auth';
import { readJson, readText, writeText, readRootJson, writeRootJson, exists } from './storage';
import type { gmail_v1 } from 'googleapis';

const OUR_ACCOUNTS = ['louisgeradtsvetter@gmail.com', 'philippinckaers@gmail.com'];
const ACCOUNT_NAMES = ['louisgeradtsvetter', 'philippinckaers'];

interface IndexData {
  by_identifier?: Record<string, string>;
  by_email?: Record<string, string>;
}

function allKnownEmails(index: IndexData): string[] {
  // Support both formats: by_identifier (email:x → slug) and by_email (x → slug)
  if (index.by_identifier) {
    return Object.keys(index.by_identifier)
      .filter((k) => k.startsWith('email:'))
      .map((k) => k.slice(6));
  }
  if (index.by_email) {
    return Object.keys(index.by_email);
  }
  return [];
}

function lookupEmail(index: IndexData, email: string): string | undefined {
  if (index.by_identifier) {
    return index.by_identifier[`email:${email.toLowerCase()}`];
  }
  if (index.by_email) {
    return index.by_email[email.toLowerCase()];
  }
  return undefined;
}

interface SyncState {
  lastSyncEpoch: Record<string, number>; // per account
}

interface ParsedMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: Date;
  body: string;
  isFromUs: boolean;
}

const STATE_KEY = 'email-sync-state.json';

async function loadEmailSyncState(): Promise<SyncState> {
  try {
    return await readRootJson<SyncState>(STATE_KEY);
  } catch {
    return { lastSyncEpoch: {} };
  }
}

async function saveEmailSyncState(state: SyncState): Promise<void> {
  await writeRootJson(STATE_KEY, state);
}

function subjectToSlug(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'untitled';
}

function stripQuotedText(body: string): string {
  // Match common quoted reply patterns:
  // "On {date}, {name} wrote:" or "Op {date} schreef {name}"
  const patterns = [
    /\r?\n\s*On .+wrote:\s*$/s,
    /\r?\n\s*Op .+schreef .+$/s,
    /\r?\n\s*>.*$/s, // Lines starting with >
    /\r?\n\s*-{3,}\s*Original [Mm]essage\s*-{3,}.*$/s,
    /\r?\n\s*-{3,}\s*Oorspronkelijk bericht\s*-{3,}.*$/s,
  ];

  let result = body;
  for (const pattern of patterns) {
    const match = result.match(pattern);
    if (match && match.index !== undefined) {
      result = result.slice(0, match.index);
    }
  }

  return result.trimEnd();
}

function parseEmailAddress(raw: string): string {
  // "Name <email@example.com>" → "email@example.com"
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).toLowerCase().trim();
}

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

function htmlToText(html: string): string {
  // Remove quoted reply blocks first (blockquote, gmail_quote divs)
  let text = html.replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '');
  text = text.replace(/<div[^>]*class="gmail_quote[^"]*"[^>]*>[\s\S]*$/gi, '');

  // Convert <br> and block elements to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(?:div|p|tr|li)>/gi, '\n');
  text = text.replace(/<(?:hr)\s*\/?>/gi, '\n---\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function decodeBody(part: gmail_v1.Schema$MessagePart | undefined): { text: string; isHtml: boolean } {
  if (!part) return { text: '', isHtml: false };

  // If multipart, find text/plain first
  if (part.parts) {
    const textPart = part.parts.find((p) => p.mimeType === 'text/plain');
    if (textPart) return decodeBody(textPart);

    // Fall back to text/html
    const htmlPart = part.parts.find((p) => p.mimeType === 'text/html');
    if (htmlPart) return decodeBody(htmlPart);

    // Try multipart children recursively
    for (const child of part.parts) {
      const result = decodeBody(child);
      if (result.text) return result;
    }
  }

  // If this part has a body with data, decode it
  if (part.body?.data) {
    const raw = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    const isHtml = part.mimeType === 'text/html';
    return { text: raw, isHtml };
  }

  return { text: '', isHtml: false };
}

async function fetchMessages(
  gmail: gmail_v1.Gmail,
  accountEmail: string,
  afterEpoch: number,
  knownEmails: string[]
): Promise<ParsedMessage[]> {
  // Build query: messages after last sync, involving known influencer emails
  const emailQueries = knownEmails.map((e) => `from:${e} OR to:${e}`).join(' OR ');
  const timeFilter = afterEpoch > 0 ? `after:${Math.floor(afterEpoch)}` : 'newer_than:2y';
  const query = `${timeFilter} (${emailQueries})`;

  const messages: ParsedMessage[] = [];
  let pageToken: string | undefined;

  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
      pageToken,
    });

    const messageIds = listRes.data.messages || [];

    for (const ref of messageIds) {
      if (!ref.id) continue;

      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: ref.id,
          format: 'full',
        });

        const headers = msg.data.payload?.headers;
        const from = parseEmailAddress(getHeader(headers, 'From'));
        const to = parseEmailAddress(getHeader(headers, 'To'));
        const subject = getHeader(headers, 'Subject') || '(geen onderwerp)';
        const dateStr = getHeader(headers, 'Date');
        const date = dateStr ? new Date(dateStr) : new Date();

        const { text: rawBody, isHtml } = decodeBody(msg.data.payload);
        const textBody = isHtml ? htmlToText(rawBody) : rawBody;
        const cleanBody = stripQuotedText(textBody);

        if (!cleanBody.trim()) continue;

        messages.push({
          id: ref.id,
          threadId: msg.data.threadId || ref.id,
          from,
          to,
          subject,
          date,
          body: cleanBody,
          isFromUs: OUR_ACCOUNTS.includes(from),
        });
      } catch (err) {
        console.error(`  ⚠️  Fout bij ophalen bericht ${ref.id}:`, err);
      }
    }

    pageToken = listRes.data.nextPageToken || undefined;
  } while (pageToken);

  return messages;
}

function buildMarkdownEntry(msg: ParsedMessage): string {
  const tag = msg.isFromUs ? '[YOU]' : '[THEM]';
  const sender = msg.isFromUs ? msg.from : msg.from;
  const dateStr = formatDate(msg.date);
  return `### ${tag} ${sender} - ${dateStr}\n\n${msg.body}\n\n---\n`;
}

function extractExistingMessageIds(markdown: string): Set<string> {
  // Extract date+sender combos to detect duplicates
  const ids = new Set<string>();
  const regex = /### \[(YOU|THEM)\] (.+?) - (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    ids.add(`${match[2]}|${match[3]}`);
  }
  return ids;
}

async function syncAccount(
  accountName: string,
  accountEmail: string,
  index: IndexData,
  state: SyncState
): Promise<number> {
  const lastEpoch = state.lastSyncEpoch[accountName] || 0;

  let gmail: gmail_v1.Gmail;
  try {
    gmail = await getGmailClient(accountName);
  } catch (err) {
    console.error(`  ⚠️  Gmail client voor ${accountName} niet beschikbaar:`, err);
    return 0;
  }

  const knownEmails = allKnownEmails(index);
  if (knownEmails.length === 0) {
    return 0;
  }

  const messages = await fetchMessages(gmail, accountEmail, lastEpoch, knownEmails);
  if (messages.length === 0) return 0;

  // Group by thread
  const byThread = new Map<string, ParsedMessage[]>();
  for (const msg of messages) {
    if (!byThread.has(msg.threadId)) byThread.set(msg.threadId, []);
    byThread.get(msg.threadId)!.push(msg);
  }

  let totalAdded = 0;

  for (const [, threadMsgs] of byThread) {
    // Sort by date
    threadMsgs.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Find influencer email in this thread
    let influencerEmail: string | null = null;
    for (const msg of threadMsgs) {
      const otherEmail = msg.isFromUs ? msg.to : msg.from;
      if (lookupEmail(index, otherEmail)) {
        influencerEmail = otherEmail;
        break;
      }
    }
    if (!influencerEmail) continue;

    const slug = lookupEmail(index, influencerEmail)!;
    const subjectSlug = subjectToSlug(threadMsgs[0].subject);
    const filePath = `${slug}/email/${subjectSlug}.md`;

    // Load existing file or create new one
    let existingContent = '';
    let existingIds = new Set<string>();
    if (await exists(filePath)) {
      existingContent = await readText(filePath);
      existingIds = extractExistingMessageIds(existingContent);
    }

    // Filter out duplicates
    const newMsgs = threadMsgs.filter((msg) => {
      const msgId = `${msg.from}|${formatDate(msg.date)}`;
      return !existingIds.has(msgId);
    });

    if (newMsgs.length === 0) continue;

    // Build content
    let content: string;
    if (existingContent) {
      // Append new messages before the end
      const newEntries = newMsgs.map(buildMarkdownEntry).join('\n');
      content = existingContent.trimEnd() + '\n\n' + newEntries;
    } else {
      // Create new file with header
      const cleanSubject = threadMsgs[0].subject.replace(/^(re|fwd|fw):\s*/gi, '').trim();
      const participants = `${accountEmail}, ${influencerEmail}`;
      const header = `# Thread: ${cleanSubject}\n\n**Participants:** ${participants}\n\n## Conversation History\n\n`;
      const entries = newMsgs.map(buildMarkdownEntry).join('\n');
      content = header + entries;
    }

    await writeText(filePath, content);
    totalAdded += newMsgs.length;
    console.log(`  📧 ${slug}/email/${subjectSlug}.md: +${newMsgs.length} berichten`);
  }

  // Update sync state to now
  const maxEpoch = Math.max(
    lastEpoch,
    ...messages.map((m) => Math.floor(m.date.getTime() / 1000))
  );
  state.lastSyncEpoch[accountName] = maxEpoch;

  return totalAdded;
}

export async function startEmailSync(): Promise<void> {
  console.log('📧 Email sync gestart...');

  let index: IndexData;
  try {
    index = await readJson<IndexData>('_index.json');
  } catch {
    console.error('❌ _index.json niet gevonden, email sync overgeslagen');
    return;
  }

  if (allKnownEmails(index).length === 0) {
    console.log('  📧 Geen emails in _index.json, overgeslagen');
    return;
  }

  const state = await loadEmailSyncState();
  let totalAdded = 0;

  for (let i = 0; i < ACCOUNT_NAMES.length; i++) {
    try {
      const added = await syncAccount(ACCOUNT_NAMES[i], OUR_ACCOUNTS[i], index, state);
      totalAdded += added;
    } catch (err) {
      console.error(`  ⚠️  Email sync fout voor ${ACCOUNT_NAMES[i]}:`, err);
    }
  }

  await saveEmailSyncState(state);

  if (totalAdded > 0) {
    console.log(`📧 Email sync: ${totalAdded} berichten bijgewerkt`);
  } else {
    console.log('📧 Email sync: 0 nieuwe emails');
  }
}
