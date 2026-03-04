/**
 * WhatsApp Sync — Persistent Listener
 *
 * Connects to WhatsApp via Baileys and stays connected.
 * Processes messages as they arrive in real-time.
 *
 * Storage: local filesystem or GCS (set GCS_BUCKET env var).
 * Cloud Run: exposes health check on PORT (default 8080).
 *
 * Usage: npm run sync
 */

import 'dotenv/config';
import http from 'http';
import { startWhatsApp } from './client';
import { processIncomingMessages, processHistorySync } from './sync-messages';
import { writeStatus } from './status';
import { getStorageMode } from './storage';
import { startEmailSync } from './email-sync';
import { startTikTokSync } from './tiktok-sync';

async function main() {
  console.log('🚀 WhatsApp Sync gestart\n');
  console.log(`   Storage: ${getStorageMode()}`);
  console.log('   Ctrl+C om te stoppen.\n');

  // Health check server for Cloud Run
  const port = parseInt(process.env.PORT || '8080');
  let connected = false;

  const server = http.createServer((_req, res) => {
    res.writeHead(connected ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: connected ? 'connected' : 'connecting' }));
  });
  server.listen(port, () => {
    console.log(`   Health check: http://localhost:${port}\n`);
  });

  // Connect and listen
  console.log('🔗 Verbinden met WhatsApp...');

  startWhatsApp({
    onConnected: (sock) => {
      connected = true;
      processHistorySync(sock);
      processIncomingMessages(sock);
      console.log('👂 Luisteren naar berichten...\n');
    },
  });

  // Email sync — onafhankelijk van WhatsApp
  startEmailSync();
  const emailInterval = setInterval(startEmailSync, 5 * 60 * 1000);

  // TikTok sync — dagelijks collab videos ophalen
  startTikTokSync();
  const tiktokInterval = setInterval(startTikTokSync, 24 * 60 * 60 * 1000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n👋 Afsluiten...');
    connected = false;
    clearInterval(emailInterval);
    clearInterval(tiktokInterval);
    await writeStatus({ status: 'idle' });
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(async (err) => {
  console.error('💥 Sync mislukt:', err);
  await writeStatus({ status: 'error', error: String(err) });
  process.exit(1);
});
