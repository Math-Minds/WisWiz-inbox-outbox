'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Badge } from '@/components/ui/Badge';
import type { Deal, DealStatus, Payment } from '@/lib/types';

const PIPELINE_STEPS: { status: DealStatus; label: string }[] = [
  { status: 'prospect', label: 'Prospect' },
  { status: 'contacted', label: 'Benaderd' },
  { status: 'negotiating', label: 'Onderhandeling' },
  { status: 'agreed', label: 'Akkoord' },
  { status: 'content_creating', label: 'Content maken' },
  { status: 'content_review', label: 'Review' },
  { status: 'published', label: 'Gepubliceerd' },
  { status: 'completed', label: 'Afgerond' },
];

interface DealTabProps {
  slug: string;
}

export function DealTab({ slug }: DealTabProps) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAfspraken, setSavingAfspraken] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [afspraken, setAfspraken] = useState(deal?.afspraken);

  const fetchDeal = useCallback(async () => {
    try {
      const res = await fetch(`/api/influencers/${slug}/deal`);
      if (res.ok) {
        const data = await res.json();
        setDeal(data);
        setAfspraken(data.afspraken);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchDeal();
  }, [fetchDeal]);

  const updateStatus = async (status: DealStatus) => {
    try {
      const res = await fetch(`/api/influencers/${slug}/deal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        setDeal(data);
      }
    } catch {
      // silently fail
    }
  };

  const saveAfspraken = async () => {
    if (!afspraken) return;
    setSavingAfspraken(true);
    try {
      const res = await fetch(`/api/influencers/${slug}/deal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ afspraken }),
      });
      if (res.ok) {
        const data = await res.json();
        setDeal(data);
      }
    } catch {
      // silently fail
    } finally {
      setSavingAfspraken(false);
    }
  };

  const addPayment = async (payment: Omit<Payment, 'id'>) => {
    try {
      const res = await fetch(`/api/influencers/${slug}/deal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPayment: payment,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDeal(data);
        setShowPaymentForm(false);
      }
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <p className="text-sm">Deal laden...</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <p className="text-sm">Geen deal gevonden</p>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      {/* Status Pipeline */}
      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Status</h3>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {PIPELINE_STEPS.map((step) => {
            const isActive = step.status === deal.status;
            const isDeclined = deal.status === 'declined';
            return (
              <button
                key={step.status}
                onClick={() => updateStatus(step.status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {step.label}
              </button>
            );
          })}
          <button
            onClick={() => updateStatus('declined')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              deal.status === 'declined'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            Afgewezen
          </button>
        </div>
      </section>

      {/* Afspraken */}
      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Afspraken</h3>
        {afspraken && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Vergoeding</label>
              <input
                type="number"
                value={afspraken.vergoeding ?? ''}
                onChange={(e) =>
                  setAfspraken((prev) => prev && { ...prev, vergoeding: e.target.value ? Number(e.target.value) : null })
                }
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
              <select
                value={afspraken.vergoeding_type ?? ''}
                onChange={(e) =>
                  setAfspraken((prev) => prev && { ...prev, vergoeding_type: (e.target.value || null) as 'per_video' | 'vast' | null })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Kies --</option>
                <option value="per_video">Per video</option>
                <option value="vast">Vast bedrag</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Aantal videos</label>
              <input
                type="number"
                value={afspraken.aantal_videos ?? ''}
                onChange={(e) =>
                  setAfspraken((prev) => prev && { ...prev, aantal_videos: e.target.value ? Number(e.target.value) : null })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Prijs per 1k views</label>
              <input
                type="number"
                step="0.01"
                value={afspraken.prijs_per_1k_views ?? ''}
                onChange={(e) =>
                  setAfspraken((prev) => prev && { ...prev, prijs_per_1k_views: e.target.value ? Number(e.target.value) : null })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Platform</label>
              <select
                value={afspraken.platform ?? ''}
                onChange={(e) =>
                  setAfspraken((prev) => prev && { ...prev, platform: e.target.value || null })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Kies --</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Deadline</label>
              <input
                type="date"
                value={afspraken.deadline ?? ''}
                onChange={(e) =>
                  setAfspraken((prev) => prev && { ...prev, deadline: e.target.value || null })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="col-span-2">
              <button
                onClick={saveAfspraken}
                disabled={savingAfspraken}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {savingAfspraken ? 'Opslaan...' : 'Afspraken opslaan'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Betalingen */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Betalingen</h3>
          <button
            onClick={() => setShowPaymentForm(!showPaymentForm)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {showPaymentForm ? 'Annuleren' : '+ Betaling toevoegen'}
          </button>
        </div>

        {showPaymentForm && (
          <PaymentForm onSubmit={addPayment} onCancel={() => setShowPaymentForm(false)} />
        )}

        {deal.betalingen.length === 0 ? (
          <p className="text-sm text-slate-500">Nog geen betalingen</p>
        ) : (
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-3 py-2 text-xs font-medium text-slate-500">Bedrag</th>
                  <th className="px-3 py-2 text-xs font-medium text-slate-500">Status</th>
                  <th className="px-3 py-2 text-xs font-medium text-slate-500">Datum</th>
                  <th className="px-3 py-2 text-xs font-medium text-slate-500">Methode</th>
                  <th className="px-3 py-2 text-xs font-medium text-slate-500">Referentie</th>
                </tr>
              </thead>
              <tbody>
                {deal.betalingen.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">&euro;{b.bedrag.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          b.status === 'betaald'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {b.status === 'betaald' ? 'Betaald' : 'Openstaand'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{b.datum}</td>
                    <td className="px-3 py-2 text-slate-600 capitalize">{b.methode}</td>
                    <td className="px-3 py-2 text-slate-500">{b.referentie ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Tijdlijn */}
      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Tijdlijn</h3>
        {deal.tijdlijn.length === 0 ? (
          <p className="text-sm text-slate-500">Nog geen activiteit</p>
        ) : (
          <div className="space-y-3">
            {deal.tijdlijn.map((event, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-slate-700">
                    {event.type === 'status_change' && event.to && (
                      <>Status gewijzigd naar <Badge status={event.to} size="sm" /></>
                    )}
                    {event.type === 'betaling' && event.tekst}
                    {event.type === 'notitie' && event.tekst}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {format(new Date(event.timestamp), 'd MMM yyyy HH:mm', { locale: nl })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PaymentForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (p: Omit<Payment, 'id'>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    bedrag: '',
    status: 'openstaand' as 'openstaand' | 'betaald',
    datum: new Date().toISOString().split('T')[0],
    methode: 'tikkie' as Payment['methode'],
    referentie: '',
    notitie: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bedrag) return;
    onSubmit({
      bedrag: Number(form.bedrag),
      status: form.status,
      datum: form.datum,
      methode: form.methode,
      referentie: form.referentie || null,
      notitie: form.notitie || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 rounded-md p-3 mb-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Bedrag</label>
          <input
            type="number"
            step="0.01"
            value={form.bedrag}
            onChange={(e) => setForm((prev) => ({ ...prev, bedrag: e.target.value }))}
            required
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as 'openstaand' | 'betaald' }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="openstaand">Openstaand</option>
            <option value="betaald">Betaald</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Datum</label>
          <input
            type="date"
            value={form.datum}
            onChange={(e) => setForm((prev) => ({ ...prev, datum: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Methode</label>
          <select
            value={form.methode}
            onChange={(e) => setForm((prev) => ({ ...prev, methode: e.target.value as Payment['methode'] }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="tikkie">Tikkie</option>
            <option value="bank">Bank</option>
            <option value="paypal">PayPal</option>
            <option value="anders">Anders</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Referentie</label>
          <input
            type="text"
            value={form.referentie}
            onChange={(e) => setForm((prev) => ({ ...prev, referentie: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Notitie</label>
          <input
            type="text"
            value={form.notitie}
            onChange={(e) => setForm((prev) => ({ ...prev, notitie: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition-colors"
        >
          Toevoegen
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-300 transition-colors"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
