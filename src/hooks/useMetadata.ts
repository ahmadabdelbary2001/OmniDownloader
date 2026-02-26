import { useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { MediaMetadata } from '../types/downloader';
import { formatBytes } from '../lib/utils';

interface UseMetadataOptions {
  addLog?: (msg: string) => void;
  setIsLoading?: (loading: boolean) => void;
  stopRequestedRef?: React.MutableRefObject<boolean>;
  activeProcessesRef?: React.MutableRefObject<Map<string, any>>;
}

export function useMetadata({ addLog, setIsLoading, stopRequestedRef, activeProcessesRef }: UseMetadataOptions = {}) {

  const getMediaMetadata = useCallback(async (url: string): Promise<MediaMetadata | null> => {
    if (!url) return null;
    if (setIsLoading) setIsLoading(true);
    if (addLog) addLog(`🔍 Fetching metadata for: ${url}`);

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
      const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');

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

      const metadata: MediaMetadata = {
        id: json.id,
        title: json.title || (isPlaylist ? "Playlist" : "Unknown Title"),
        thumbnail: json.thumbnail || (json.thumbnails?.[0]?.url) || (json.entries?.[0]?.thumbnail) || "",
        isPlaylist,
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
        uploader: json.uploader,
        viewCount: json.view_count,
        uploadDate: json.upload_date,
      };

      if (isPlaylist) {
        metadata.entries = (json.entries || []).map((entry: any, idx: number) => ({
          index: entry.playlist_index || entry.index || (idx + 1),
          id: entry.id,
          title: entry.title,
          url: entry.url || entry.webpage_url,
          thumbnail: entry.thumbnail || (entry.thumbnails?.[0]?.url) || "",
          duration: entry.duration // Capture per-entry duration
        }));
      }

      metadata.duration = json.duration; // Set root duration (single video or playlist duration if available)

      return metadata;
    } catch (error: any) {
      if (addLog) addLog(`❌ Metadata error: ${error.message || error}`);
      return null;
    } finally {
      if (setIsLoading) setIsLoading(false);
    }
  }, [addLog, setIsLoading, stopRequestedRef, activeProcessesRef]);

  return { getMediaMetadata };
}
