'use client';

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { Contact, Thread, Message } from '@/lib/types';

interface ChatViewProps {
  contact: Contact | null | undefined;
  thread: Thread | undefined;
  messages: Message[];
  onSendMessage: (body: string) => void;
}

export function ChatView({
  contact,
  thread,
  messages,
  onSendMessage,
}: ChatViewProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  const name =
    contact?.profile.name || contact?.profile.pushName || thread?.contactPhone;

  return (
    <>
      {/* Header */}
      <div className="bg-gray-100 border-b px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-medium">
          {name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-xs text-gray-500">{thread?.contactPhone}</div>
        </div>

        {/* Contact tags */}
        {contact?.metadata.tags && contact.metadata.tags.length > 0 && (
          <div className="ml-auto flex gap-1">
            {contact.metadata.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            Nog geen berichten in deze chat
          </div>
        ) : (
          // Messages are already reversed (newest first), so reverse again for display
          [...messages].reverse().map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="bg-gray-100 p-3 flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Typ een bericht..."
          className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-[#25D366]"
        />
        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="px-4 py-2 bg-[#25D366] text-white rounded-full hover:bg-[#128C7E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Verstuur
        </button>
      </form>
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.dir === 'out';

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 ${
          isOutbound
            ? 'bg-[#DCF8C6] rounded-br-none'
            : 'bg-white rounded-bl-none'
        }`}
      >
        {/* Message content */}
        {message.type === 'text' && (
          <p className="text-gray-900 whitespace-pre-wrap break-words">
            {message.body}
          </p>
        )}

        {message.type === 'image' && (
          <div>
            {message.mediaPath ? (
              <img
                src={`/data/${message.mediaPath}`}
                alt="Image"
                className="max-w-full rounded"
              />
            ) : (
              <div className="text-gray-500 italic">[Afbeelding]</div>
            )}
            {message.caption && (
              <p className="mt-1 text-gray-900">{message.caption}</p>
            )}
          </div>
        )}

        {message.type === 'document' && (
          <div className="flex items-center gap-2">
            <span>📄</span>
            <span className="text-gray-900">
              {message.filename || 'Document'}
            </span>
          </div>
        )}

        {message.type === 'audio' && (
          <div className="flex items-center gap-2">
            <span>🎵</span>
            <span className="text-gray-500 italic">Spraakbericht</span>
          </div>
        )}

        {message.type === 'location' && message.location && (
          <div>
            <span>📍</span>
            <span className="text-gray-900">
              {message.location.name || message.location.address || 'Locatie'}
            </span>
          </div>
        )}

        {message.type === 'reaction' && message.reaction && (
          <span className="text-2xl">{message.reaction.emoji}</span>
        )}

        {/* Timestamp and status */}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-xs text-gray-500">
            {format(new Date(message.ts), 'HH:mm', { locale: nl })}
          </span>
          {isOutbound && (
            <span className="text-xs">
              {message.status === 'read' && '✓✓'}
              {message.status === 'delivered' && '✓✓'}
              {message.status === 'sent' && '✓'}
              {message.status === 'pending' && '⏳'}
              {message.status === 'failed' && '❌'}
            </span>
          )}
          {message.createdBy === 'claude' && (
            <span className="text-xs text-purple-600" title="Sent by Claude">
              🤖
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
