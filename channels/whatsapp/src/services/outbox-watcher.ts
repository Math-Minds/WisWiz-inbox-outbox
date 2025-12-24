/**
 * Outbox Watcher Service
 *
 * Watches the outbox/pending folder for new messages and sends them via WhatsApp.
 * Run this as a background process alongside the Next.js app.
 *
 * Usage: npx tsx src/services/outbox-watcher.ts
 */

import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { whatsappApi } from '../lib/whatsapp-api';
import {
  getPendingMessages,
  markMessageSent,
  appendMessage,
} from '../lib/file-store';
import type { OutboxMessage, Message } from '../lib/types';

const OUTBOX_DIR = path.join(process.cwd(), 'data', 'outbox', 'pending');
const POLL_INTERVAL = 5000; // 5 seconds

async function processOutbox() {
  const pending = await getPendingMessages();

  for (const { filename, message } of pending) {
    console.log(`[Outbox] Processing: ${filename}`);

    try {
      let result;

      // Send based on message type
      if (message.type === 'text' && message.body) {
        result = await whatsappApi.sendText({
          to: message.to,
          body: message.body,
          replyTo: message.replyTo,
        });
      } else if (message.type === 'template' && message.template) {
        result = await whatsappApi.sendTemplate({
          to: message.to,
          templateName: message.template.name,
          language: message.template.language,
          components: message.template.components,
        });
      } else if (message.type === 'image' && message.mediaUrl) {
        result = await whatsappApi.sendMedia({
          to: message.to,
          type: 'image',
          mediaUrl: message.mediaUrl,
          caption: message.caption,
        });
      } else if (message.type === 'document' && message.mediaUrl) {
        result = await whatsappApi.sendMedia({
          to: message.to,
          type: 'document',
          mediaUrl: message.mediaUrl,
          caption: message.caption,
          filename: message.filename,
        });
      } else {
        console.error(`[Outbox] Unsupported message type: ${message.type}`);
        continue;
      }

      if (result?.success && result.messageId) {
        console.log(`[Outbox] Sent successfully: ${result.messageId}`);

        // Mark as sent
        await markMessageSent(filename, result.messageId);

        // Add to chat history
        const chatMessage: Message = {
          id: result.messageId,
          ts: new Date().toISOString(),
          dir: 'out',
          type: message.type === 'template' ? 'template' : message.type,
          status: 'sent',
          body: message.body,
          caption: message.caption,
          createdBy: message.createdBy,
        };

        if (message.replyTo) {
          chatMessage.context = { messageId: message.replyTo };
        }

        await appendMessage(message.to, chatMessage);
      } else {
        console.error(`[Outbox] Failed to send: ${result?.error}`);
      }
    } catch (error) {
      console.error(`[Outbox] Error processing ${filename}:`, error);
    }
  }
}

async function main() {
  console.log('[Outbox Watcher] Starting...');

  // Ensure outbox directory exists
  await fs.mkdir(OUTBOX_DIR, { recursive: true });

  // Check if API is configured
  if (!whatsappApi.isConfigured()) {
    console.warn(
      '[Outbox Watcher] WhatsApp API not configured. Messages will be queued but not sent.'
    );
    console.warn(
      'Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in .env'
    );
  }

  // Process existing messages on startup
  await processOutbox();

  // Watch for new files
  const watcher = chokidar.watch(OUTBOX_DIR, {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('add', async (filePath) => {
    if (filePath.endsWith('.json')) {
      console.log(`[Outbox Watcher] New message detected: ${path.basename(filePath)}`);
      // Small delay to ensure file is fully written
      await new Promise((resolve) => setTimeout(resolve, 100));
      await processOutbox();
    }
  });

  // Also poll periodically as a backup
  setInterval(processOutbox, POLL_INTERVAL);

  console.log(`[Outbox Watcher] Watching ${OUTBOX_DIR}`);
  console.log('[Outbox Watcher] Press Ctrl+C to stop');
}

main().catch(console.error);
