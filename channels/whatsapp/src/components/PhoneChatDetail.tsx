'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import type { Message } from '@/lib/types';

interface PhoneChatDetailProps {
  phone: string;
  name: string;
}

export function PhoneChatDetail({ phone, name }: PhoneChatDetailProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(phone)}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    setLoading(true);
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-500 flex items-center justify-center text-white font-medium text-sm">
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{name}</h2>
            <p className="text-sm text-slate-500">{phone}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
        {loading ? (
          <div className="text-center text-slate-500 mt-8">
            <p className="text-sm">Laden...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-500 mt-8">
            <p className="text-sm">Geen berichten</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isOutbound = msg.dir === 'out';
            return (
              <div
                key={`${msg.ts}-${i}`}
                className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-3 py-2 ${
                    isOutbound
                      ? 'bg-[#DCF8C6] rounded-br-none'
                      : 'bg-white rounded-bl-none shadow-sm'
                  }`}
                >
                  <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">
                    {msg.body || `[${msg.type}]`}
                  </p>
                  <p className="text-xs text-slate-500 text-right mt-1">
                    {format(new Date(msg.ts), 'dd MMM HH:mm')}
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
        <p className="text-xs text-slate-500">Read-only &mdash; niet gekoppeld aan een influencer</p>
      </div>
    </div>
  );
}
