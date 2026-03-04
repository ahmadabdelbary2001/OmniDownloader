import { useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { downloadDir } from '@tauri-apps/api/path';
import { MediaMetadata } from '../types/downloader';
import { formatBytes } from '../lib/utils';
import { useYouTubeApi } from './useYouTubeApi';

interface UseMetadataOptions {
  addLog?: (msg: string) => void;
  setIsLoading?: (loading: boolean) => void;
  stopRequestedRef?: React.MutableRefObject<boolean>;
  activeProcessesRef?: React.MutableRefObject<Map<string, any>>;
}

export function useMetadata({ addLog, setIsLoading, stopRequestedRef, activeProcessesRef }: UseMetadataOptions = {}) {
  const { 
    fetchVideoMetadata, 
    fetchPlaylistMetadata, 
    fetchPlaylistItems, 
    extractVideoInfo 
  } = useYouTubeApi();

  const getMediaMetadata = useCallback(async (url: string): Promise<MediaMetadata | null> => {
    if (!url) return null;
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
      // If it's a single video, skip discovery and go to quality scan.
      // If it's a playlist and we have API entries, skip discovery.
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
          let stderr = '';

          cmd.stdout.on('data', (data: string) => {
            if (stopRequestedRef?.current) return;
            stdout += data;
          });
          cmd.stderr.on('data', (data: string) => {
            if (stopRequestedRef?.current) return;
            stderr += data;
          });

          const completion = new Promise<{ code: number | null }>((resolve) => {
            cmd.on('close', (data) => resolve(data));
          });

          const child = await cmd.spawn();
          if (activeProcessesRef) activeProcessesRef.current.set("metadata", child);

          await completion;
          if (activeProcessesRef) activeProcessesRef.current.delete("metadata");

          if (stdout) {
            json = JSON.parse(stdout);
            isPlaylist = (json._type === 'playlist' || !!json.entries || url.includes('list=') || url.startsWith('PL'));
          } else if (!isYouTube) {
            if (stderr && addLog) addLog(`⚠️ yt-dlp stderr: ${stderr}`);
            throw new Error("No metadata returned from yt-dlp");
          }
        } catch (discoveryErr) {
          if (!isYouTube) throw discoveryErr;
        }
      } else {
        // Use API-sourced data as our 'json' baseline for discovery
        if (apiVideo) {
          json = { ...apiVideo, _type: 'video' };
        } else if (apiPlaylist) {
          json = { ...apiPlaylist, _type: 'playlist', entries: apiEntries };
        }
      }

      let availableQualities: any[] = [];

      // For playlists, fetch representative metadata from the first entry if available
      const representativeUrl = (isPlaylist && json.entries?.[0]) 
        ? (json.entries[0].url || `https://www.youtube.com/watch?v=${json.entries[0].id}`) 
        : url;

      // ── STEP 2: Universal Quality Extraction ───────────────────
      // We no longer restrict this to YouTube. If we have a URL, we try to discover specific formats/sizes.
      try {
        if (addLog) addLog(isPlaylist ? `🎞️ Fetching representative qualities from first video...` : `🎞️ Fetching available qualities...`);

        // ── CRITICAL: Attach listeners BEFORE spawn ──────────────────
        const fmtCmd = Command.sidecar("ytdlp", [
          "--js-runtimes", "node",
          "--dump-single-json",
          "--no-download",
          "--no-check-certificate",
          representativeUrl
        ]);
        let fmtStdout = '';
        fmtCmd.stdout.on('data', (d: string) => { fmtStdout += d; });

        const fmtClose = new Promise<void>(resolve => {
          fmtCmd.on('close', () => resolve());
        });

        await fmtCmd.spawn();
        await fmtClose;

        if (fmtStdout) {
          const fmtJson = JSON.parse(fmtStdout);

          // ── SAVE RAW JSON for user exploration ───────────────────
          try {
            const dDir = await downloadDir();
            const videoId = fmtJson.id || 'unknown';
            const sanitizedId = videoId.replace(/[^a-zA-Z0-9_-]/g, '_');
            const dumpPath = `${dDir}yt-dlp-metadata-${sanitizedId}.json`;
            await writeTextFile(dumpPath, JSON.stringify(fmtJson, null, 2));
            if (addLog) addLog(`📄 [JSON] Saved: yt-dlp-metadata-${sanitizedId}.json → ${dDir}`);
          } catch (dumpErr) {
            if (addLog) addLog(`⚠️ [JSON] Could not save metadata dump: ${dumpErr}`);
          }

          const formats: any[] = fmtJson.formats || [];

          const audioFormats = formats.filter(f => f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
          const bestAudio = audioFormats.sort((a, b) => (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0))[0];
          const audioSize = bestAudio ? (bestAudio.filesize || bestAudio.filesize_approx || 0) : 0;

          // HeightMap stores size, note, and fps to build rich labels
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
            const sizeStr = totalSize > 0 ? ` (~${formatBytes(totalSize)})` : '';
            
            let label = `${h}p`;
            if (h >= 2160) label = `4K ${h}p`;
            else if (h >= 1440) label = `2K ${h}p`;
            else if (h >= 1080) label = `FHD ${h}p`;
            else if (h >= 720) label = `HD ${h}p`;
            
            const suffixes: string[] = [];
            if (info.fps && info.fps > 30) suffixes.push(`${info.fps}fps`);
            if (info.note?.toUpperCase().includes('HDR')) suffixes.push('HDR');
            
            const finalLabel = suffixes.length > 0 ? `${label} (${suffixes.join(' ')})` : label;

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

          if (addLog) {
            const count = availableQualities.length - 1;
            addLog(isPlaylist 
              ? `✅ Representative qualities found: ${count}` 
              : `✅ Available qualities: ${count} found.`);
          }

          // Also extract subtitles from the representative JSON for the metadata object
          json.subtitles = fmtJson.subtitles;
          json.automatic_captions = fmtJson.automatic_captions;
          json.language = fmtJson.language;
          json.duration = fmtJson.duration; // Capture representative duration

          // ── YOUTUBE API ENRICHMENT: Fetch caption tracks via YouTube Data API v3
          try {
            const ytApiKey = localStorage.getItem('yt_api_key') || import.meta.env.VITE_YOUTUBE_API_KEY;
            const videoId = fmtJson.id;
            const isYouTube = representativeUrl.includes('youtube.com') || representativeUrl.includes('youtu.be');
            
            if (isYouTube && videoId && ytApiKey) {
              const apiBase = import.meta.env.VITE_YOUTUBE_API_BASE || 'https://www.googleapis.com/youtube/v3';
              const params = new URLSearchParams({ part: 'snippet', videoId, key: ytApiKey });
              const res = await fetch(`${apiBase}/captions?${params}`);
              if (res.ok) {
                const captionData = await res.json();
                const apiTracks = captionData.items || [];
                if (apiTracks.length > 0) {
                  if (!json.subtitles) json.subtitles = {};
                  for (const track of apiTracks) {
                    const lang = track.snippet?.language;
                    const kind = track.snippet?.trackKind;
                    if (lang && !json.subtitles[lang]) {
                      json.subtitles[lang] = [{ 
                        ext: 'srt', 
                        name: track.snippet?.name || lang,
                        _source: 'youtube_api',
                        _kind: kind
                      }];
                    }
                  }
                  if (addLog) addLog(`📡 [API] Found ${apiTracks.length} caption track(s) via YouTube API`);
                }
              }
            }
          } catch (apiErr) {}
        }
      } catch (e) {
        if (addLog) addLog(`⚠️ Could not fetch available qualities: ${e}`);
        availableQualities = [
          { value: 'best', label: '🚀 Best Available' },
          { value: '1080p', label: '💎 1080p Full HD' },
          { value: '720p',  label: '✨ 720p HD' },
          { value: '480p',  label: '📱 480p SD' },
          { value: 'audio', label: '🎵 Audio Only (MP3)' }
        ];
      }

      const metadata: MediaMetadata = {
        id: json.id || fastMeta?.id,
        title: json.title || fastMeta?.title || (isPlaylist ? "Playlist" : "Unknown Title"),
        thumbnail: json.thumbnail || fastMeta?.thumbnail || (json.thumbnails?.[0]?.url) || (json.entries?.[0]?.thumbnail) || "",
        isPlaylist,
        isShort: isShort || url.includes('/shorts/'),
        formats: json.formats || [],
        availableQualities: availableQualities.length > 0 ? availableQualities : undefined,
        requestedIndex: requestedIndex || json.playlist_index,
        requestedVideoId: requestedVideoId || (json._type === 'url' ? json.id : undefined),
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
        uploader: json.uploader || fastMeta?.uploader,
        viewCount: json.view_count || fastMeta?.viewCount,
        uploadDate: json.upload_date,
      };

      if (isPlaylist) {
        metadata.entries = (json.entries || []).map((entry: any, idx: number) => ({
          index: entry.playlist_index || entry.index || (idx + 1),
          id: entry.id,
          title: entry.title,
          url: entry.url || entry.webpage_url || `https://www.youtube.com/watch?v=${entry.id}`,
          thumbnail: entry.thumbnail || (entry.thumbnails?.[0]?.url) || "",
          duration: entry.duration // Capture per-entry duration
        }));
      }

      metadata.duration = json.duration || fastMeta?.duration; // Set root duration

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
