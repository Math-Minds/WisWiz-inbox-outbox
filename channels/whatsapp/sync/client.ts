/**
 * WhatsApp Client — Manages connection via Baileys (WebSocket-based).
 *
 * Uses useMultiFileAuthState for persistent sessions. First run shows a QR code
 * that you scan in WhatsApp Business App → Linked Devices.
 *
 * In cloud mode (GCS_BUCKET set), auth state is persisted to GCS so it
 * survives container restarts.
 *
 * startWhatsApp() manages the full connection lifecycle including reconnects.
 * On each (re)connect, message handlers are re-registered on the new socket.
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  proto,
  type WAMessageKey,
  type WAMessageContent,
  type WASocket,
  Browsers,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import P from 'pino';
import { Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import { writeStatus } from './status';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dir = path.dirname(__filename);

const GCS_BUCKET = process.env.GCS_BUCKET || '';

function getAuthConfig(accountName?: string) {
  const suffix = accountName ? `-${accountName}` : '';
  return {
    gcsPrefix: `whatsapp-auth${suffix}`,
    localDir: GCS_BUCKET
      ? `/tmp/baileys_auth${suffix}`
      : path.join(__dir, `.baileys_auth${suffix}`),
  };
}

const logger = P({ level: 'warn' });

/* ── GCS Auth Sync ── */

async function downloadAuthFromGcs(authDir: string, gcsPrefix: string): Promise<void> {
  if (!GCS_BUCKET) return;

  console.log(`📥 Auth state downloaden van GCS (${gcsPrefix})...`);
  const storage = new Storage();
  const [files] = await storage.bucket(GCS_BUCKET).getFiles({ prefix: `${gcsPrefix}/` });

  await fs.mkdir(authDir, { recursive: true });
  let count = 0;

  for (const file of files) {
    const relativePath = file.name.slice(`${gcsPrefix}/`.length);
    if (!relativePath) continue;
    const localPath = path.join(authDir, relativePath);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await file.download({ destination: localPath });
    count++;
  }

  console.log(`   ${count} auth bestanden gedownload.`);
}

const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

function uploadAuthToGcs(authDir: string, gcsPrefix: string): void {
  if (!GCS_BUCKET) return;

  const existing = syncTimers.get(gcsPrefix);
  if (existing) clearTimeout(existing);

  syncTimers.set(gcsPrefix, setTimeout(async () => {
    try {
      const storage = new Storage();
      const bucket = storage.bucket(GCS_BUCKET);
      const entries = await fs.readdir(authDir);

      for (const entry of entries) {
        const localPath = path.join(authDir, entry);
        const stat = await fs.stat(localPath);
        if (stat.isFile()) {
          await bucket.upload(localPath, { destination: `${gcsPrefix}/${entry}` });
        }
      }
    } catch (err) {
      console.error('⚠️  Auth sync naar GCS mislukt:', err);
    }
  }, 2000));
}

/* ── Connection Management ── */

export interface WhatsAppHandlers {
  onConnected: (sock: WASocket) => void;
}

export interface WhatsAppOptions {
  /** Account name for separate auth state (e.g., 'philip'). Omit for default (WisWiz). */
  accountName?: string;
  /** Label for logging */
  label?: string;
  /** Whether to write sync status (only for primary account) */
  writeStatus?: boolean;
}

/**
 * Start a persistent WhatsApp connection that auto-reconnects.
 * Calls handlers.onConnected(sock) on each successful connection,
 * so message listeners can be (re)registered on the current socket.
 */
export async function startWhatsApp(handlers: WhatsAppHandlers, options?: WhatsAppOptions): Promise<void> {
  const { accountName, label = 'WhatsApp', writeStatus: shouldWriteStatus = true } = options || {};
  const { gcsPrefix, localDir: authDir } = getAuthConfig(accountName);

  if (shouldWriteStatus) await writeStatus({ status: 'connecting' });
  await downloadAuthFromGcs(authDir, gcsPrefix);

  let retries = 0;
  const MAX_RETRIES = 10;

  async function connect() {
    const { state, saveCreds: originalSaveCreds } = await useMultiFileAuthState(authDir);

    const saveCreds = async () => {
      await originalSaveCreds();
      uploadAuthToGcs(authDir, gcsPrefix); // fire-and-forget, debounced
    };

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      qrTimeout: 120_000,
      syncFullHistory: true,
      browser: Browsers.macOS('Desktop'),
      markOnlineOnConnect: false,
      getMessage,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const dataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
        console.log(`\n📱 [${label}] QR code ontvangen!`);
        console.log('   → Open WhatsApp → Gekoppelde apparaten → Apparaat koppelen');
        console.log('   → Scan de QR code op localhost:3001/sync\n');
        if (shouldWriteStatus) await writeStatus({ status: 'qr', qrDataUrl: dataUrl });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const reason = (lastDisconnect?.error as Boom)?.message || 'unknown';

        if (statusCode === DisconnectReason.loggedOut) {
          console.error(`❌ [${label}] Uitgelogd. Verwijder auth data en scan opnieuw.`);
          if (shouldWriteStatus) await writeStatus({ status: 'error', error: `${label}: Uitgelogd.` });
          // Only exit for primary account
          if (!accountName) process.exit(1);
        } else if (reason.includes('QR refs')) {
          console.error(`❌ [${label}] QR code verlopen.`);
          if (shouldWriteStatus) await writeStatus({ status: 'error', error: `${label}: QR verlopen.` });
          if (!accountName) process.exit(1);
        } else {
          retries++;
          if (retries <= MAX_RETRIES) {
            const delay = Math.min(2000 * retries, 30000);
            console.log(`🔄 [${label}] Herverbinden in ${delay / 1000}s... (poging ${retries}/${MAX_RETRIES})`);
            if (shouldWriteStatus) await writeStatus({ status: 'connecting' });
            setTimeout(connect, delay);
          } else {
            console.error(`❌ [${label}] Maximaal aantal pogingen bereikt.`);
            if (shouldWriteStatus) await writeStatus({ status: 'error', error: `${label}: Verbinding mislukt.` });
            if (!accountName) process.exit(1);
          }
        }
      }

      if (connection === 'open') {
        retries = 0;
        console.log(`✅ [${label}] WhatsApp verbonden`);
        if (shouldWriteStatus) await writeStatus({ status: 'ready' });
        handlers.onConnected(sock);
      }
    });
  }

  connect();
}

async function getMessage(_key: WAMessageKey): Promise<WAMessageContent | undefined> {
  return proto.Message.create({});
}
