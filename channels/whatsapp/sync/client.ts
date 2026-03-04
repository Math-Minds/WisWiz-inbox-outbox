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
const GCS_AUTH_PREFIX = 'whatsapp-auth';

// In cloud mode, use /tmp (writable in Cloud Run). Locally, use the sync dir.
const AUTH_DIR = GCS_BUCKET
  ? '/tmp/baileys_auth'
  : path.join(__dir, '.baileys_auth');

const logger = P({ level: 'warn' });

/* ── GCS Auth Sync ── */

async function downloadAuthFromGcs(): Promise<void> {
  if (!GCS_BUCKET) return;

  console.log('📥 Auth state downloaden van GCS...');
  const storage = new Storage();
  const [files] = await storage.bucket(GCS_BUCKET).getFiles({ prefix: `${GCS_AUTH_PREFIX}/` });

  await fs.mkdir(AUTH_DIR, { recursive: true });
  let count = 0;

  for (const file of files) {
    const relativePath = file.name.slice(`${GCS_AUTH_PREFIX}/`.length);
    if (!relativePath) continue;
    const localPath = path.join(AUTH_DIR, relativePath);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await file.download({ destination: localPath });
    count++;
  }

  console.log(`   ${count} auth bestanden gedownload.`);
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

async function uploadAuthToGcs(): Promise<void> {
  if (!GCS_BUCKET) return;

  // Debounce: wait 2 seconds before uploading to batch rapid changes
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const storage = new Storage();
      const bucket = storage.bucket(GCS_BUCKET);
      const entries = await fs.readdir(AUTH_DIR);

      for (const entry of entries) {
        const localPath = path.join(AUTH_DIR, entry);
        const stat = await fs.stat(localPath);
        if (stat.isFile()) {
          await bucket.upload(localPath, { destination: `${GCS_AUTH_PREFIX}/${entry}` });
        }
      }
    } catch (err) {
      console.error('⚠️  Auth sync naar GCS mislukt:', err);
    }
  }, 2000);
}

/* ── Connection Management ── */

export interface WhatsAppHandlers {
  onConnected: (sock: WASocket) => void;
}

/**
 * Start a persistent WhatsApp connection that auto-reconnects.
 * Calls handlers.onConnected(sock) on each successful connection,
 * so message listeners can be (re)registered on the current socket.
 */
export async function startWhatsApp(handlers: WhatsAppHandlers): Promise<void> {
  await writeStatus({ status: 'connecting' });
  await downloadAuthFromGcs();

  let retries = 0;
  const MAX_RETRIES = 10;

  async function connect() {
    const { state, saveCreds: originalSaveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const saveCreds = async () => {
      await originalSaveCreds();
      uploadAuthToGcs(); // fire-and-forget, debounced
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
        console.log('\n📱 QR code ontvangen!');
        console.log('   → Open WhatsApp Business App');
        console.log('   → Gekoppelde apparaten → Apparaat koppelen');
        console.log('   → Scan de QR code op localhost:3001/sync\n');
        await writeStatus({ status: 'qr', qrDataUrl: dataUrl });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const reason = (lastDisconnect?.error as Boom)?.message || 'unknown';

        if (statusCode === DisconnectReason.loggedOut) {
          console.error('❌ Uitgelogd. Verwijder auth data en scan opnieuw.');
          await writeStatus({ status: 'error', error: 'Uitgelogd. Herstart nodig.' });
          process.exit(1);
        } else if (reason.includes('QR refs')) {
          console.error('❌ QR code verlopen.');
          await writeStatus({ status: 'error', error: 'QR code verlopen.' });
          process.exit(1);
        } else {
          retries++;
          if (retries <= MAX_RETRIES) {
            const delay = Math.min(2000 * retries, 30000); // exponential backoff, max 30s
            console.log(`🔄 Herverbinden in ${delay / 1000}s... (poging ${retries}/${MAX_RETRIES})`);
            await writeStatus({ status: 'connecting' });
            setTimeout(connect, delay);
          } else {
            console.error('❌ Maximaal aantal pogingen bereikt. Herstart container.');
            await writeStatus({ status: 'error', error: 'Verbinding mislukt na meerdere pogingen.' });
            process.exit(1);
          }
        }
      }

      if (connection === 'open') {
        retries = 0; // Reset on successful connection
        console.log('✅ WhatsApp verbonden');
        await writeStatus({ status: 'ready' });
        handlers.onConnected(sock);
      }
    });
  }

  connect();
}

async function getMessage(_key: WAMessageKey): Promise<WAMessageContent | undefined> {
  return proto.Message.create({});
}
