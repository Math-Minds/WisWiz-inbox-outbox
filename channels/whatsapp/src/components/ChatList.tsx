'use client';

import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { Contact, Thread } from '@/lib/types';

interface Chat {
  contact: Contact | null;
  thread: Thread;
}

interface ChatListProps {
  chats: Chat[];
  selectedPhone: string | null;
  onSelectChat: (phone: string) => void;
}

export function ChatList({ chats, selectedPhone, onSelectChat }: ChatListProps) {
  if (chats.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 p-4 text-center">
        <div>
          <div className="text-4xl mb-2">📭</div>
          <p>Nog geen chats</p>
          <p className="text-sm mt-1">
            Berichten verschijnen hier zodra ze binnenkomen
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {chats.map((chat) => {
        const phone = chat.thread.contactPhone;
        const name = chat.contact?.profile.name || chat.contact?.profile.pushName || phone;
        const isSelected = phone === selectedPhone;

        return (
          <button
            key={phone}
            onClick={() => onSelectChat(phone)}
            className={`w-full p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left ${
              isSelected ? 'bg-gray-100' : ''
            }`}
          >
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-white text-lg font-medium flex-shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 truncate">
                  {name}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(chat.thread.lastMessageAt), {
                    addSuffix: false,
                    locale: nl,
                  })}
                </span>
              </div>

              <div className="flex items-center justify-between mt-0.5">
                <span className="text-sm text-gray-600 truncate">
                  {chat.thread.lastMessagePreview || 'Geen berichten'}
                </span>
                {chat.thread.unreadCount > 0 && (
                  <span className="ml-2 bg-[#25D366] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {chat.thread.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
