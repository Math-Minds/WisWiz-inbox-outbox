'use client';

import { useState, useEffect } from 'react';

export function StatusBar() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const res = await fetch('/api/influencers');
      setStatus(res.ok ? 'connected' : 'disconnected');
    } catch {
      setStatus('disconnected');
    }
  }

  return (
    <div className="bg-indigo-700 text-white px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span className="font-semibold">WisWiz Influencer CRM</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'connected'
                ? 'bg-green-400'
                : status === 'checking'
                ? 'bg-yellow-400'
                : 'bg-red-400'
            }`}
          />
          <span className="text-indigo-200">
            {status === 'connected' && 'Verbonden'}
            {status === 'checking' && 'Verbinden...'}
            {status === 'disconnected' && 'Niet verbonden'}
          </span>
        </div>
      </div>
    </div>
  );
}
