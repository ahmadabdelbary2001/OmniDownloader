import { useState, useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { toast } from "sonner";
import { SearchResult } from '../types/downloader';

const YT_API_BASE = import.meta.env.VITE_YOUTUBE_API_BASE;
const DEFAULT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getApiKey(): string {
  return localStorage.getItem('yt_api_key') || DEFAULT_API_KEY;
}

function formatDuration(iso: string): string {
  const match = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 'N/A';
  const h = parseInt(match[1] || '0');
  const m = parseInt(match[2] || '0');
  const s = parseInt(match[3] || '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildUrl(item: any, isShort: boolean = false): string {
  const kind = item.id?.kind;
  if (kind === 'youtube#video') {
    const id = item.id.videoId;
    return isShort ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
  }
  if (kind === 'youtube#playlist') return `https://www.youtube.com/playlist?list=${item.id.playlistId}`;
  return '';
}

// ── Main search via YouTube Data API v3 ──────────────────────────────────────

async function searchViaApi(
  query: string,
  type: 'video' | 'playlist' | 'videoShort' | '',
  maxResults = 10,
  addLog?: (msg: string) => void
): Promise<SearchResult[]> {
  const apiKey = getApiKey();

  // For shorts: search for videos + filter by duration
  const searchType = (type === 'videoShort') ? 'video' : (type || 'video');
  const videoDuration = (type === 'videoShort') ? 'short' : undefined;

  const params = new URLSearchParams({
    part: 'snippet',
    q: type === 'videoShort' ? `${query} #shorts` : query,
    maxResults: String(maxResults),
    key: apiKey,
    type: searchType,
    ...(videoDuration ? { videoDuration } : {}),
  });

  const searchRes = await fetch(`${YT_API_BASE}/search?${params}`);
  if (!searchRes.ok) throw new Error(`YouTube API /search error: ${searchRes.status}`);

  const searchData = await searchRes.json();
  const items = searchData.items || [];
  if (items.length === 0) return [];

  // Batch-fetch video durations for video results
  let durationMap: Record<string, string> = {};
  const videoIds = items
    .filter((it: any) => it.id?.kind === 'youtube#video')
    .map((it: any) => it.id.videoId)
    .join(',');

  if (videoIds) {
    const detailParams = new URLSearchParams({
      part: 'contentDetails',
      id: videoIds,
      key: apiKey,
    });
    const detailRes = await fetch(`${YT_API_BASE}/videos?${detailParams}`);
    if (detailRes.ok) {
      const detailData = await detailRes.json();
      for (const v of (detailData.items || [])) {
        durationMap[v.id] = formatDuration(v.contentDetails?.duration || '');
      }
    }
  }

  const results: SearchResult[] = items
    .map((item: any) => {
      const videoId = item.id?.videoId;
      const listId  = item.id?.playlistId;
      const id = videoId || listId || '';
      
      // Check if it's a short based on search type OR duration (if < 60s and video)
      const isShortResult = type === 'videoShort';
      const url = buildUrl(item, isShortResult);
      if (!url) return null;

      const thumbnail = item.snippet?.thumbnails?.high?.url
        || item.snippet?.thumbnails?.medium?.url
        || item.snippet?.thumbnails?.default?.url
        || '';

      return {
        id,
        title:       item.snippet?.title || '',
        thumbnail,
        duration:    videoId ? (durationMap[videoId] || 'N/A') : 'Playlist',
        webpage_url: url,
        channelTitle: item.snippet?.channelTitle,
        publishedAt:  item.snippet?.publishedAt,
      } as SearchResult;
    })
    .filter(Boolean) as SearchResult[];

  if (addLog) addLog(`⚡ [API] Found ${results.length} result(s) via YouTube API`);
  return results;
}

// ── Fallback: yt-dlp search ───────────────────────────────────────────────────

function searchViaYtDlp(
  query: string,
  type: string,
  setSearchResults: React.Dispatch<React.SetStateAction<SearchResult[]>>,
  stopRequestedRef?: React.MutableRefObject<boolean>,
  addLog?: (msg: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      let ytdlpQuery: string;
      if (type === 'playlist')   ytdlpQuery = `ytsearchplaylist10:${query}`;
      else if (type === 'videoShort') ytdlpQuery = `ytsearch10:${query} #shorts`;
      else                       ytdlpQuery = `ytsearch10:${query}`;

      const cmd = Command.sidecar("ytdlp", [
        "--js-runtimes", "node",
        ytdlpQuery,
        "--dump-json",
        "--no-download"
      ]);

      cmd.stdout.on('data', (data: string) => {
        if (stopRequestedRef?.current) return;
        const lines = data.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const isShortUrl = json.webpage_url?.includes('/shorts/');
            if (type === 'videoShort' && !isShortUrl) continue;
            if (type === 'video' && isShortUrl) continue;

            const dur = json.duration;
            const formattedDur = dur
              ? `${Math.floor(dur / 60)}:${(dur % 60).toString().padStart(2, '0')}`
              : 'N/A';

            let webpage_url = json.webpage_url;
            if (type === 'videoShort' && !webpage_url.includes('/shorts/')) {
              webpage_url = `https://www.youtube.com/shorts/${json.id}`;
            }

            setSearchResults(prev => {
              if (prev.find(item => item.id === json.id)) return prev;
              return [...prev, {
                id: json.id,
                title: json.title,
                thumbnail: json.thumbnail,
                duration: formattedDur,
                webpage_url
              }];
            });
          } catch (e) {
            console.error("JSON parse error:", e);
          }
        }
      });

      cmd.on('close', () => resolve());
      cmd.spawn().then(() => {
        if (addLog) addLog("🔄 [yt-dlp] Fallback search running...");
      }).catch(reject);
    } catch (e) {
      reject(e);
    }
  });
}

// ── Hook ───────────────────────────────────────────────────────────────────────

interface UseSearchOptions {
  addLog?: (msg: string) => void;
  stopRequestedRef?: React.MutableRefObject<boolean>;
}

export function useSearch({ addLog, stopRequestedRef }: UseSearchOptions = {}) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const handleSearch = useCallback(async (query: string, type: string = 'video') => {
    if (!query) return;
    setIsSearching(true);
    setSearchResults([]);
    if (addLog) addLog(`🔎 Searching: "${query}" [${type}]`);

    let apiSucceeded = false;

    // ── Strategy 1: YouTube Data API (fast, instant results) ─────────────────
    try {
      const apiResults = await searchViaApi(query, type as any, 10, addLog);
      if (apiResults.length > 0) {
        setSearchResults(apiResults);
        apiSucceeded = true;
      } else {
        if (addLog) addLog(`ℹ️ [API] No results returned — trying yt-dlp fallback...`);
      }
    } catch (apiErr: any) {
      if (addLog) addLog(`⚠️ [API] Failed (${apiErr.message}) — falling back to yt-dlp...`);
    }

    // ── Strategy 2: yt-dlp fallback (if API failed or returned nothing) ──────
    if (!apiSucceeded) {
      try {
        await searchViaYtDlp(query, type, setSearchResults, stopRequestedRef, addLog);
        if (addLog) addLog(`✅ yt-dlp search completed.`);
      } catch (ytdlpErr: any) {
        toast.error("Search failed");
        if (addLog) addLog(`❌ yt-dlp fallback error: ${ytdlpErr.message || ytdlpErr}`);
      }
    }

    setIsSearching(false);
  }, [addLog, stopRequestedRef]);

  return {
    isSearching,
    searchResults,
    setSearchResults,
    handleSearch
  };
}
