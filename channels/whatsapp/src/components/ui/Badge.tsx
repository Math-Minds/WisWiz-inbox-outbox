'use client';

import type { DealStatus } from '@/lib/types';

const STATUS_LABELS: Record<DealStatus, string> = {
  prospect: 'Prospect',
  contacted: 'Benaderd',
  negotiating: 'Onderhandeling',
  agreed: 'Akkoord',
  content_creating: 'Content maken',
  content_review: 'Review',
  published: 'Gepubliceerd',
  completed: 'Afgerond',
  declined: 'Afgewezen',
};

const STATUS_COLORS: Record<DealStatus, string> = {
  prospect: 'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  negotiating: 'bg-yellow-100 text-yellow-700',
  agreed: 'bg-green-100 text-green-700',
  content_creating: 'bg-purple-100 text-purple-700',
  content_review: 'bg-orange-100 text-orange-700',
  published: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-red-100 text-red-700',
};

interface BadgeProps {
  status: DealStatus | null;
  size?: 'sm' | 'md';
}

export function Badge({ status, size = 'sm' }: BadgeProps) {
  const label = status ? STATUS_LABELS[status] : 'Geen deal';
  const colorClass = status ? STATUS_COLORS[status] : 'bg-slate-100 text-slate-600';
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${colorClass} ${sizeClass}`}>
      {label}
    </span>
  );
}
