/**
 * WhatsApp Webhook Handler
 *
 * Receives incoming messages and status updates from WhatsApp Cloud API.
 * Must be exposed via ngrok or similar for WhatsApp to reach it.
 *
 * Endpoints:
 *   GET  /api/webhook - Webhook verification (required by WhatsApp)
 *   POST /api/webhook - Receive incoming messages and status updates
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  updateContact,
  appendMessage,
  saveMedia,
} from '@/lib/file-store';
import { whatsappApi } from '@/lib/whatsapp-api';
import type {
  WebhookPayload,
  WebhookMessage,
  WebhookStatus,
  Message,
  MessageType,
} from '@/lib/types';

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

// ============================================================================
// GET: Webhook Verification
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('[Webhook] Verification request:', { mode, token });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  console.log('[Webhook] Verification failed');
  return new NextResponse('Forbidden', { status: 403 });
}

// ============================================================================
// POST: Receive Messages
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Verify signature (optional but recommended for production)
    if (APP_SECRET) {
      const signature = request.headers.get('x-hub-signature-256');
      if (!verifySignature(body, signature)) {
        console.log('[Webhook] Invalid signature');
        return new NextResponse('Invalid signature', { status: 401 });
      }
    }

    const payload: WebhookPayload = JSON.parse(body);

    // Process each entry
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const { contacts, messages, statuses } = change.value;

        // Process incoming messages
        if (messages) {
          for (const msg of messages) {
            await handleIncomingMessage(msg, contacts?.[0]?.profile?.name);
          }
        }

        // Process status updates
        if (statuses) {
          for (const status of statuses) {
            await handleStatusUpdate(status);
          }
        }
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

async function handleIncomingMessage(
  webhookMsg: WebhookMessage,
  profileName?: string
) {
  const phone = `+${webhookMsg.from}`;
  const timestamp = new Date(
    parseInt(webhookMsg.timestamp) * 1000
  ).toISOString();

  console.log(`[Webhook] Incoming ${webhookMsg.type} from ${phone}`);

  // Update contact with profile name
  await updateContact(phone, {
    profile: {
      name: profileName,
      pushName: profileName,
    },
    metadata: {
      lastContact: timestamp,
    },
  });

  // Build message object
  const message: Message = {
    id: webhookMsg.id,
    ts: timestamp,
    dir: 'in',
    type: mapMessageType(webhookMsg.type),
    status: 'delivered',
  };

  // Add type-specific content
  switch (webhookMsg.type) {
    case 'text':
      message.body = webhookMsg.text?.body;
      break;

    case 'image':
    case 'video':
    case 'audio':
    case 'document':
    case 'sticker':
      const mediaData = webhookMsg[webhookMsg.type as keyof WebhookMessage] as {
        id: string;
        mime_type: string;
        caption?: string;
        filename?: string;
      };
      if (mediaData) {
        message.mediaId = mediaData.id;
        message.mimeType = mediaData.mime_type;
        message.caption = mediaData.caption;
        message.filename = mediaData.filename;

        // Download and save media
        try {
          const mediaInfo = await whatsappApi.getMediaUrl(mediaData.id);
          if (mediaInfo) {
            const buffer = await whatsappApi.downloadMedia(mediaInfo.url);
            if (buffer) {
              const localPath = await saveMedia(
                phone,
                mediaData.id,
                buffer,
                mediaData.mime_type
              );
              message.mediaPath = localPath;
            }
          }
        } catch (err) {
          console.error('[Webhook] Failed to download media:', err);
        }
      }
      break;

    case 'location':
      if (webhookMsg.location) {
        message.location = {
          latitude: webhookMsg.location.latitude,
          longitude: webhookMsg.location.longitude,
          name: webhookMsg.location.name,
          address: webhookMsg.location.address,
        };
      }
      break;

    case 'reaction':
      if (webhookMsg.reaction) {
        message.reaction = {
          emoji: webhookMsg.reaction.emoji,
          messageId: webhookMsg.reaction.message_id,
        };
      }
      break;
  }

  // Add reply context if present
  if (webhookMsg.context) {
    message.context = {
      messageId: webhookMsg.context.id,
    };
  }

  // Save to file system
  await appendMessage(phone, message);

  // Mark as read (optional - can be disabled)
  await whatsappApi.markAsRead(webhookMsg.id);

  console.log(`[Webhook] Message saved: ${message.id}`);
}

async function handleStatusUpdate(status: WebhookStatus) {
  const phone = `+${status.recipient_id}`;
  console.log(`[Webhook] Status update for ${phone}: ${status.status}`);

  // TODO: Update message status in chat history
  // This would require finding the message by ID and updating its status
  // For now, we just log it
}

// ============================================================================
// Helpers
// ============================================================================

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature || !APP_SECRET) return false;

  const expectedSignature = crypto
    .createHmac('sha256', APP_SECRET)
    .update(body)
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}

function mapMessageType(type: string): MessageType {
  const typeMap: Record<string, MessageType> = {
    text: 'text',
    image: 'image',
    video: 'video',
    audio: 'audio',
    document: 'document',
    sticker: 'sticker',
    location: 'location',
    contacts: 'contacts',
    interactive: 'interactive',
    button: 'button',
    reaction: 'reaction',
  };
  return typeMap[type] || 'unknown';
}
