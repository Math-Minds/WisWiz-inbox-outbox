'use client';

import { useState, useEffect, useCallback } from 'react';
import { InfluencerList } from '@/components/InfluencerList';
import { InfluencerDetail } from '@/components/InfluencerDetail';
import { PhoneChatDetail } from '@/components/PhoneChatDetail';
import { StatusBar } from '@/components/StatusBar';
import type { InfluencerSummary, DealStatus } from '@/lib/types';

interface UnmatchedChat {
  phone: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string;
}

type Selection =
  | { type: 'influencer'; slug: string }
  | { type: 'chat'; phone: string; name: string }
  | null;

export default function Home() {
  const [influencers, setInfluencers] = useState<InfluencerSummary[]>([]);
  const [unmatchedChats, setUnmatchedChats] = useState<UnmatchedChat[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DealStatus | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchInfluencers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('archived', showArchived ? 'true' : 'false');

      const res = await fetch(`/api/influencers?${params}`);
      const data = await res.json();
      setInfluencers(data);
      setLoading(false);

      // Fetch archived count (only when showing active)
      if (!showArchived) {
        const archivedRes = await fetch('/api/influencers?archived=true');
        const archivedData = await archivedRes.json();
        setArchivedCount(archivedData.length);
      }
    } catch (err) {
      console.error('Failed to fetch influencers:', err);
      setLoading(false);
    }
  }, [searchQuery, statusFilter, showArchived]);

  const fetchUnmatchedChats = useCallback(async () => {
    try {
      const res = await fetch('/api/chats');
      const data = await res.json();
      setUnmatchedChats(data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchInfluencers();
    fetchUnmatchedChats();
    const interval = setInterval(() => {
      fetchInfluencers();
      fetchUnmatchedChats();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchInfluencers, fetchUnmatchedChats]);

  const selectedSlug = selection?.type === 'influencer' ? selection.slug : null;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-lg font-semibold text-gray-900">
              Influencers
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {influencers.length} influencers
              {unmatchedChats.length > 0 && ` · ${unmatchedChats.length} overige chats`}
            </p>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Laden...
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <InfluencerList
                influencers={influencers}
                selectedSlug={selectedSlug}
                onSelect={(slug) => setSelection({ type: 'influencer', slug })}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                showArchived={showArchived}
                onToggleArchived={() => setShowArchived((v) => !v)}
                archivedCount={archivedCount}
              />

              {/* Unmatched chats section */}
              {unmatchedChats.length > 0 && (
                <div className="border-t border-slate-200">
                  <div className="px-3 py-2 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Overige chats
                    </p>
                  </div>
                  {unmatchedChats.map((chat) => {
                    const isSelected =
                      selection?.type === 'chat' && selection.phone === chat.phone;
                    return (
                      <button
                        key={chat.phone}
                        onClick={() =>
                          setSelection({
                            type: 'chat',
                            phone: chat.phone,
                            name: chat.name,
                          })
                        }
                        className={`w-full p-3 flex items-center gap-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-slate-100 border-l-2 border-slate-500'
                            : 'hover:bg-slate-50 border-l-2 border-transparent'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-400 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                          {chat.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-slate-900 text-sm truncate block">
                            {chat.name}
                          </span>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {chat.phone}
                          </p>
                          {chat.lastMessage && (
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {chat.lastMessage}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selection?.type === 'influencer' ? (
            <InfluencerDetail slug={selection.slug} />
          ) : selection?.type === 'chat' ? (
            <PhoneChatDetail phone={selection.phone} name={selection.name} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-lg">Selecteer een influencer</p>
                <p className="text-sm mt-1">
                  Kies een influencer uit de lijst om details te bekijken
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
