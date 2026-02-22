import { useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { MediaMetadata } from '../types/downloader';

interface UseLinkAnalyzerOptions {
  addLog: (msg: string) => void;
  setIsLoading: (loading: boolean) => void;
  getMediaMetadata: (url: string) => Promise<MediaMetadata | null>;
  stopRequestedRef: React.MutableRefObject<boolean>;
  activeProcessesRef: React.MutableRefObject<Map<string, any>>;
}

export function useLinkAnalyzer({
  addLog,
  setIsLoading,
  getMediaMetadata,
  stopRequestedRef,
  activeProcessesRef
}: UseLinkAnalyzerOptions) {

  const analyzeLink = useCallback(async (urlInput: string) => {
    if (!urlInput) return null;
    let url = urlInput.trim();

    if (!url.startsWith('http') && (url.startsWith('PL') || url.startsWith('UU') || url.startsWith('LL')) && url.length >= 10) {
      addLog(`✨ Detected YouTube Playlist ID - Formatting URL...`);
      url = `https://www.youtube.com/playlist?list=${url}`;
    }

    setIsLoading(true);
    addLog(`🔍 Deep analyzing link: ${url}`);
    
    try {
      if (url.includes('bigtitbitches.com')) {
        addLog("✨ Detected special site - Extracting source...");
        const btbCmd = Command.sidecar("wget", ["-q", "-O", "-", url]);
        const btbChild = await btbCmd.spawn();
        activeProcessesRef.current.set("analysis", btbChild);

        let btbStdout = '';
        btbCmd.stdout.on('data', (data: string) => {
          if (stopRequestedRef.current) return;
          btbStdout += data;
        });

        const btbCompletion = new Promise<{ code: number | null }>((resolve) => {
          btbCmd.on('close', (data) => {
              activeProcessesRef.current.delete("analysis");
              resolve(data);
          });
        });
        await btbCompletion;

        const btbHtml = btbStdout;
        const iframeMatch = btbHtml.match(/iframe.*?src="(https:\/\/fuqster\.com\/embed\/\d+)"/);
        if (!iframeMatch) throw new Error("Embed iframe not found");
        
        const embedUrl = iframeMatch[1];
        const embedCmd = Command.sidecar("wget", ["-q", "-O", "-", embedUrl]);
        const embedChild = await embedCmd.spawn();
        activeProcessesRef.current.set("analysis", embedChild);

        let embedStdout = '';
        embedCmd.stdout.on('data', (data: string) => {
          if (stopRequestedRef.current) return;
          embedStdout += data;
        });

        const embedCompletion = new Promise<{ code: number | null }>((resolve) => {
          embedCmd.on('close', (data) => {
              activeProcessesRef.current.delete("analysis");
              resolve(data);
          });
        });
        await embedCompletion;

        const embedHtml = embedStdout;
        const videoUrlMatch = embedHtml.match(/video_url:\s*'(https:\/\/fuqster\.com\/get_file\/.*?)'/);
        if (!videoUrlMatch) throw new Error("Direct video URL not found");
        
        addLog("✅ successfully extracted direct URL!");
        return { directUrl: videoUrlMatch[1], embedUrl, isPlaylist: false };
      }
      
      const meta = await getMediaMetadata(url);
      
      let embedUrl: string | null = null;
      if (meta && !meta.isPlaylist) {
          if (url.includes('youtube.com') || url.includes('youtu.be')) {
              const videoId = meta.id || meta.requestedVideoId;
              if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
          }
      }

      return { 
        directUrl: url, 
        embedUrl: embedUrl, 
        isPlaylist: meta?.isPlaylist || false,
        metadata: meta 
      };
    } catch (e) {
      addLog(`❌ Extraction failed: ${e}`);
      return null;
    } finally {
      setIsLoading(false);
      activeProcessesRef.current.delete("analysis");
    }
  }, [addLog, setIsLoading, getMediaMetadata, stopRequestedRef, activeProcessesRef]);

  return { analyzeLink };
}
