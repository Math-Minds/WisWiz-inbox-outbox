'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Profile } from '@/lib/types';
import { TabBar } from '@/components/ui/TabBar';
import { ChatTab } from '@/components/tabs/ChatTab';
import { ProfielTab } from '@/components/tabs/ProfielTab';
import { DealTab } from '@/components/tabs/DealTab';
import { VideosTab } from '@/components/tabs/VideosTab';
import { EmailTab } from '@/components/tabs/EmailTab';

function ArchiveButton({ slug, archived, onToggle }: { slug: string; archived: boolean; onToggle: (archived: boolean) => void }) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/influencers/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !archived }),
      });
      if (res.ok) {
        onToggle(!archived);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-50 ${
        archived
          ? 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'
          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {loading ? '...' : archived ? 'Dearchiveren' : 'Archiveren'}
    </button>
  );
}

const TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'profiel', label: 'Profiel' },
  { id: 'deal', label: 'Deal' },
  { id: 'videos', label: 'Videos' },
  { id: 'email', label: 'Email' },
];

interface InfluencerDetailProps {
  slug: string;
}

export function InfluencerDetail({ slug }: InfluencerDetailProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/influencers/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchProfile();
    setActiveTab('chat');
  }, [fetchProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm">Profiel laden...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <p className="text-sm">Profiel niet gevonden</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white text-lg font-medium">
            {profile.naam.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">{profile.naam}</h2>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              {profile.tiktok && <span>{profile.tiktok.startsWith('@') ? profile.tiktok : `@${profile.tiktok}`}</span>}
              {profile.phones[0] && <span>{profile.phones[0]}</span>}
              {profile.emails[0] && <span>{profile.emails[0]}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile.kanalen.map((kanaal) => (
              <span
                key={kanaal}
                className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full"
              >
                {kanaal}
              </span>
            ))}
            <ArchiveButton
              slug={slug}
              archived={profile.archived ?? false}
              onToggle={(archived) => setProfile({ ...profile, archived })}
            />
          </div>
        </div>
      </div>

      {/* Archived banner */}
      {profile.archived && (
        <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs">
          Deze influencer is gearchiveerd
        </div>
      )}

      {/* Tabs */}
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <ChatTab slug={slug} telefoon={profile.phones[0] || null} />
        )}
        {activeTab === 'profiel' && (
          <ProfielTab
            slug={slug}
            profile={profile}
            onProfileUpdate={setProfile}
          />
        )}
        {activeTab === 'deal' && <DealTab slug={slug} />}
        {activeTab === 'videos' && <VideosTab slug={slug} />}
        {activeTab === 'email' && <EmailTab slug={slug} />}
      </div>
    </div>
  );
}
