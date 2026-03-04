'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
// Read-only mode: WhatsApp API not configured
import { format } from 'date-fns';
import type { InfluencerMessage } from '@/lib/types';

interface ChatTabProps {
  slug: string;
  telefoon: string | null;
}

export function ChatTab({ slug, telefoon }: ChatTabProps) {
  const [messages, setMessages] = useState<InfluencerMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/influencers/${slug}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      // silently fail
    }
  }, [slug]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!telefoon) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 p-6">
        <div className="text-center">
          <div className="text-4xl mb-3">&#9993;</div>
          <p className="text-sm">Geen telefoonnummer &mdash; deze influencer communiceert via email</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
        {messages.length === 0 ? (
          <div className="text-center text-slate-500 mt-8">
            <p className="text-sm">Nog geen berichten</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isOutbound = msg.direction === 'outbound';
            return (
              <div
                key={`${msg.timestamp}-${i}`}
                className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-3 py-2 ${
                    isOutbound
                      ? 'bg-[#DCF8C6] rounded-br-none'
                      : 'bg-white rounded-bl-none shadow-sm'
                  }`}
                >
                  {!isOutbound && (
                    <p className="text-xs font-medium text-indigo-600 mb-0.5">
                      {msg.sender}
                    </p>
                  )}
                  <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">
                    {msg.text}
                  </p>
                  <p className="text-xs text-slate-500 text-right mt-1">
                    {format(new Date(msg.timestamp), 'HH:mm')}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Read-only notice */}
      <div className="bg-slate-100 border-t border-slate-200 px-4 py-2.5 text-center">
        <p className="text-xs text-slate-500">Read-only &mdash; WhatsApp API is niet geconfigureerd</p>
      </div>
    </div>
  );
}
