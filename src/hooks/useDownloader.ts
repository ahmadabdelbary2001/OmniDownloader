import { useState, useCallback, useRef, useEffect } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { path } from '@tauri-apps/api';
import { mkdir, exists, remove, readDir } from '@tauri-apps/plugin-fs';
import { toast } from "sonner";
import { SearchResult, DownloadService, DownloadOptions, MediaMetadata, DownloadTask } from '../types/downloader';

export function useDownloader() {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [tasks, setTasks] = useState<DownloadTask[]>(() => {
    const saved = localStorage.getItem('omni_tasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Reset volatile statuses that don't survive restart
        return parsed.map((t: DownloadTask) => {
          if (t.status === 'downloading' || t.status === 'analyzing') {
            return { ...t, status: 'paused' };
          }
          return t;
        }).sort((a: any, b: any) => (a.queueOrder || 0) - (b.queueOrder || 0));
      } catch (e) {
        console.error("Failed to parse saved tasks", e);
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('omni_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const [isQueueActive, setIsQueueActive] = useState(() => {
    const saved = localStorage.getItem('omni_queue_active');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('omni_queue_active', String(isQueueActive));
  }, [isQueueActive]);

  const activeProcessesRef = useRef<Map<string, any>>(new Map());
  const stopRequestedRef = useRef<boolean>(false);

  const [isStopDisabledState, setIsStopDisabledState] = useState(true);
  const isAnyDownloading = tasks.some(t => t.status === 'downloading');
  const isStopDisabled = !isAnyDownloading && isStopDisabledState; // We'll keep a state for other busy things
  
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, msg].slice(-1000));
  }, []);

  const [baseDownloadPath, setBaseDownloadPath] = useState<string>(localStorage.getItem('omni_base_path') || '');

  // Initialize and ensure default directory exists
  useEffect(() => {
    const initPath = async () => {
      try {
        let current = localStorage.getItem('omni_base_path');
        if (!current) {
          const downloads = await path.downloadDir();
          current = await path.join(downloads, 'OmniDownloader');
          localStorage.setItem('omni_base_path', current);
          setBaseDownloadPath(current);
        }
        
        // Ensure directory exists
        const isExists = await exists(current);
        if (!isExists) {
          await mkdir(current, { recursive: true });
          addLog(`📁 Created default download folder: ${current}`);
        }
      } catch (e) {
        console.error("Failed to init download path:", e);
      }
    };
    initPath();
  }, []);

  const updateBaseDownloadPath = (newPath: string) => {
    setBaseDownloadPath(newPath);
    localStorage.setItem('omni_base_path', newPath);
  };

  const parseProgress = (line: string) => {
    // yt-dlp patterns: 
    // [download]  12.3% of 10.00MiB at  2.41MiB/s ETA 00:04
    // [download]  12.3% of ~10.00MiB at  2.41MiB/s ETA 00:04
    const percentMatch = line.match(/(\d+\.?\d*)%/);
    const sizeMatch = line.match(/of\s+(~?\d+\.?\d*[KMGT]iB)/);
    const speedMatch = line.match(/at\s+(\d+\.?\d*[KMGT]iB\/s)/);
    const etaMatch = line.match(/ETA\s+(\d+:\d+)/);

    return {
      percent: percentMatch ? parseFloat(percentMatch[1]) : null,
      size: sizeMatch ? sizeMatch[1].replace('~', '') : undefined,
      speed: speedMatch ? speedMatch[1] : undefined,
      eta: etaMatch ? etaMatch[1] : undefined
    };
  };

  const updateTask = (id: string, updates: Partial<DownloadTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
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
      setIsStopDisabledState(true); // Ensure stop button is disabled
    }
  };

  const isWindows = navigator.userAgent.includes('Windows');

  const stopDownload = async () => {
    addLog("🛑 STOP ALL requested - Terminating all active processes...");
    
    // Kill all processes in the map
    const processIds = Array.from(activeProcessesRef.current.keys());
    for (const id of processIds) {
      await stopTaskProcess(id); // Use helper
    }

    // Fallback cleanup
    
    // Simplified specific killing as we now have a map

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
    setIsStopDisabledState(true);
    addLog("✅ Cleanup complete. All processes should have stopped.");
  };

  const stopTaskProcess = async (taskId: string) => {
    const child = activeProcessesRef.current.get(taskId);
    if (child) {
      try {
        await child.kill();
        activeProcessesRef.current.delete(taskId);
        addLog(`⚡ Terminated task process: ${taskId}`);
      } catch (e) {
        addLog(`⚠️ Failed to kill task ${taskId}: ${e}`);
      }
    }
  };

  const runSingleDownload = async (
    targetUrl: string, 
    service: DownloadService, 
    options: DownloadOptions = {},
    taskId?: string,
    label?: string
  ): Promise<number | null> => {
    const downloadDir = options.downloadPath || baseDownloadPath || (await path.downloadDir());
    
    if (taskId) {
      updateTask(taskId, { status: 'downloading' });
    }
    
    // Ensure the specific download directory exists
    try {
      if (!(await exists(downloadDir))) {
        await mkdir(downloadDir, { recursive: true });
        addLog(`📁 Created directory: ${downloadDir}`);
      }
    } catch (e) {}

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
      if (taskId) activeProcessesRef.current.set(taskId, child);

      cmd.stdout.on('data', (line) => {
        if (stopRequestedRef.current) return;
        const cleanLine = line.trim();
        if (cleanLine.includes('[download]')) {
          const p = parseProgress(cleanLine);
          if (p.percent !== null) {
            setProgress(p.percent);
            if (taskId) {
              updateTask(taskId, { 
                progress: p.percent, 
                speed: p.speed, 
                size: p.size,
                eta: p.eta 
              });
            }
          }
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

  const addTask = async (url: string, service: DownloadService, options: DownloadOptions, title: string, thumbnail?: string): Promise<string> => {
    const id = Math.random().toString(36).substring(2, 11);
    
    setTasks(prev => {
      const maxOrder = prev.length > 0 ? Math.max(...prev.map(t => t.queueOrder || 0)) : 0;
      const newTask: DownloadTask = {
        id,
        url,
        title,
        status: 'waiting',
        progress: 0,
        service,
        options,
        createdAt: Date.now(),
        thumbnail,
        queueOrder: maxOrder + 1
      };
      return [...prev, newTask].sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0));
    });
    
    return id;
  };

  const addTasksBulk = async (items: { url: string, service: DownloadService, options: DownloadOptions, title: string, thumbnail?: string }[]): Promise<string[]> => {
    const ids: string[] = [];
    
    setTasks(prev => {
      let currentMaxOrder = prev.length > 0 ? Math.max(...prev.map(t => t.queueOrder || 0)) : 0;
      const newTasksToAdd: DownloadTask[] = items.map(item => {
        const id = Math.random().toString(36).substring(2, 11);
        ids.push(id);
        currentMaxOrder++;
        return {
          id,
          url: item.url,
          title: item.title,
          status: 'waiting',
          progress: 0,
          service: item.service,
          options: item.options,
          createdAt: Date.now(),
          thumbnail: item.thumbnail,
          queueOrder: currentMaxOrder
        };
      });
      
      return [...prev, ...newTasksToAdd].sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0));
    });
    
    return ids;
  };

  const startDownload = async (targetUrl: string, service: DownloadService, options: DownloadOptions = {}, existingTaskId?: string) => {
    let taskId = existingTaskId;
    
    if (!taskId) {
      taskId = await addTask(targetUrl, service, options, targetUrl);
    } else {
      updateTask(taskId, { status: 'waiting' });
    }

    stopRequestedRef.current = false;
    setIsStopDisabledState(false);
    
    const code = await runSingleDownload(targetUrl, service, options, taskId);
    
    setIsStopDisabledState(true);

    if (stopRequestedRef.current) {
      updateTask(taskId, { status: 'paused' });
      addLog("🛑 Download was manually stopped.");
      return;
    }

    if (code === 0) {
      setProgress(100);
      updateTask(taskId, { status: 'completed', progress: 100, speed: undefined, eta: undefined });
      toast.success("Download Finished!");
      addLog("🎉 Process completed successfully!");
    } else {
      updateTask(taskId, { status: 'failed' });
      toast.error("Download Failed");
      addLog(`❌ Process failed with code: ${code}`);
    }
  };

  const reorderTask = (id: string, direction: 'up' | 'down') => {
    setTasks(prev => {
        const task = prev.find(t => t.id === id);
        if (!task || !task.queueOrder) return prev;
        
        const currentOrder = task.queueOrder;
        const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
        
        if (targetOrder < 1 || targetOrder > prev.length) return prev;
        
        const neighbor = prev.find(t => t.queueOrder === targetOrder);
        if (!neighbor) return prev; // Should always find one if orders are contiguous
        
        const newTasks = prev.map(t => {
            if (t.id === id) return { ...t, queueOrder: targetOrder };
            if (t.id === neighbor.id) return { ...t, queueOrder: currentOrder };
            return t;
        });
        
        return newTasks.sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0));
    });
  };

  // Background Queue Manager
  useEffect(() => {
    if (!isQueueActive) return;

    // Wait if any download is already active
    const isAnyActive = tasks.some(t => t.status === 'downloading');
    if (isAnyActive) return;

    // Find the next waiting task by queueOrder
    const sortedWaiting = [...tasks]
        .filter(t => t.status === 'waiting')
        .sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0));

    const nextTask = sortedWaiting[0];

    if (nextTask) {
        addLog(`🕒 Queue Manager: Starting next task: ${nextTask.title}`);
        startDownload(nextTask.url, nextTask.service, nextTask.options, nextTask.id);
    }
  }, [isQueueActive, isLoading, tasks]);

  const startBatchDownload = async (urlsText: string, options: DownloadOptions = {}) => {
    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u);
    if (urls.length === 0) return;
    
    addLog(`🚀 [BATCH] Starting ${urls.length} downloads...`);
    setIsLoading(true);
    setIsStopDisabledState(false);
    stopRequestedRef.current = false;

    for (let i = 0; i < urls.length; i++) {
        if (stopRequestedRef.current) break;
        addLog(`📦 [${i+1}/${urls.length}] Processing ${urls[i]}`);
        const code = await runSingleDownload(urls[i], 'ytdlp', options, `Batch #${i+1}`);
      if (code !== 0 && !stopRequestedRef.current) addLog(`⚠️ Item ${i + 1} failed. Continuing...`);
    }

    setIsLoading(false);
    setIsStopDisabledState(true); // Disable stop button after completion
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
      activeProcessesRef.current.set("metadata", child);

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
      activeProcessesRef.current.delete("metadata");
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
      activeProcessesRef.current.delete("analysis");
    }
  };

  const performFileCleanup = async (task: DownloadTask) => {
    try {
      const downloadDir = task.options.downloadPath || baseDownloadPath;
      const dirExists = await exists(downloadDir);
      
      if (!dirExists) return;

      const entries = await readDir(downloadDir);
      
      // Heuristic: identify search terms from title and url
      const terms: string[] = [];
      
      // 1. From title (clean it)
      let cleanTitle = task.title.replace(/\.(mp4|mkv|webm|avi|mp3|zip|rar|exe|pdf|iso)$|(\.part)$|(\.ytdl)$|(\.temp)$|(\.tmp)$/gi, '');
      cleanTitle = cleanTitle.replace(/[^a-z0-9]/gi, ' ').trim();
      if (cleanTitle.length > 3) terms.push(cleanTitle.split(' ')[0]); // Primary word
      
      // 2. From URL if possible
      try {
        const urlObj = new URL(task.url);
        const urlFile = urlObj.pathname.split('/').pop()?.split('?')[0];
        if (urlFile) {
          const cleanUrlFile = urlFile.replace(/\.(mp4|mkv|webm|avi|mp3|zip|rar|exe|pdf|iso)$/i, '').replace(/[^a-z0-9]/gi, ' ').trim();
          if (cleanUrlFile.length > 3) terms.push(cleanUrlFile.split(' ')[0]);
        }
      } catch (e) {}

      // Common temp extensions
      const tempExts = ['.part', '.ytdl', '.temp', '.tmp', '.unknown_video.part'];
      
      addLog(`🧹 Scanning for fragments of "${task.title}"...`);
      let count = 0;

      for (const entry of entries) {
        const entryLower = entry.name.toLowerCase();
        const isTemp = tempExts.some(ext => entryLower.endsWith(ext)) || entryLower.includes('.ytdl-');
        
        if (isTemp) {
          // Check if filename contains any of our key terms
          const matches = terms.some(term => term.length > 2 && entryLower.includes(term.toLowerCase()));
          
          if (matches || entryLower.includes(task.id)) {
            const fullPath = await path.join(downloadDir, entry.name);
            await remove(fullPath);
            addLog(`🗑️ Deleted: ${entry.name}`);
            count++;
          }
        }
      }
      
      if (count > 0) {
        addLog(`✅ Cleaned up ${count} file(s).`);
      } else {
        addLog(`ℹ️ No matching fragments found for deletion.`);
      }
    } catch (e) {
      console.error("Cleanup error:", e);
      addLog(`⚠️ Cleanup failed: ${e}`);
    }
  };

  const removeTask = async (id: string, deleteFiles: boolean = false) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.status === 'downloading' || task.status === 'analyzing') {
       await stopDownload();
       await new Promise(r => setTimeout(r, 800)); // Wait for handle to release
    }

    if (deleteFiles || task.status !== 'completed') {
      await performFileCleanup(task);
    }

    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const clearTasks = async (onlyCompleted: boolean = false) => {
    if (!onlyCompleted) {
      // First stop any active ones
      const hasActive = tasks.some(t => t.status === 'downloading' || t.status === 'analyzing');
      if (hasActive) {
        await stopDownload();
        await new Promise(r => setTimeout(r, 1000));
      }

      // Cleanup all unfinished tasks files
      for (const task of tasks) {
        if (task.status !== 'completed') {
           await performFileCleanup(task);
        }
      }
      setTasks([]);
      toast.success("List cleared and temporary files removed");
    } else {
      setTasks(prev => prev.filter(t => t.status !== 'completed'));
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
    endRef,
    baseDownloadPath,
    setBaseDownloadPath: updateBaseDownloadPath,
    tasks,
    setTasks,
    addTask,
    addTasksBulk,
    removeTask,
    clearTasks,
    getMediaMetadata,
    isQueueActive,
    setIsQueueActive,
    reorderTask
  };
}
