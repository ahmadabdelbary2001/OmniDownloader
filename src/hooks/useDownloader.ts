import { useState, useCallback, useRef, useEffect } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { path } from '@tauri-apps/api';
import { toast } from "sonner";
import { SearchResult, DownloadService, DownloadOptions } from '../types/downloader';

export function useDownloader() {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  
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
    } catch (error) {
      toast.error("Search failed");
      addLog(`❌ Search error: ${error}`);
    } finally {
      setIsSearching(false);
    }
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
      setProgress(0);
      addLog(`🚀 [TRYING] ${client} for ${smartLabel}`);

      let args: string[] = [];
      if (service === 'ytdlp') {
        const FFMPEG_PATH = "D:\\my-py-server\\OmniDownloader\\ffmpeg.exe";
        args = [
          "--js-runtimes", "node",
          "--ffmpeg-location", FFMPEG_PATH,
          "--merge-output-format", "mp4",
          "--prefer-ffmpeg",
          "--extractor-args", `youtube:player-client=${client}`,
          "--newline",
          "--progress",
          "--no-colors",
          "-P", downloadDir,
          "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
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
      cmd.stdout.on('data', (line) => {
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

      cmd.stderr.on('data', (line) => addLog(`⚠️ ERR: ${line.trim()}`));

      const completion = new Promise<{ code: number | null }>((resolve) => {
        cmd.on('close', (data) => resolve(data));
      });

      await cmd.spawn();
      const output = await completion;
      lastCode = output.code;
      if (lastCode === 0) break;
      addLog(`⚠️ Client ${client} failed. Retrying next...`);
    }

    return lastCode;
  };

  const startDownload = async (targetUrl: string, service: DownloadService, options: DownloadOptions = {}) => {
    setIsLoading(true);
    setLogs([]);
    const code = await runSingleDownload(targetUrl, service, options);
    setIsLoading(false);

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

    setIsLoading(true);
    setLogs([]);
    addLog(`📦 Starting Batch Download for ${urls.length} items...`);

    for (let i = 0; i < urls.length; i++) {
      addLog(`\n🔄 Processing (${i + 1}/${urls.length})`);
      const code = await runSingleDownload(urls[i], 'ytdlp', {}, `Batch Item ${i + 1}`);
      if (code !== 0) addLog(`⚠️ Item ${i + 1} failed. Continuing...`);
    }

    setIsLoading(false);
    setProgress(100);
    toast.success("Batch Download Finished!");
    addLog("🎉 All batch items processed!");
  };

  const analyzeLink = async (url: string) => {
    if (!url) return null;
    setIsLoading(true);
    addLog(`🔍 Analyzing link: ${url}`);
    
    try {
      if (url.includes('bigtitbitches.com')) {
        addLog("✨ Detected bigtitbitches.com - Extracting source...");
        const btbCmd = Command.sidecar("wget", ["-q", "-O", "-", url]);
        let btbHtml = "";
        btbCmd.stdout.on('data', (d) => btbHtml += d);
        await btbCmd.spawn();
        
        const iframeMatch = btbHtml.match(/iframe.*?src="(https:\/\/fuqster\.com\/embed\/\d+)"/);
        if (!iframeMatch) throw new Error("Embed iframe not found");
        
        const embedUrl = iframeMatch[1];
        addLog(`🔗 Found embed: ${embedUrl}`);
        
        const embedCmd = Command.sidecar("wget", ["-q", "-O", "-", embedUrl]);
        let embedHtml = "";
        embedCmd.stdout.on('data', (d) => embedHtml += d);
        await embedCmd.spawn();
        
        const videoUrlMatch = embedHtml.match(/video_url:\s*'(https:\/\/fuqster\.com\/get_file\/.*?)'/);
        if (!videoUrlMatch) throw new Error("Direct video URL not found in embed");
        
        addLog("✅ successfully extracted direct URL!");
        return { directUrl: videoUrlMatch[1], embedUrl };
      }
      return { directUrl: url, embedUrl: null };
    } catch (e) {
      addLog(`❌ Extraction failed: ${e}`);
      toast.error("Analysis failed");
      return null;
    } finally {
      setIsLoading(false);
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
    endRef
  };
}
