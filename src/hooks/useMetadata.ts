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
  const { fetchVideoMetadata, extractVideoInfo } = useYouTubeApi();

  const getMediaMetadata = useCallback(async (url: string): Promise<MediaMetadata | null> => {
    if (!url) return null;
    if (setIsLoading) setIsLoading(true);
    
    // ── STEP 0: Fast Meta Fetch via YouTube API (if applicable) ──────────────────
    let fastMeta: Partial<MediaMetadata> | null = null;
    const { id: vId, isShort } = extractVideoInfo(url);
    const isYouTube = vId !== null;

    if (isYouTube && vId) {
      if (addLog) addLog(`⚡ [API] Fetching fast metadata for video: ${vId}...`);
      try {
        const apiMeta = await fetchVideoMetadata(url);
        if (apiMeta) {
          fastMeta = {
            id: apiMeta.id,
            title: apiMeta.title,
            thumbnail: apiMeta.thumbnail,
            uploader: apiMeta.channelTitle,
            viewCount: apiMeta.viewCount,
            duration: apiMeta.durationSeconds,
            isPlaylist: false
          };
          if (addLog) addLog(`✅ [API] Found: ${apiMeta.title}`);
        }
      } catch (e) {
        if (addLog) addLog(`ℹ️ [API] Fast metadata fetch failed, proceeding with yt-dlp...`);
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

    try {
      // ── CRITICAL FIX: Attach listeners BEFORE spawn ──────────────────
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

      if (!stdout) {
        if (stderr && addLog) addLog(`⚠️ yt-dlp stderr: ${stderr}`);
        throw new Error("No metadata returned from yt-dlp");
      }

      const json = JSON.parse(stdout);
      const isPlaylist = (json._type === 'playlist' || !!json.entries || url.includes('list=') || url.startsWith('PL'));

      let availableQualities: any[] = [];

      // For playlists, fetch representative metadata from the first entry if available
      const representativeUrl = (isPlaylist && json.entries?.[0]) 
        ? (json.entries[0].url || `https://www.youtube.com/watch?v=${json.entries[0].id}`) 
        : url;

      if (isYouTube) {
        try {
          if (addLog) addLog(isPlaylist ? `🎞️ Fetching representative qualities from first video...` : `🎞️ Fetching available qualities...`);

          // ── CRITICAL FIX: Attach listeners BEFORE spawn ──────────────────
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

            const heightMap = new Map<number, number>();
            for (const f of formats) {
              if (f.height && f.height > 0) {
                const currentSize = f.filesize || f.filesize_approx || 0;
                const existing = heightMap.get(f.height) || 0;
                if (currentSize > existing) heightMap.set(f.height, currentSize);
              }
            }

            const sortedHeights = Array.from(heightMap.keys()).filter(h => h >= 144).sort((a, b) => b - a);

            availableQualities = sortedHeights.map(h => {
              const videoSize = heightMap.get(h) || 0;
              const totalSize = videoSize + audioSize;
              const sizeStr = totalSize > 0 ? ` (~${formatBytes(totalSize)})` : '';
              return { value: `${h}p`, label: `${h}p${sizeStr}`, size: totalSize };
            });

            if (audioSize > 0) {
              availableQualities.push({
                value: 'audio',
                label: `Audio Only (MP3) (~${formatBytes(audioSize)})`,
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
            // This catches tracks that yt-dlp misses due to PO Token restrictions.
            try {
              const ytApiKey = localStorage.getItem('yt_api_key') || import.meta.env.VITE_YOUTUBE_API_KEY;
              const videoId = fmtJson.id;
              if (videoId && ytApiKey) {
                const apiBase = import.meta.env.VITE_YOUTUBE_API_BASE || 'https://www.googleapis.com/youtube/v3';
                const params = new URLSearchParams({ part: 'snippet', videoId, key: ytApiKey });
                const res = await fetch(`${apiBase}/captions?${params}`);
                if (res.ok) {
                  const captionData = await res.json();
                  const apiTracks = captionData.items || [];
                  if (apiTracks.length > 0) {
                    // Merge API tracks into the subtitles object for yt-dlp to use as reference
                    if (!json.subtitles) json.subtitles = {};
                    for (const track of apiTracks) {
                      const lang = track.snippet?.language;
                      const kind = track.snippet?.trackKind; // 'standard', 'asr', 'forced'
                      if (lang && !json.subtitles[lang]) {
                        // Mark as API-sourced so we know it might need yt-dlp's ios client
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
            { value: '1080p', label: '1080p' },
            { value: '720p',  label: '720p' },
            { value: '480p',  label: '480p' },
            { value: 'audio', label: 'Audio Only' }
          ];
        }
      }

      if (setIsLoading) setIsLoading(false);

      // ── Combine everything into the final result ───────────────────────
      const manualSubs = json.subtitles || {};
      const autoSubs = json.automatic_captions || {};
      const videoLang = json.language || 'en';

      const subs: any[] = [];
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

      const sortedSubtitles = subs.sort((a, b) => {
        const order = { 'manual': 0, 'auto': 1, 'translated': 2 };
        const aOrder = order[a.type as keyof typeof order] ?? 3;
        const bOrder = order[b.type as keyof typeof order] ?? 3;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });

      return {
        id: json.id || fastMeta?.id,
        title: json.title || fastMeta?.title || (isPlaylist ? 'Playlist' : 'Unknown Video'),
        thumbnail: json.thumbnail || fastMeta?.thumbnail || (json.entries?.[0]?.thumbnail) || '',
        isPlaylist,
        isShort: isShort || url.includes('/shorts/'),
        entries: json.entries?.map((e: any, idx: number) => ({
          id: e.id,
          title: e.title,
          url: e.url || `https://www.youtube.com/watch?v=${e.id}`,
          thumbnail: e.thumbnail || '',
          index: idx + 1,
          duration: e.duration
        })),
        formats: json.formats || [],
        availableQualities: availableQualities.length > 0 ? availableQualities : undefined,
        availableSubtitles: sortedSubtitles.length > 0 ? sortedSubtitles : undefined,
        requestedVideoId: requestedVideoId || (json._type === 'url' ? json.id : undefined),
        requestedIndex: requestedIndex || json.playlist_index,
        duration: json.duration || fastMeta?.duration,
        uploader: json.uploader || fastMeta?.uploader,
        viewCount: json.view_count || fastMeta?.viewCount,
        uploadDate: json.upload_date
      };
    } catch (error: any) {
      if (addLog) addLog(`❌ Metadata error: ${error.message || error}`);
      return null;
    } finally {
      if (setIsLoading) setIsLoading(false);
    }
  }, [addLog, setIsLoading, stopRequestedRef, activeProcessesRef, extractVideoInfo, fetchVideoMetadata]);

  return { getMediaMetadata };
}
