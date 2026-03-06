import { useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { MediaMetadata } from '../types/downloader';
import { formatBytes } from '../lib/utils';
import { useYouTubeApi } from './useYouTubeApi';

interface UseMetadataOptions {
  addLog?: (msg: string) => void;
  setIsLoading?: (loading: boolean) => void;
  stopRequestedRef?: React.MutableRefObject<boolean>;
  activeProcessesRef?: React.MutableRefObject<Map<string, any>>;
}

export function parseYtdlpOutput(json: any, url: string, fastMeta?: Partial<MediaMetadata>): MediaMetadata {
  const isPlaylist = (json._type === 'playlist' || !!json.entries || url.includes('list=') || url.startsWith('PL'));
  
  let availableQualities: any[] = [];
  const formats: any[] = json.formats || [];

  const audioFormats = formats.filter(f => f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
  const bestAudio = audioFormats.sort((a, b) => (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0))[0];
  const audioSize = bestAudio ? (bestAudio.filesize || bestAudio.filesize_approx || 0) : 0;

  const heightMap = new Map<number, { size: number; note: string; fps?: number }>();
  for (const f of formats) {
    if (f.height && f.height > 0) {
      const currentSize = f.filesize || f.filesize_approx || 0;
      const existing = heightMap.get(f.height);
      if (!existing || currentSize > existing.size) {
        heightMap.set(f.height, { 
          size: currentSize, 
          note: f.format_note || '', 
          fps: f.fps 
        });
      }
    }
  }

  const sortedHeights = Array.from(heightMap.keys()).filter(h => h >= 144).sort((a, b) => b - a);

  availableQualities = sortedHeights.map(h => {
    const info = heightMap.get(h)!;
    const totalSize = info.size + audioSize;
    
    let label = `${h}p`;
    if (h >= 2160) label = `4K ${h}p`;
    else if (h >= 1440) label = `2K ${h}p`;
    else if (h >= 1080) label = `FHD ${h}p`;
    else if (h >= 720) label = `HD ${h}p`;
    
    const suffixes: string[] = [];
    if (info.fps && info.fps > 30) suffixes.push(`${info.fps}fps`);
    if (info.note?.toUpperCase().includes('HDR')) suffixes.push('HDR');
    
    const finalLabel = suffixes.length > 0 ? `${label} (${suffixes.join(' ')})` : label;
    const sizeStr = totalSize > 0 ? ` (~${formatBytes(totalSize)})` : '';

    return { value: `${h}p`, label: `${finalLabel}${sizeStr}`, size: totalSize };
  });

  if (audioSize > 0) {
    availableQualities.push({
      value: 'audio',
      label: `🎵 Audio Only (MP3) (~${formatBytes(audioSize)})`,
      size: audioSize
    });
  }

  availableQualities = [
    { value: 'best', label: '🚀 Best Available', size: 0 },
    ...availableQualities
  ];

  const metadata: MediaMetadata = {
    id: json.id || fastMeta?.id,
    title: json.title || json.fulltitle || json.entry_title || fastMeta?.title || (isPlaylist ? "Playlist" : "Unknown Title"),
    thumbnail: json.thumbnail || 
               (json.thumbnails && json.thumbnails.length > 0 ? json.thumbnails[json.thumbnails.length - 1].url : "") || 
               (json.entries && json.entries.length > 0 && json.entries[0].thumbnail ? json.entries[0].thumbnail : "") ||
               fastMeta?.thumbnail || "",
    isPlaylist,
    isShort: url.includes('/shorts/') || json.is_short,
    formats: json.formats || [],
    availableQualities: availableQualities.length > 2 ? availableQualities : undefined,
    requestedIndex: json.playlist_index,
    requestedVideoId: (json._type === 'url' ? json.id : undefined),
    availableSubtitles: (() => {
      const subs: any[] = [];
      const manualSubs = json.subtitles || {};
      const autoSubs = json.automatic_captions || {};
      const videoLang = json.language || 'en';

      for (const [lang, formats] of Object.entries(manualSubs)) {
        const typedFormats = formats as any[];
        const name = typedFormats.find(f => f.name)?.name || lang;
        subs.push({ lang, name, type: 'manual' });
      }

      for (const [lang, formats] of Object.entries(autoSubs)) {
        if (subs.find(s => s.lang === lang)) continue;
        const typedFormats = formats as any[];
        const name = typedFormats.find(f => f.name)?.name || lang;
        const isOriginal = lang.toLowerCase() === videoLang.toLowerCase() || lang.split('-')[0] === videoLang.split('-')[0];
        
        subs.push({ 
          lang, 
          name: `${name}${isOriginal ? ' (Original Auto)' : ' (Auto Translate)'}`, 
          type: isOriginal ? 'auto' : 'translated',
          isOriginal
        });
      }

      return subs.length > 0 ? subs.sort((a, b) => {
        const order = { 'manual': 0, 'auto': 1, 'translated': 2 };
        const aOrder = order[a.type as keyof typeof order] ?? 3;
        const bOrder = order[b.type as keyof typeof order] ?? 3;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      }) : undefined;
    })(),
    uploader: json.uploader || json.channel || fastMeta?.uploader,
    viewCount: json.view_count || fastMeta?.viewCount,
    uploadDate: json.upload_date,
    duration: json.duration || fastMeta?.duration
  };

  if (isPlaylist) {
    metadata.entries = (json.entries || []).map((entry: any, idx: number) => ({
      index: entry.playlist_index || entry.index || (idx + 1),
      id: entry.id,
      title: entry.title,
      url: entry.url || entry.webpage_url || `https://www.youtube.com/watch?v=${entry.id}`,
      thumbnail: entry.thumbnail || (entry.thumbnails?.[0]?.url) || "",
      duration: entry.duration
    }));
  }

  return metadata;
}

const metadataCache = new Map<string, { data: MediaMetadata, timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function useMetadata({ addLog, setIsLoading, stopRequestedRef, activeProcessesRef }: UseMetadataOptions = {}) {
  const { 
    fetchVideoMetadata, 
    fetchPlaylistMetadata, 
    fetchPlaylistItems, 
    extractVideoInfo 
  } = useYouTubeApi();

  const getMediaMetadata = useCallback(async (url: string): Promise<MediaMetadata | null> => {
    if (!url) return null;

    // Phase 55: Frontend Cache Check 🧠
    const cached = metadataCache.get(url);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`[Omni] Frontend Cache HIT for: ${url}`);
      return cached.data;
    }
    if (setIsLoading) setIsLoading(true);
    
    try {
      // ── STEP 0: Parallel Fast Meta Fetch via YouTube API ──────────────────
      let fastMeta: Partial<MediaMetadata> | null = null;
      const { id: vId, isShort, listId } = extractVideoInfo(url);
      const isYouTube = vId !== null || listId !== null;

      let apiVideo: any = null;
      let apiPlaylist: any = null;
      let apiEntries: any[] = [];

      if (isYouTube) {
        if (addLog) addLog(`⚡ [Discovery] Fetching fast metadata via YouTube API...`);
        try {
          const promises: Promise<any>[] = [];
          if (vId) promises.push(fetchVideoMetadata(url).then(m => { apiVideo = m; }));
          if (listId) promises.push(fetchPlaylistMetadata(listId).then(m => { apiPlaylist = m; }));
          
          await Promise.all(promises);

          if (apiPlaylist && listId) {
            apiEntries = await fetchPlaylistItems(listId);
          }

          const isActualPlaylist = !!apiPlaylist || (!!vId && !!listId);

          if (apiVideo || apiPlaylist) {
            fastMeta = {
              id: vId || listId || '',
              title: apiPlaylist?.title || apiVideo?.title || 'Unknown',
              thumbnail: apiVideo?.thumbnail || apiPlaylist?.thumbnail || '',
              uploader: apiVideo?.channelTitle || apiPlaylist?.channelTitle,
              viewCount: apiVideo?.viewCount,
              duration: apiVideo?.durationSeconds,
              isPlaylist: isActualPlaylist,
              isShort
            };
            if (addLog) addLog(`✅ [API] Identity found: ${fastMeta.title}`);
          }
        } catch (e) {
          if (addLog) addLog(`ℹ️ [API] Discovery failed, will use yt-dlp fallback...`);
        }
      }

      if (addLog) addLog(`🔍 Deep analyzing link: ${url}`);

      let requestedVideoId: string | undefined;
      let requestedIndex: number | undefined;

      try {
        const urlObj = new URL(url);
        requestedVideoId = urlObj.searchParams.get('v') || undefined;
        const idxStr = urlObj.searchParams.get('index');
        if (idxStr) requestedIndex = parseInt(idxStr);
      } catch (e) {}

      let json: any = { id: vId || listId };
      let isPlaylist = fastMeta?.isPlaylist || false;

      // ── STEP 1: Discovery Scan Bypass ──────────────────
      const skipDiscovery = isYouTube && ( (!listId && vId) || (listId && apiEntries.length > 0) );

      if (!skipDiscovery) {
        try {
          const cmd = Command.sidecar("ytdlp", [
            "--js-runtimes", "node",
            "--dump-single-json",
            "--flat-playlist",
            "--no-download",
            "--no-check-certificate",
            url
          ]);

          let stdout = '';
          cmd.stdout.on('data', (d) => { stdout += d; });

          const child = await cmd.spawn();
          if (activeProcessesRef) activeProcessesRef.current.set("metadata", child);

          await new Promise(r => cmd.on('close', r));
          if (activeProcessesRef) activeProcessesRef.current.delete("metadata");

          if (stdout) {
            json = JSON.parse(stdout);
          } else if (!isYouTube) {
            throw new Error("No metadata returned from yt-dlp");
          }
        } catch (discoveryErr) {
          if (!isYouTube) throw discoveryErr;
        }
      } else {
        if (apiVideo) {
          json = { ...apiVideo, _type: 'video' };
        } else if (apiPlaylist) {
          json = { ...apiPlaylist, _type: 'playlist', entries: apiEntries };
        }
      }

      // ── STEP 2: Universal Quality Extraction ───────────────────
      let representativeUrl = (isPlaylist && json.entries?.[0]) 
        ? (json.entries[0].url || `https://www.youtube.com/watch?v=${json.entries[0].id}`) 
        : url;
      
      // Phase 63: Fast Meta 🚀 - Strip playlist params if it's a YouTube watch link
      if (representativeUrl.includes('youtube.com/watch')) {
        try {
          const u = new URL(representativeUrl);
          if (u.searchParams.has('list')) {
            u.searchParams.delete('list');
            u.searchParams.delete('index');
            representativeUrl = u.toString();
          }
        } catch(e) {}
      }

      if (addLog) addLog(isPlaylist ? `🎞️ Fetching representative qualities from first video...` : `🎞️ Fetching available qualities...`);

      const fmtCmd = Command.sidecar("ytdlp", [
        "--js-runtimes", "node",
        "--dump-single-json",
        "--no-playlist", // Force single video analysis
        "--no-download",
        "--no-check-certificate",
        representativeUrl
      ]);
      let fmtStdout = '';
      fmtCmd.stdout.on('data', (d: string) => { fmtStdout += d; });

      await fmtCmd.spawn();
      await new Promise(r => fmtCmd.on('close', r));

      if (fmtStdout) {
        const fmtJson = JSON.parse(fmtStdout);
        
        // Enrichment
        json.formats = fmtJson.formats;
        json.subtitles = fmtJson.subtitles;
        json.automatic_captions = fmtJson.automatic_captions;
        json.language = fmtJson.language;
        json.duration = fmtJson.duration;

        // API Caption Enrichment
        try {
          const ytApiKey = localStorage.getItem('yt_api_key') || import.meta.env.VITE_YOUTUBE_API_KEY;
          if (representativeUrl.includes('youtube') && fmtJson.id && ytApiKey) {
            const res = await fetch(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${fmtJson.id}&key=${ytApiKey}`);
            if (res.ok) {
              const data = await res.json();
              if (data.items?.length > 0) {
                if (!json.subtitles) json.subtitles = {};
                data.items.forEach((item: any) => {
                  const lang = item.snippet.language;
                  if (lang && !json.subtitles[lang]) {
                    json.subtitles[lang] = [{ ext: 'srt', name: item.snippet.name || lang }];
                  }
                });
                if (addLog) addLog(`📡 [API] Found ${data.items.length} caption track(s) via YouTube API`);
              }
            }
          }
        } catch (e) {}
      }

      const metadata = parseYtdlpOutput(json, url, fastMeta || undefined);
      metadata.requestedIndex = requestedIndex || metadata.requestedIndex;
      metadata.requestedVideoId = requestedVideoId || metadata.requestedVideoId;

      if (addLog) {
        const count = (metadata.availableQualities?.length || 1) - 1;
        addLog(metadata.isPlaylist 
          ? `✅ Representative qualities found: ${count}` 
          : `✅ Available qualities: ${count} found.`);
      }

      if (metadata) {
        metadataCache.set(url, { data: metadata, timestamp: Date.now() });
      }

      return metadata;
    } catch (error: any) {
      if (addLog) addLog(`❌ Metadata error: ${error.message || error}`);
      return null;
    } finally {
      if (setIsLoading) setIsLoading(false);
    }
  }, [addLog, setIsLoading, stopRequestedRef, activeProcessesRef, extractVideoInfo, fetchVideoMetadata, fetchPlaylistMetadata, fetchPlaylistItems]);

  return { getMediaMetadata };
}
