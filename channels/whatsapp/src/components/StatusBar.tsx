'use client';

import { useState, useEffect } from 'react';

export function StatusBar() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const res = await fetch('/api/contacts');
      setStatus(res.ok ? 'connected' : 'disconnected');
    } catch {
      setStatus('disconnected');
    }
  }

  return (
    <div className="bg-[#128C7E] text-white px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span>WisWiz WhatsApp Manager</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Status indicator */}
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
          <span>
            {status === 'connected' && 'Verbonden'}
            {status === 'checking' && 'Verbinden...'}
            {status === 'disconnected' && 'Niet verbonden'}
          </span>
        </div>

        {/* Help link */}
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/80 hover:text-white"
        >
          API Docs
        </a>
      </div>
    </div>
  );
}
