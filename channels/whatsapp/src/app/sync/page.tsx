'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SyncStatus {
  status: 'idle' | 'connecting' | 'qr' | 'ready' | 'syncing' | 'done' | 'error';
  qrDataUrl: string | null;
  updatedAt: string | null;
  progress: { current: number; total: number; lastChat: string } | null;
  result: { synced: number; skipped: number; newInfluencers: number; errors: string[] } | null;
  error: string | null;
}

export default function SyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      while (active) {
        try {
          const res = await fetch('/api/sync/status');
          if (res.ok) {
            const data = await res.json();
            if (active) setStatus(data);
          }
        } catch {
          // ignore fetch errors
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    poll();
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-slate-900">WhatsApp Sync</h1>
          <Link href="/" className="text-sm text-indigo-500 hover:text-indigo-700 transition-colors">
            Terug naar CRM
          </Link>
        </div>

        {!status || status.status === 'idle' ? (
          <IdleState updatedAt={status?.updatedAt ?? null} />
        ) : status.status === 'connecting' ? (
          <ConnectingState />
        ) : status.status === 'qr' ? (
          <QrState qrDataUrl={status.qrDataUrl} />
        ) : status.status === 'ready' ? (
          <ReadyState />
        ) : status.status === 'syncing' ? (
          <SyncingState progress={status.progress} />
        ) : status.status === 'done' ? (
          <DoneState result={status.result} updatedAt={status.updatedAt} />
        ) : status.status === 'error' ? (
          <ErrorState error={status.error} />
        ) : null}
      </div>

      <p className="text-xs text-slate-400 mt-4">
        Start sync via terminal: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">npm run sync</code>
      </p>
    </div>
  );
}

function IdleState({ updatedAt }: { updatedAt: string | null }) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3">📱</div>
      <p className="text-slate-500 text-sm">Geen actieve sync</p>
      <p className="text-slate-400 text-xs mt-2">
        Run <code className="bg-slate-100 px-1.5 py-0.5 rounded">npm run sync</code> in de terminal
      </p>
      {updatedAt && (
        <p className="text-slate-400 text-xs mt-3">
          Laatst bijgewerkt: {new Date(updatedAt).toLocaleString('nl-NL')}
        </p>
      )}
    </div>
  );
}

function ConnectingState() {
  return (
    <div className="text-center py-8">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
      <p className="text-slate-700 text-sm font-medium">Verbinden met WhatsApp Web...</p>
      <p className="text-slate-400 text-xs mt-1">Even geduld</p>
    </div>
  );
}

function QrState({ qrDataUrl }: { qrDataUrl: string | null }) {
  return (
    <div className="text-center">
      <p className="text-slate-700 text-sm font-medium mb-4">Scan deze QR code met je telefoon</p>

      {qrDataUrl ? (
        <div className="bg-white border-2 border-indigo-200 rounded-xl p-4 mb-5 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="WhatsApp QR Code" width={256} height={256} />
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl py-16 px-4 mb-5 flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      )}

      <div className="bg-slate-50 rounded-md p-3 text-left text-xs text-slate-500 space-y-1">
        <p>1. Open <strong>WhatsApp Business App</strong></p>
        <p>2. Ga naar <strong>Gekoppelde apparaten</strong></p>
        <p>3. Tik op <strong>Apparaat koppelen</strong></p>
        <p>4. Scan de QR code hierboven</p>
      </div>
    </div>
  );
}

function ReadyState() {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3">✅</div>
      <p className="text-slate-700 text-sm font-medium">Verbonden met WhatsApp</p>
      <p className="text-slate-400 text-xs mt-1">Luisteren naar berichten...</p>
    </div>
  );
}

function SyncingState({ progress }: { progress: SyncStatus['progress'] }) {
  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
        <p className="text-slate-700 text-sm font-medium">Berichten synchroniseren...</p>
      </div>

      {progress && progress.total > 0 && (
        <>
          <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{progress.current} / {progress.total} chats</span>
            <span>{progress.lastChat}</span>
          </div>
        </>
      )}
    </div>
  );
}

function DoneState({ result, updatedAt }: { result: SyncStatus['result']; updatedAt: string | null }) {
  return (
    <div className="py-6">
      <div className="text-center mb-4">
        <div className="text-4xl mb-2">🎉</div>
        <p className="text-slate-700 text-sm font-medium">Sync voltooid</p>
      </div>

      {result && (
        <div className="bg-slate-50 rounded-md p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Nieuwe berichten</span>
            <span className="font-medium text-slate-900">{result.synced}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Duplicaten overgeslagen</span>
            <span className="text-slate-400">{result.skipped}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Nieuwe influencers</span>
            <span className="font-medium text-slate-900">{result.newInfluencers}</span>
          </div>
          {result.errors.length > 0 && (
            <div className="pt-2 border-t border-slate-200">
              <p className="text-red-500 font-medium">{result.errors.length} fouten:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-red-400 text-xs mt-1">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {updatedAt && (
        <p className="text-slate-400 text-xs text-center mt-3">
          {new Date(updatedAt).toLocaleString('nl-NL')}
        </p>
      )}
    </div>
  );
}

function ErrorState({ error }: { error: string | null }) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3">❌</div>
      <p className="text-red-600 text-sm font-medium">Sync mislukt</p>
      {error && <p className="text-red-400 text-xs mt-2 break-words">{error}</p>}
    </div>
  );
}
