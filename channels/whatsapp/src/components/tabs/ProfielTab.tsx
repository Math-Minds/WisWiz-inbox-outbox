'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { Profile } from '@/lib/types';

interface ProfielTabProps {
  slug: string;
  profile: Profile;
  onProfileUpdate: (p: Profile) => void;
}

export function ProfielTab({ slug, profile, onProfileUpdate }: ProfielTabProps) {
  const [form, setForm] = useState({
    naam: profile.naam,
    tiktok: (profile.tiktok ?? '').replace(/^@/, ''),
    phones: profile.phones.length > 0 ? profile.phones : [''],
    emails: profile.emails.length > 0 ? profile.emails : [''],
    notities: profile.notities ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (field: 'naam' | 'tiktok' | 'notities', value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleArrayChange = (field: 'phones' | 'emails', index: number, value: string) => {
    setForm((prev) => {
      const arr = [...prev[field]];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
    setSaved(false);
  };

  const addArrayItem = (field: 'phones' | 'emails') => {
    setForm((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeArrayItem = (field: 'phones' | 'emails', index: number) => {
    setForm((prev) => {
      const arr = prev[field].filter((_, i) => i !== index);
      return { ...prev, [field]: arr.length > 0 ? arr : [''] };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/influencers/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naam: form.naam,
          tiktok: form.tiktok ? `@${form.tiktok.replace(/^@/, '')}` : null,
          phones: form.phones.filter((p) => p.trim()),
          emails: form.emails.filter((e) => e.trim()),
          notities: form.notities || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onProfileUpdate(updated);
        setSaved(true);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-lg space-y-4">
        {/* Editable fields */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Naam</label>
          <input
            type="text"
            value={form.naam}
            onChange={(e) => handleChange('naam', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">TikTok</label>
          <div className="flex items-center">
            <span className="text-sm text-slate-500 mr-1">@</span>
            <input
              type="text"
              value={form.tiktok}
              onChange={(e) => handleChange('tiktok', e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Telefoon</label>
          <div className="space-y-2">
            {form.phones.map((phone, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => handleArrayChange('phones', i, e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                {form.phones.length > 1 && (
                  <button
                    onClick={() => removeArrayItem('phones', i)}
                    className="text-slate-400 hover:text-red-500 text-sm"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => addArrayItem('phones')}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              + Telefoonnummer
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <div className="space-y-2">
            {form.emails.map((email, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => handleArrayChange('emails', i, e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                {form.emails.length > 1 && (
                  <button
                    onClick={() => removeArrayItem('emails', i)}
                    className="text-slate-400 hover:text-red-500 text-sm"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => addArrayItem('emails')}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              + Email
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notities</label>
          <textarea
            value={form.notities}
            onChange={(e) => handleChange('notities', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
          />
        </div>

        {/* Read-only fields */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-0.5">Eerste contact</label>
            <p className="text-sm text-slate-700">
              {format(new Date(profile.eerste_contact), 'd MMMM yyyy', { locale: nl })}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-0.5">Kanalen</label>
            <div className="flex gap-1.5">
              {profile.kanalen.map((k) => (
                <span key={k} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
          {saved && (
            <span className="ml-3 text-sm text-green-600">Opgeslagen</span>
          )}
        </div>
      </div>
    </div>
  );
}
