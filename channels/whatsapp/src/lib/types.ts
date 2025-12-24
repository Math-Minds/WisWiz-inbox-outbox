import { z } from 'zod';

// ============================================================================
// CONTACT
// ============================================================================

export const ContactSchema = z.object({
  id: z.string(),
  phone: z.string(), // E.164 format: +31612345678
  whatsappId: z.string(), // Without + prefix: 31612345678
  profile: z.object({
    name: z.string().optional(),
    pushName: z.string().optional(), // Name they set in WhatsApp
  }),
  metadata: z.object({
    firstContact: z.string().datetime(),
    lastContact: z.string().datetime(),
    messageCount: z.number().default(0),
    tags: z.array(z.string()).default([]),
    notes: z.string().optional(),
  }),
});

export type Contact = z.infer<typeof ContactSchema>;

// ============================================================================
// MESSAGE
// ============================================================================

export const MessageTypeSchema = z.enum([
  'text',
  'image',
  'video',
  'audio',
  'document',
  'sticker',
  'location',
  'contacts',
  'interactive',
  'button',
  'template',
  'reaction',
  'unknown',
]);

export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessageStatusSchema = z.enum([
  'pending', // In outbox, not yet sent
  'sent', // Sent to WhatsApp
  'delivered', // Delivered to recipient
  'read', // Read by recipient
  'failed', // Failed to send
]);

export type MessageStatus = z.infer<typeof MessageStatusSchema>;

export const MessageSchema = z.object({
  id: z.string(), // WhatsApp message ID (wamid.xxx)
  ts: z.string().datetime(), // Timestamp
  dir: z.enum(['in', 'out']), // Direction: inbound or outbound
  type: MessageTypeSchema,
  status: MessageStatusSchema,

  // Content (depends on type)
  body: z.string().optional(), // For text messages
  caption: z.string().optional(), // For media with caption
  mediaId: z.string().optional(), // WhatsApp media ID
  mediaPath: z.string().optional(), // Local path to downloaded media
  mimeType: z.string().optional(),
  filename: z.string().optional(),

  // Location (for location messages)
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),

  // Reaction
  reaction: z
    .object({
      emoji: z.string(),
      messageId: z.string(), // ID of message being reacted to
    })
    .optional(),

  // Context (for replies)
  context: z
    .object({
      messageId: z.string(), // ID of message being replied to
    })
    .optional(),

  // For outbound: who/what created this message
  createdBy: z.enum(['user', 'claude', 'system']).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// ============================================================================
// THREAD (Conversation metadata)
// ============================================================================

export const ThreadSchema = z.object({
  contactPhone: z.string(),
  lastMessageAt: z.string().datetime(),
  lastMessagePreview: z.string().optional(),
  unreadCount: z.number().default(0),
  isOpen: z.boolean().default(true), // 24-hour window open?
  windowExpiresAt: z.string().datetime().optional(),
});

export type Thread = z.infer<typeof ThreadSchema>;

// ============================================================================
// OUTBOX MESSAGE (for Claude to create)
// ============================================================================

export const OutboxMessageSchema = z.object({
  to: z.string(), // Phone number E.164
  type: z.enum(['text', 'image', 'document', 'template']),

  // For text
  body: z.string().optional(),

  // For media
  mediaUrl: z.string().optional(),
  caption: z.string().optional(),
  filename: z.string().optional(),

  // For templates
  template: z
    .object({
      name: z.string(),
      language: z.string().default('nl'),
      components: z.array(z.any()).optional(),
    })
    .optional(),

  // Metadata
  createdAt: z.string().datetime(),
  createdBy: z.enum(['user', 'claude', 'system']),

  // Reply context
  replyTo: z.string().optional(), // Message ID to reply to
});

export type OutboxMessage = z.infer<typeof OutboxMessageSchema>;

// ============================================================================
// WEBHOOK PAYLOADS (from WhatsApp Cloud API)
// ============================================================================

export interface WebhookPayload {
  object: 'whatsapp_business_account';
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: {
    messaging_product: 'whatsapp';
    metadata: {
      display_phone_number: string;
      phone_number_id: string;
    };
    contacts?: WebhookContact[];
    messages?: WebhookMessage[];
    statuses?: WebhookStatus[];
    errors?: WebhookError[];
  };
  field: 'messages';
}

export interface WebhookContact {
  profile: { name: string };
  wa_id: string;
}

export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  video?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string; sha256: string };
  document?: {
    id: string;
    mime_type: string;
    sha256: string;
    filename: string;
    caption?: string;
  };
  sticker?: { id: string; mime_type: string; sha256: string };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  reaction?: { emoji: string; message_id: string };
  context?: { from: string; id: string };
}

export interface WebhookStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: { code: number; title: string }[];
}

export interface WebhookError {
  code: number;
  title: string;
  message: string;
  error_data?: { details: string };
}
