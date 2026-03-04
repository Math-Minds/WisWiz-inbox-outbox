'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { EmailThread } from '@/lib/types';

interface EmailTabProps {
  slug: string;
}

interface ParsedEmail {
  sender: string;
  date: string;
  body: string;
  isFromUs: boolean;
}

function parseThreadMessages(content: string): ParsedEmail[] {
  const messages: ParsedEmail[] = [];
  const regex = /### \[(YOU|THEM)\] (.+?) - (\d{4}-\d{2}-\d{2} \d{2}:\d{2})\n\n([\s\S]*?)(?=\n---|\n### \[|$)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const isFromUs = match[1] === 'YOU';
    const sender = match[2];
    const date = match[3];
    let body = match[4].trim();

    // Remove trailing "On ... wrote:" lines (quoted text references)
    body = body.replace(/\n\s*On .+?wrote:\s*$/s, '').trim();
    body = body.replace(/\n\s*Op .+?schreef .+?$/s, '').trim();

    if (body) {
      messages.push({ sender, date, body, isFromUs });
    }
  }

  return messages;
}

function formatDate(dateStr: string): string {
  const [datePart, timePart] = dateStr.split(' ');
  const [y, m, d] = datePart.split('-');
  return `${d}-${m}-${y} ${timePart}`;
}

function getLastMessageDate(content: string): Date {
  const dates = [...content.matchAll(/### \[(?:YOU|THEM)\] .+? - (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/g)];
  if (dates.length === 0) return new Date(0);
  const last = dates[dates.length - 1][1];
  return new Date(last.replace(' ', 'T'));
}

export function EmailTab({ slug }: EmailTabProps) {
  const [emails, setEmails] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch(`/api/influencers/${slug}/emails`);
      if (res.ok) {
        const data: EmailThread[] = await res.json();
        // Sort threads by last message date (newest first)
        data.sort((a, b) => getLastMessageDate(b.content).getTime() - getLastMessageDate(a.content).getTime());
        setEmails(data);
        if (data.length > 0 && !selectedThread) {
          setSelectedThread(data[0].filename);
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [slug, selectedThread]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThread]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <p className="text-sm">Emails laden...</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <p className="text-sm">Geen email threads gevonden</p>
      </div>
    );
  }

  const activeThread = emails.find((t) => t.filename === selectedThread);
  const messages = activeThread ? parseThreadMessages(activeThread.content) : [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Thread list sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-white">
        {emails.map((thread) => {
          const isActive = thread.filename === selectedThread;
          const parsed = parseThreadMessages(thread.content);
          const lastMsg = parsed[parsed.length - 1];
          const lastDate = lastMsg ? formatDate(lastMsg.date) : '';

          return (
            <button
              key={thread.filename}
              onClick={() => setSelectedThread(thread.filename)}
              className={`w-full text-left px-3 py-3 border-b border-slate-100 transition-colors ${
                isActive ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : 'hover:bg-slate-50'
              }`}
            >
              <p className={`text-sm font-medium truncate ${isActive ? 'text-indigo-700' : 'text-slate-900'}`}>
                {thread.subject}
              </p>
              {lastMsg && (
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {lastMsg.isFromUs ? 'Jij' : lastMsg.sender.split('@')[0]}: {lastMsg.body.slice(0, 50)}...
                </p>
              )}
              <p className="text-[10px] text-slate-400 mt-0.5">{lastDate}</p>
            </button>
          );
        })}
      </div>

      {/* Message view */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Thread header */}
        {activeThread && (
          <div className="px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
            <p className="text-sm font-semibold text-slate-900">{activeThread.subject}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeThread.participants.join(', ')}
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4 space-y-3">
          {messages.map((msg, i) => {
            // Show date separator when date changes
            const prevDate = i > 0 ? messages[i - 1].date.split(' ')[0] : null;
            const curDate = msg.date.split(' ')[0];
            const showDateSep = curDate !== prevDate;

            return (
              <div key={i}>
                {showDateSep && (
                  <div className="flex justify-center my-3">
                    <span className="px-3 py-1 bg-white rounded-full text-[11px] text-slate-500 shadow-sm">
                      {formatDate(curDate + ' 00:00').split(' ')[0]}
                    </span>
                  </div>
                )}
                <div className={`flex ${msg.isFromUs ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 ${
                      msg.isFromUs
                        ? 'bg-[#DCF8C6] rounded-br-none'
                        : 'bg-white rounded-bl-none shadow-sm'
                    }`}
                  >
                    {!msg.isFromUs && (
                      <p className="text-xs font-medium text-indigo-600 mb-0.5">
                        {msg.sender}
                      </p>
                    )}
                    <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">
                      {msg.body}
                    </p>
                    <p className="text-[10px] text-slate-500 text-right mt-1">
                      {msg.date.split(' ')[1]}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}
