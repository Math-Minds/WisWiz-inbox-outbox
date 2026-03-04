/**
 * Send Message API
 *
 * POST /api/send - Send a message via WhatsApp
 *
 * This endpoint can be used by:
 * - The GUI to send messages
 * - Claude via CLI tools
 * - External integrations
 */

import { NextRequest, NextResponse } from 'next/server';
import { whatsappApi } from '@/lib/whatsapp-api';
import { appendMessage, createOutboxMessage } from '@/lib/file-store';
import { getInfluencerByPhone, appendWhatsAppMessage } from '@/lib/influencer-store';
import type { Message, InfluencerMessage } from '@/lib/types';

interface SendRequest {
  to: string;
  body: string;
  replyTo?: string;
  createdBy?: 'user' | 'claude' | 'system';
}

export async function POST(request: NextRequest) {
  try {
    const data: SendRequest = await request.json();

    if (!data.to || !data.body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, body' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const to = data.to.startsWith('+') ? data.to : `+${data.to}`;

    // Check if API is configured
    if (!whatsappApi.isConfigured()) {
      // Store in outbox for later sending
      const filename = await createOutboxMessage({
        to,
        type: 'text',
        body: data.body,
        replyTo: data.replyTo,
        createdBy: data.createdBy || 'user',
      });

      return NextResponse.json({
        success: true,
        queued: true,
        message: 'Message queued in outbox (API not configured)',
        filename,
      });
    }

    // Send via WhatsApp API
    const result = await whatsappApi.sendText({
      to,
      body: data.body,
      replyTo: data.replyTo,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Save to chat history
    const message: Message = {
      id: result.messageId!,
      ts: new Date().toISOString(),
      dir: 'out',
      type: 'text',
      status: 'sent',
      body: data.body,
      createdBy: data.createdBy || 'user',
    };

    if (data.replyTo) {
      message.context = { messageId: data.replyTo };
    }

    await appendMessage(to, message);

    // Sync outbound message to influencer folder
    const influencer = await getInfluencerByPhone(to);
    if (influencer) {
      const influencerMsg: InfluencerMessage = {
        timestamp: message.ts,
        sender: 'WisWiz',
        text: data.body,
        direction: 'outbound',
      };
      await appendWhatsAppMessage(influencer.slug, influencerMsg);
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('[Send] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
