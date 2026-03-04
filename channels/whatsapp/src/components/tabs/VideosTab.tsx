'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Video, VideoStatus } from '@/lib/types';

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: 'TT',
  instagram: 'IG',
  youtube: 'YT',
};

const STATUS_LABELS: Record<VideoStatus, string> = {
  concept: 'Concept',
  in_review: 'In review',
  gepost: 'Gepost',
};

const STATUS_COLORS: Record<VideoStatus, string> = {
  concept: 'bg-slate-100 text-slate-600',
  in_review: 'bg-yellow-100 text-yellow-700',
  gepost: 'bg-green-100 text-green-700',
};

interface VideosTabProps {
  slug: string;
}

export function VideosTab({ slug }: VideosTabProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch(`/api/influencers/${slug}/videos`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const saveVideo = async (video: Partial<Video>) => {
    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...video, id: editingId } : video;
      const res = await fetch(`/api/influencers/${slug}/videos`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchVideos();
        setShowForm(false);
        setEditingId(null);
      }
    } catch {
      // silently fail
    }
  };

  const startEdit = (video: Video) => {
    setEditingId(video.id);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <p className="text-sm">Videos laden...</p>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Videos</h3>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); }}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          {showForm && !editingId ? 'Annuleren' : '+ Video toevoegen'}
        </button>
      </div>

      {showForm && (
        <VideoForm
          video={editingId ? videos.find((v) => v.id === editingId) : undefined}
          onSubmit={saveVideo}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
        />
      )}

      {videos.length === 0 ? (
        <p className="text-sm text-slate-500">Nog geen videos</p>
      ) : (
        <div className="grid gap-3">
          {videos.map((video) => (
            <div
              key={video.id}
              className="border border-slate-200 rounded-md p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                    {PLATFORM_ICONS[video.platform] ?? video.platform}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {video.titel || 'Geen titel'}
                    </p>
                    {video.url && (
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Bekijk video
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[video.status]}`}>
                    {STATUS_LABELS[video.status]}
                  </span>
                  <button
                    onClick={() => startEdit(video)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Bewerken
                  </button>
                </div>
              </div>

              {/* Stats */}
              {video.status === 'gepost' && (
                <div className="flex gap-4 mt-3 text-xs text-slate-500">
                  {video.views !== null && (
                    <span>{video.views.toLocaleString('nl-NL')} views</span>
                  )}
                  {video.likes !== null && (
                    <span>{video.likes.toLocaleString('nl-NL')} likes</span>
                  )}
                  {video.comments !== null && (
                    <span>{video.comments.toLocaleString('nl-NL')} comments</span>
                  )}
                  {video.datum_gepost && (
                    <span>Gepost: {video.datum_gepost}</span>
                  )}
                </div>
              )}

              {video.notitie && (
                <p className="mt-2 text-xs text-slate-500">{video.notitie}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoForm({
  video,
  onSubmit,
  onCancel,
}: {
  video?: Video;
  onSubmit: (v: Partial<Video>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    platform: video?.platform ?? ('tiktok' as Video['platform']),
    titel: video?.titel ?? '',
    url: video?.url ?? '',
    status: video?.status ?? ('concept' as VideoStatus),
    datum_gepost: video?.datum_gepost ?? '',
    views: video?.views?.toString() ?? '',
    likes: video?.likes?.toString() ?? '',
    comments: video?.comments?.toString() ?? '',
    notitie: video?.notitie ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      platform: form.platform,
      titel: form.titel || null,
      url: form.url || null,
      status: form.status,
      datum_gepost: form.datum_gepost || null,
      views: form.views ? Number(form.views) : null,
      likes: form.likes ? Number(form.likes) : null,
      comments: form.comments ? Number(form.comments) : null,
      notitie: form.notitie || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 rounded-md p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Platform</label>
          <select
            value={form.platform}
            onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value as Video['platform'] }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as VideoStatus }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="concept">Concept</option>
            <option value="in_review">In review</option>
            <option value="gepost">Gepost</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">Titel</label>
          <input
            type="text"
            value={form.titel}
            onChange={(e) => setForm((prev) => ({ ...prev, titel: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">URL</label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Datum gepost</label>
          <input
            type="date"
            value={form.datum_gepost}
            onChange={(e) => setForm((prev) => ({ ...prev, datum_gepost: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Views</label>
          <input
            type="number"
            value={form.views}
            onChange={(e) => setForm((prev) => ({ ...prev, views: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Likes</label>
          <input
            type="number"
            value={form.likes}
            onChange={(e) => setForm((prev) => ({ ...prev, likes: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Comments</label>
          <input
            type="number"
            value={form.comments}
            onChange={(e) => setForm((prev) => ({ ...prev, comments: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="col-span-2">
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
          {video ? 'Opslaan' : 'Toevoegen'}
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
