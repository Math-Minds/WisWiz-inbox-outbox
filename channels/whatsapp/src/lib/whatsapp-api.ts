/**
 * WhatsApp Cloud API Client
 *
 * Handles all communication with the WhatsApp Business Cloud API.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

interface SendTextOptions {
  to: string;
  body: string;
  replyTo?: string;
}

interface SendTemplateOptions {
  to: string;
  templateName: string;
  language?: string;
  components?: any[];
}

interface SendMediaOptions {
  to: string;
  type: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  mediaId?: string;
  caption?: string;
  filename?: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface MediaInfo {
  url: string;
  mimeType: string;
  sha256: string;
  fileSize: number;
}

export class WhatsAppAPI {
  private phoneNumberId: string;
  private accessToken: string;
  private apiVersion: string;
  private baseUrl: string;

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;

    if (!this.phoneNumberId || !this.accessToken) {
      console.warn(
        'WhatsApp API credentials not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.'
      );
    }
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message || `API request failed: ${response.status}`
      );
    }

    return data;
  }

  /**
   * Send a text message
   */
  async sendText({ to, body, replyTo }: SendTextOptions): Promise<SendResult> {
    try {
      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace('+', ''), // Remove + prefix
        type: 'text',
        text: { body },
      };

      if (replyTo) {
        payload.context = { message_id: replyTo };
      }

      const response = await this.request(`/${this.phoneNumberId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return {
        success: true,
        messageId: response.messages?.[0]?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send a template message (for initiating conversations outside 24-hour window)
   */
  async sendTemplate({
    to,
    templateName,
    language = 'nl',
    components = [],
  }: SendTemplateOptions): Promise<SendResult> {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace('+', ''),
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
          components,
        },
      };

      const response = await this.request(`/${this.phoneNumberId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return {
        success: true,
        messageId: response.messages?.[0]?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send media (image, video, audio, document)
   */
  async sendMedia({
    to,
    type,
    mediaUrl,
    mediaId,
    caption,
    filename,
  }: SendMediaOptions): Promise<SendResult> {
    try {
      const mediaPayload: any = {};

      if (mediaId) {
        mediaPayload.id = mediaId;
      } else if (mediaUrl) {
        mediaPayload.link = mediaUrl;
      } else {
        throw new Error('Either mediaId or mediaUrl is required');
      }

      if (caption) mediaPayload.caption = caption;
      if (filename && type === 'document') mediaPayload.filename = filename;

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace('+', ''),
        type,
        [type]: mediaPayload,
      };

      const response = await this.request(`/${this.phoneNumberId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return {
        success: true,
        messageId: response.messages?.[0]?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<boolean> {
    try {
      await this.request(`/${this.phoneNumberId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get media URL for downloading
   */
  async getMediaUrl(mediaId: string): Promise<MediaInfo | null> {
    try {
      const response = await this.request(`/${mediaId}`);
      return {
        url: response.url,
        mimeType: response.mime_type,
        sha256: response.sha256,
        fileSize: response.file_size,
      };
    } catch {
      return null;
    }
  }

  /**
   * Download media file
   */
  async downloadMedia(mediaUrl: string): Promise<Buffer | null> {
    try {
      const response = await fetch(mediaUrl, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) return null;

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }

  /**
   * Get business profile
   */
  async getBusinessProfile(): Promise<any> {
    return this.request(
      `/${this.phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`
    );
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return Boolean(this.phoneNumberId && this.accessToken);
  }
}

// Singleton instance
export const whatsappApi = new WhatsAppAPI();
