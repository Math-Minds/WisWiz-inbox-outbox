'use client';

import { useState, useEffect } from 'react';
import { ChatList } from '@/components/ChatList';
import { ChatView } from '@/components/ChatView';
import { StatusBar } from '@/components/StatusBar';
import type { Contact, Thread, Message } from '@/lib/types';

interface Chat {
  contact: Contact | null;
  thread: Thread;
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch chats on mount
  useEffect(() => {
    fetchChats();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchChats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch messages when chat is selected
  useEffect(() => {
    if (selectedPhone) {
      fetchMessages(selectedPhone);
      // Poll for new messages
      const interval = setInterval(() => fetchMessages(selectedPhone), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedPhone]);

  async function fetchChats() {
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      setChats(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch chats:', err);
      setLoading(false);
    }
  }

  async function fetchMessages(phone: string) {
    try {
      const res = await fetch(`/api/messages?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }

  async function sendMessage(body: string) {
    if (!selectedPhone || !body.trim()) return;

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedPhone,
          body: body.trim(),
          createdBy: 'user',
        }),
      });

      if (res.ok) {
        // Refresh messages
        await fetchMessages(selectedPhone);
        await fetchChats();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }

  const selectedChat = chats.find(
    (c) => c.thread.contactPhone === selectedPhone
  );

  return (
    <div className="flex flex-col h-screen">
      <StatusBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Chat List */}
        <div className="w-80 bg-white border-r flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h1 className="text-xl font-semibold text-gray-800">
              WisWiz WhatsApp
            </h1>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Laden...
            </div>
          ) : (
            <ChatList
              chats={chats}
              selectedPhone={selectedPhone}
              onSelectChat={setSelectedPhone}
            />
          )}
        </div>

        {/* Main - Chat View */}
        <div className="flex-1 flex flex-col bg-[#E5DDD5]">
          {selectedPhone ? (
            <ChatView
              contact={selectedChat?.contact}
              thread={selectedChat?.thread}
              messages={messages}
              onSendMessage={sendMessage}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <p>Selecteer een chat om te beginnen</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
