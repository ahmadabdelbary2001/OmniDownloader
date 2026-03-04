/**
 * useYouTubeApi.ts
 *
 * Integrates the YouTube Data API v3 to enrich video metadata and caption listings.
 *
 * IMPORTANT: The YouTube Data API v3 `captions.download` endpoint requires OAuth 2.0
 * and video ownership — it CANNOT download captions for arbitrary public videos.
 *
 * This hook provides:
 *   1. Fetching rich video metadata (title, stats, channel, duration)
 *   2. Listing available caption tracks (language, name, trackKind)
 *   3. Fetching playlist metadata and items (fast discovery)
 *
 * The API key is stored in localStorage (configurable via settings).
 * The default fallback key is from app/src/pages/YouTube.jsx.
 */

import { useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface YouTubeRichMetadata {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  thumbnail: string;
  duration: string;        // ISO 8601 e.g. "PT5M33S"
  durationSeconds: number; // parsed seconds
  viewCount: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
}

export interface YouTubeCaptionTrack {
  id: string;
  language: string;
  name: string;
  trackKind: 'standard' | 'asr' | 'forced';
  isCC: boolean;
  isEasyReader: boolean;
}

const DEFAULT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const API_BASE = import.meta.env.VITE_YOUTUBE_API_BASE;

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseISODuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0');
  const m = parseInt(match[2] || '0');
  const s = parseInt(match[3] || '0');
  return h * 3600 + m * 60 + s;
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useYouTubeApi() {
  const [apiKey, setApiKeyState] = useState<string>(() => {
    return localStorage.getItem('yt_api_key') || DEFAULT_API_KEY;
  });

  const updateApiKey = useCallback((key: string) => {
    localStorage.setItem('yt_api_key', key);
    setApiKeyState(key);
  }, []);

  /**
   * Extracts the video ID from a YouTube URL and identifies if it's a Short.
   */
  const extractVideoInfo = useCallback((url: string): { id: string | null; isShort: boolean; listId: string | null } => {
    try {
      const u = new URL(url);
      const listId = u.searchParams.get('list');
      
      // Shorts handling: https://www.youtube.com/shorts/ID
      if (u.pathname.includes('/shorts/')) {
        const id = u.pathname.split('/shorts/')[1].split('/')[0];
        return { id, isShort: true, listId };
      }

      // Regular YouTube: https://www.youtube.com/watch?v=ID
      if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
        const id = u.hostname.includes('youtu.be') 
          ? u.pathname.slice(1) 
          : u.searchParams.get('v');
        return { id, isShort: false, listId };
      }
      
      return { id: null, isShort: false, listId };
    } catch { 
      return { id: null, isShort: false, listId: null }; 
    }
  }, []);

  /**
   * Alias for backward compatibility.
   */
  const extractVideoId = useCallback((url: string): string | null => {
    return extractVideoInfo(url).id;
  }, [extractVideoInfo]);

  /**
   * Fetches rich metadata for a video.
   */
  const fetchVideoMetadata = useCallback(async (
    url: string
  ): Promise<YouTubeRichMetadata | null> => {
    const videoId = extractVideoId(url);
    if (!videoId) return null;

    try {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails,statistics',
        id: videoId,
        key: apiKey,
      });

      const res = await fetch(`${API_BASE}/videos?${params}`);
      if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

      const data = await res.json();
      const item = data.items?.[0];
      if (!item) return null;

      const snippet = item.snippet || {};
      const details = item.contentDetails || {};
      const stats   = item.statistics || {};

      const best = snippet.thumbnails?.maxres?.url
        || snippet.thumbnails?.high?.url
        || snippet.thumbnails?.medium?.url
        || snippet.thumbnails?.default?.url
        || '';

      return {
        id: videoId,
        title: snippet.title || '',
        description: snippet.description || '',
        channelTitle: snippet.channelTitle || '',
        channelId: snippet.channelId || '',
        publishedAt: snippet.publishedAt || '',
        thumbnail: best,
        duration: details.duration || '',
        durationSeconds: parseISODuration(details.duration || ''),
        viewCount: parseInt(stats.viewCount || '0'),
        likeCount: parseInt(stats.likeCount || '0'),
        commentCount: parseInt(stats.commentCount || '0'),
        tags: snippet.tags || [],
        defaultLanguage: snippet.defaultLanguage,
        defaultAudioLanguage: snippet.defaultAudioLanguage,
      };
    } catch (e) {
      console.warn('[useYouTubeApi] fetchVideoMetadata failed:', e);
      return null;
    }
  }, [apiKey, extractVideoId]);

  /**
   * Fetches metadata for a playlist.
   */
  const fetchPlaylistMetadata = useCallback(async (
    listId: string
  ) => {
    try {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        id: listId,
        key: apiKey,
      });

      const res = await fetch(`${API_BASE}/playlists?${params}`);
      if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

      const data = await res.json();
      const item = data.items?.[0];
      if (!item) return null;

      const snippet = item.snippet || {};
      const best = snippet.thumbnails?.maxres?.url
        || snippet.thumbnails?.high?.url
        || snippet.thumbnails?.medium?.url
        || snippet.thumbnails?.default?.url
        || '';

      return {
        id: listId,
        title: snippet.title || '',
        thumbnail: best,
        channelTitle: snippet.channelTitle || '',
        itemCount: item.contentDetails?.itemCount || 0
      };
    } catch (e) {
      console.warn('[useYouTubeApi] fetchPlaylistMetadata failed:', e);
      return null;
    }
  }, [apiKey]);

  /**
   * Fetches items for a playlist.
   */
  const fetchPlaylistItems = useCallback(async (
    listId: string,
    maxResults = 50
  ) => {
    try {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        playlistId: listId,
        maxResults: String(maxResults),
        key: apiKey,
      });

      const res = await fetch(`${API_BASE}/playlistItems?${params}`);
      if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

      const data = await res.json();
      return (data.items || []).map((item: any, idx: number) => {
        const snippet = item.snippet || {};
        const vId = snippet.resourceId?.videoId;
        const best = snippet.thumbnails?.high?.url
          || snippet.thumbnails?.medium?.url
          || snippet.thumbnails?.default?.url
          || '';

        return {
          id: vId,
          title: snippet.title || '',
          url: `https://www.youtube.com/watch?v=${vId}`,
          thumbnail: best,
          index: idx + 1,
        };
      });
    } catch (e) {
      console.warn('[useYouTubeApi] fetchPlaylistItems failed:', e);
      return [];
    }
  }, [apiKey]);

  /**
   * Lists available caption/subtitle tracks for a video.
   */
  const listCaptionTracks = useCallback(async (
    url: string
  ): Promise<YouTubeCaptionTrack[]> => {
    const videoId = extractVideoId(url);
    if (!videoId) return [];

    try {
      const params = new URLSearchParams({
        part: 'snippet',
        videoId,
        key: apiKey,
      });

      const res = await fetch(`${API_BASE}/captions?${params}`);
      if (res.status === 403) return [];
      if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

      const data = await res.json();
      return (data.items || []).map((item: any) => ({
        id: item.id,
        language: item.snippet?.language || '',
        name: item.snippet?.name || item.snippet?.language || '',
        trackKind: item.snippet?.trackKind || 'standard',
        isCC: item.snippet?.isCC ?? false,
        isEasyReader: item.snippet?.isEasyReader ?? false,
      }));
    } catch (e) {
      console.warn('[useYouTubeApi] listCaptionTracks failed:', e);
      return [];
    }
  }, [apiKey, extractVideoId]);

  /**
   * Searches for videos using YouTube Data API v3.
   */
  const searchVideos = useCallback(async (
    query: string,
    type: 'video' | 'playlist' = 'video',
    maxResults = 10
  ) => {
    try {
      const params = new URLSearchParams({
        part: 'snippet',
        maxResults: String(maxResults),
        q: query,
        key: apiKey,
        type,
      });

      const res = await fetch(`${API_BASE}/search?${params}`);
      if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

      const data = await res.json();
      return data.items || [];
    } catch (e) {
      console.warn('[useYouTubeApi] searchVideos failed:', e);
      return [];
    }
  }, [apiKey]);

  return {
    apiKey,
    updateApiKey,
    extractVideoId,
    extractVideoInfo,
    fetchVideoMetadata,
    fetchPlaylistMetadata,
    fetchPlaylistItems,
    listCaptionTracks,
    searchVideos,
  };
}
