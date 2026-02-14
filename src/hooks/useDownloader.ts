import { useState, useCallback, useRef, useEffect } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { path } from '@tauri-apps/api';
import { toast } from "sonner";
import { SearchResult, DownloadService, DownloadOptions, MediaMetadata } from '../types/downloader';

export function useDownloader() {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isStopDisabled, setIsStopDisabled] = useState(true);
  const activeProcessRef = useRef<any>(null);
  const stopRequestedRef = useRef<boolean>(false);
  
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, msg].slice(-1000));
  }, []);

  const parseProgress = (line: string) => {
    const match = line.match(/(\d+\.?\d*)%/);
    return match ? parseFloat(match[1]) : null;
  };

  const handleSearch = async (query: string) => {
    if (!query) return;
    setIsSearching(true);
    setSearchResults([]);
    addLog(`🔎 Searching for: ${query}`);
    
    try {
      const cmd = Command.sidecar("ytdlp", [
        "--js-runtimes", "node",
        `ytsearch10:${query}`,
        "--dump-json",
        "--no-download"
      ]);
      
      cmd.stdout.on('data', (data: string) => {
        if (stopRequestedRef.current) return;
        const lines = data.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const dur = json.duration;
            const formattedDur = dur ? `${Math.floor(dur / 60)}:${(dur % 60).toString().padStart(2, '0')}` : 'N/A';
            
            setSearchResults(prev => {
              if (prev.find(item => item.id === json.id)) return prev;
              return [...prev, {
                id: json.id,
                title: json.title,
                thumbnail: json.thumbnail,
                duration: formattedDur,
                webpage_url: json.webpage_url
              }];
            });
          } catch (e) {
            console.error("JSON parse error:", e);
          }
        }
      });

      await cmd.spawn();
      addLog("✅ Search process started.");
    } catch (error: any) {
      toast.error("Search failed");
      addLog(`❌ Search error: ${error.message || error}`);
    } finally {
      setIsSearching(false);
      setIsLoading(false); // Ensure isLoading is reset
      setIsStopDisabled(true); // Ensure stop button is disabled
      activeProcessRef.current = null; // Clear active process
    }
  };

  const isWindows = navigator.userAgent.includes('Windows');

  const stopDownload = async () => {
    if (stopRequestedRef.current) return;
    
    stopRequestedRef.current = true;
    addLog("🛑 STOP requested - Terminating current download process...");
    
    // 1. Kill the specific active process first (Tauri v2 Child)
    if (activeProcessRef.current) {
      try {
        await activeProcessRef.current.kill();
        addLog("⚡ Terminated active process.");
      } catch (e) {
        addLog(`⚠️ Failed to kill active process via API: ${e}`);
      }
    }

    // 2. Fallback: Systematic cleanup (Windows/Linux)
    // We target common sidecar names and their triples to be sure
    if (isWindows) {
      const targets = [
        "ytdlp-x86_64-pc-windows-msvc.exe",
        "ytdlp-x86_64-pc-windows-gnu.exe",
        "wget-x86_64-pc-windows-msvc.exe",
        "wget-x86_64-pc-windows-gnu.exe",
        "ffmpeg.exe",
        "node.exe" // yt-dlp might be running node for JS challenges
      ];
      for (const exe of targets) {
        try {
          await Command.create("taskkill", ["/F", "/IM", exe, "/T"]).execute();
        } catch (e) {}
      }
    } else {
      try {
        await Command.create("pkill", ["-9", "-f", "ytdlp"]).execute();
        await Command.create("pkill", ["-9", "-f", "wget"]).execute();
        await Command.create("pkill", ["-9", "-f", "ffmpeg"]).execute();
      } catch (e) {}
    }
    
    // Clean up state
    activeProcessRef.current = null;
    setIsLoading(false);
    setIsStopDisabled(true);
    addLog("✅ Cleanup complete. The process should have stopped. Click 'Download' to resume.");
  };

  const runSingleDownload = async (
    targetUrl: string, 
    service: DownloadService, 
    options: DownloadOptions = {},
    label?: string
  ): Promise<number | null> => {
    const downloadDir = await path.downloadDir();
    const smartLabel = label || (targetUrl.includes('t.me/') ? 'Telegram Link' : 'Direct Link');
    const clients = service === 'ytdlp' ? ['web_embedded,mweb', 'android,web', 'ios'] : ['default'];
    let lastCode: number | null = 1;

    for (const client of clients) {
      if (stopRequestedRef.current) break;
      setProgress(0);
      addLog(`🚀 [TRYING] ${client} for ${smartLabel}`);

      let args: string[] = [];
      if (service === 'ytdlp') {
        // Windows hardcoded path fallback vs Linux path
        // In dev, resourceDir might not point where we think for sidecars, but let's try to be smart.
        // For now, we will use the hardcoded path for Windows (as per user request "make it work") but we can improve it.
        // For Linux, we expect ffmpeg in the sidecar bin folder or system.
        
        let ffmpegPath = "ffmpeg"; // Default to system/path ffmpeg for Linux
        if (isWindows) {
           ffmpegPath = "D:\\my-py-server\\OmniDownloader\\ffmpeg.exe";
        } else {
           // For Linux, we will try to resolve it relative to the resource directory if possible,
           // or just rely on the one we downloaded to `src-tauri/bin`.
           // In Dev mode, `src-tauri/bin` is not process.cwd().
           // But if we downloaded it there, we can look for it.
           // However, let's assume it's in the PATH or we construct a path.
           // Since we can't easily get the absolute path of the *source* in dev from the frontend without help,
           // we'll try to guess or use a sidecar-like resolution.
           // Actually, simplest is to pass just "ffmpeg" and ensure it's in the path, 
           // OR use the absolute path we know: `/run/media/kali/Win/my-py-server/OmniDownloader/src-tauri/bin/ffmpeg-x86_64-unknown-linux-gnu`
           // But that is hardcoded to this current machine.
           
           // Better approach:
           // If we are in dev, we know the path.
           // If we are in prod, it should be in resourceDir.
           // But frontend doesn't know if we are in dev or prod easily without asking Rust.
           
           // HACK: For this specific user on this specific machine:
           ffmpegPath = "/run/media/kali/Win/my-py-server/OmniDownloader/src-tauri/bin/ffmpeg-x86_64-unknown-linux-gnu";
        }

        let qualityArgs = "";
        switch (options.quality) {
          case '1080p': qualityArgs = "bestvideo[height<=1080]+bestaudio/best[height<=1080]"; break;
          case '720p':  qualityArgs = "bestvideo[height<=720]+bestaudio/best[height<=720]"; break;
          case '480p':  qualityArgs = "bestvideo[height<=480]+bestaudio/best[height<=480]"; break;
          case 'audio': qualityArgs = "bestaudio/best"; break;
          default:      qualityArgs = "bestvideo+bestaudio/best";
        }

        args = [
          "--js-runtimes", "node",
          "--ffmpeg-location", ffmpegPath,
          "--merge-output-format", "mp4",
          "--prefer-ffmpeg",
          "--extractor-args", `youtube:player-client=${client}`,
          "--newline",
          "--progress",
          "--no-colors",
          "-P", downloadDir,
          "-f", qualityArgs,
          "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "--no-check-certificate",
          "--prefer-free-formats",
          "--continue",
          "--no-overwrites"
        ];
        if (options.playlistItems) args.push("--playlist-items", options.playlistItems);
        args.push(targetUrl);
      } else {
        args = [
          "-c",
          "--progress=dot:giga",
          "-P", downloadDir,
          "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ];
        if (options.wgetReferer) args.push(`--referer=${options.wgetReferer}`);
        if (options.wgetFilename) args.push("-O", options.wgetFilename);
        args.push(targetUrl);
      }

      const cmd = Command.sidecar(service, args);
      
      const child = await cmd.spawn();
      activeProcessRef.current = child;

      cmd.stdout.on('data', (line) => {
        if (stopRequestedRef.current) return;
        const cleanLine = line.trim();
        if (cleanLine.includes('[download]')) {
          const p = parseProgress(cleanLine);
          if (p !== null) setProgress(p);
          setLogs(prev => {
            const last = prev[prev.length - 1];
            if (last && last.startsWith('[download]') && cleanLine.startsWith('[download]')) {
              return [...prev.slice(0, -1), cleanLine];
            }
            return [...prev, cleanLine].slice(-1000);
          });
        } else {
          addLog(cleanLine);
        }
      });

      cmd.stderr.on('data', (line) => {
        if (stopRequestedRef.current) return;
        addLog(`⚠️ ERR: ${line.trim()}`);
      });

      const completion = new Promise<{ code: number | null }>((resolve) => {
        cmd.on('close', (data) => resolve(data));
      });

      // await cmd.spawn(); // This was moved above to get the child process
      const output = await completion;
      lastCode = output.code;
      if (lastCode === 0 || stopRequestedRef.current) break;
      addLog(`⚠️ Client ${client} failed. Retrying next...`);
    }

    return lastCode;
  };

  const startDownload = async (targetUrl: string, service: DownloadService, options: DownloadOptions = {}) => {
    stopRequestedRef.current = false;
    setIsLoading(true);
    setIsStopDisabled(false); // Enable stop button
    setLogs([]);
    const code = await runSingleDownload(targetUrl, service, options);
    setIsLoading(false);
    setIsStopDisabled(true); // Disable stop button after completion/failure
    activeProcessRef.current = null; // Clear active process

    if (stopRequestedRef.current) {
      addLog("🛑 Download was manually stopped.");
      return;
    }

    if (code === 0) {
      setProgress(100);
      toast.success("Download Finished!");
      addLog("🎉 Process completed successfully!");
    } else {
      toast.error("Download Failed");
      addLog(`❌ Process failed with code: ${code}`);
    }
  };

  const startBatchDownload = async (urlsText: string) => {
    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) return;

    stopRequestedRef.current = false;
    setIsLoading(true);
    setIsStopDisabled(false); // Enable stop button
    setLogs([]);
    addLog(`📦 Starting Batch Download for ${urls.length} items...`);

    for (let i = 0; i < urls.length; i++) {
      if (stopRequestedRef.current) {
        addLog("🛑 Batch download stopped by user.");
        break;
      }
      addLog(`\n🔄 Processing (${i + 1}/${urls.length})`);
      const code = await runSingleDownload(urls[i], 'ytdlp', {}, `Batch Item ${i + 1}`);
      if (code !== 0 && !stopRequestedRef.current) addLog(`⚠️ Item ${i + 1} failed. Continuing...`);
    }

    setIsLoading(false);
    setIsStopDisabled(true); // Disable stop button after completion
    activeProcessRef.current = null; // Clear active process
    setProgress(100);
    toast.success("Batch Download Finished!");
    addLog("🎉 All batch items processed!");
  };

  const getMediaMetadata = async (url: string): Promise<MediaMetadata | null> => {
    if (!url) return null;
    setIsLoading(true);
    addLog(`🔍 Fetching metadata for: ${url}`);
    
    // Parse target video ID and index if present in a playlist link
    let requestedVideoId: string | undefined;
    let requestedIndex: number | undefined;
    
    try {
      const urlObj = new URL(url);
      requestedVideoId = urlObj.searchParams.get('v') || undefined;
      const idxStr = urlObj.searchParams.get('index');
      if (idxStr) requestedIndex = parseInt(idxStr);
    } catch (e) {}

    try {
      const cmd = Command.sidecar("ytdlp", [
        "--js-runtimes", "node",
        "--dump-single-json",
        "--flat-playlist",
        "--no-download",
        "--no-check-certificate",
        url
      ]);
      
      const child = await cmd.spawn();
      activeProcessRef.current = child;

      let stdout = '';
      let stderr = '';

      cmd.stdout.on('data', (data: string) => {
        if (stopRequestedRef.current) return;
        stdout += data;
      });
      cmd.stderr.on('data', (data: string) => {
        if (stopRequestedRef.current) return;
        stderr += data;
      });

      const completion = new Promise<{ code: number | null }>((resolve) => {
        cmd.on('close', (data) => resolve(data));
      });

      await completion;

      if (!stdout) {
        if (stderr) addLog(`⚠️ yt-dlp stderr: ${stderr}`);
        throw new Error("No metadata returned from yt-dlp");
      }
      
      const json = JSON.parse(stdout);
      
      const isPlaylist = (json._type === 'playlist' || !!json.entries || url.includes('list=') || url.startsWith('PL'));
      
      const metadata: MediaMetadata = {
        title: json.title || (isPlaylist ? "Playlist" : "Unknown Title"),
        thumbnail: json.thumbnail || (json.thumbnails?.[0]?.url) || (json.entries?.[0]?.thumbnail) || "",
        isPlaylist: isPlaylist,
        formats: json.formats || [],
        entries: json.entries ? json.entries.map((e: any, i: number) => ({
          id: e.id || String(i),
          title: e.title || `Video ${i + 1}`,
          url: e.url || e.webpage_url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : ""),
          thumbnail: e.thumbnail || (e.thumbnails?.[0]?.url) || "",
          index: i + 1
        })) : [],
        requestedVideoId,
        requestedIndex
      };
      
      addLog(`✅ Metadata found: ${metadata.title} (Type: ${metadata.isPlaylist ? 'Playlist' : 'Single Video'})`);
      if (metadata.isPlaylist) addLog(`📦 Found ${metadata.entries?.length || 0} videos in playlist.`);
      return metadata;
    } catch (e) {
      addLog(`⚠️ Metadata fetch error: ${e}`);
      return null;
    } finally {
      setIsLoading(false);
      activeProcessRef.current = null; // Clear active process
    }
  };

  const analyzeLink = async (urlInput: string) => {
    if (!urlInput) return null;
    let url = urlInput.trim();

    // Auto-detect YouTube Playlist IDs
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
        activeProcessRef.current = btbChild;

        let btbStdout = '';
        btbCmd.stdout.on('data', (data: string) => {
          if (stopRequestedRef.current) return;
          btbStdout += data;
        });

        const btbCompletion = new Promise<{ code: number | null }>((resolve) => {
          btbCmd.on('close', (data) => resolve(data));
        });
        await btbCompletion;

        const btbHtml = btbStdout;
        
        const iframeMatch = btbHtml.match(/iframe.*?src="(https:\/\/fuqster\.com\/embed\/\d+)"/);
        if (!iframeMatch) throw new Error("Embed iframe not found");
        
        const embedUrl = iframeMatch[1];
        const embedCmd = Command.sidecar("wget", ["-q", "-O", "-", embedUrl]);
        const embedChild = await embedCmd.spawn();
        activeProcessRef.current = embedChild;

        let embedStdout = '';
        embedCmd.stdout.on('data', (data: string) => {
          if (stopRequestedRef.current) return;
          embedStdout += data;
        });

        const embedCompletion = new Promise<{ code: number | null }>((resolve) => {
          embedCmd.on('close', (data) => resolve(data));
        });
        await embedCompletion;

        const embedHtml = embedStdout;
        
        const videoUrlMatch = embedHtml.match(/video_url:\s*'(https:\/\/fuqster\.com\/get_file\/.*?)'/);
        if (!videoUrlMatch) throw new Error("Direct video URL not found");
        
        addLog("✅ successfully extracted direct URL!");
        return { directUrl: videoUrlMatch[1], embedUrl, isPlaylist: false };
      }
      
      const meta = await getMediaMetadata(url);
      return { 
        directUrl: url, 
        embedUrl: null, 
        isPlaylist: meta?.isPlaylist || false,
        metadata: meta 
      };
    } catch (e) {
      addLog(`❌ Extraction failed: ${e}`);
      return null;
    } finally {
      setIsLoading(false);
      activeProcessRef.current = null; // Clear active process
    }
  };

  return {
    logs,
    setLogs,
    progress,
    setProgress,
    isLoading,
    isSearching,
    searchResults,
    handleSearch,
    startDownload,
    startBatchDownload,
    analyzeLink,
    stopDownload,
    isStopDisabled,
    endRef
  };
}
