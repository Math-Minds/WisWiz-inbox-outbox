'use client';

import type { InfluencerSummary, DealStatus } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';

interface InfluencerListProps {
  influencers: InfluencerSummary[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: DealStatus | 'all';
  onStatusFilterChange: (s: DealStatus | 'all') => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  archivedCount: number;
}

const FILTER_OPTIONS: { value: DealStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Alle statussen' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'contacted', label: 'Benaderd' },
  { value: 'negotiating', label: 'Onderhandeling' },
  { value: 'agreed', label: 'Akkoord' },
  { value: 'content_creating', label: 'Content maken' },
  { value: 'content_review', label: 'Review' },
  { value: 'published', label: 'Gepubliceerd' },
  { value: 'completed', label: 'Afgerond' },
  { value: 'declined', label: 'Afgewezen' },
];

export function InfluencerList({
  influencers,
  selectedSlug,
  onSelect,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  showArchived,
  onToggleArchived,
  archivedCount,
}: InfluencerListProps) {
  return (
    <div className="flex flex-col bg-white">
      {/* Search & Filters */}
      <div className="p-3 space-y-2 border-b border-slate-200">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Zoek influencer..."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as DealStatus | 'all')}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Archive toggle */}
        <button
          onClick={onToggleArchived}
          className={`w-full px-3 py-1.5 text-xs rounded-md border transition-colors ${
            showArchived
              ? 'bg-slate-100 border-slate-300 text-slate-700'
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          {showArchived
            ? 'Toon actieve influencers'
            : `Toon archief${archivedCount > 0 ? ` (${archivedCount})` : ''}`}
        </button>
      </div>

      {/* List */}
      <div>
        {influencers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-4 text-center">
            <p className="text-sm">
              {showArchived ? 'Geen gearchiveerde influencers' : 'Geen influencers gevonden'}
            </p>
            <p className="text-xs mt-1">Pas je zoekterm of filter aan</p>
          </div>
        ) : (
          influencers.map((inf) => {
            const isSelected = inf.slug === selectedSlug;
            return (
              <button
                key={inf.slug}
                onClick={() => onSelect(inf.slug)}
                className={`w-full p-3 flex items-center gap-3 text-left transition-colors ${
                  isSelected
                    ? 'bg-indigo-50 border-l-2 border-indigo-500'
                    : 'hover:bg-slate-50 border-l-2 border-transparent'
                } ${inf.archived ? 'opacity-60' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0 ${
                  inf.archived ? 'bg-slate-400' : 'bg-indigo-500'
                }`}>
                  {inf.naam.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900 text-sm truncate">
                      {inf.naam}
                    </span>
                    <Badge status={inf.dealStatus} />
                  </div>
                  {inf.tiktok && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {inf.tiktok.startsWith('@') ? inf.tiktok : `@${inf.tiktok}`}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
