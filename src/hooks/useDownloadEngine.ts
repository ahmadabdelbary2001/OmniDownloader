import { useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { path } from '@tauri-apps/api';
import { mkdir, exists } from '@tauri-apps/plugin-fs';
import { toast } from "sonner";
import { DownloadService, DownloadOptions, DownloadTask } from '../types/downloader';
import { parseProgress, isWindows as checkIsWindows } from '../lib/downloadUtils';

interface UseDownloadEngineOptions {
  addLog: (msg: string) => void;
  updateTask: (id: string, updates: Partial<DownloadTask>) => void;
  addTask: (url: string, service: DownloadService, options: DownloadOptions, title: string, thumbnail?: string) => Promise<string>;
  setProgress: (progress: number) => void;
  setIsLoading: (loading: boolean) => void;
  stopRequestedRef: React.MutableRefObject<boolean>;
  activeProcessesRef: React.MutableRefObject<Map<string, any>>;
  setIsStopDisabledState: (disabled: boolean) => void;
  baseDownloadPath: string;
}

export function useDownloadEngine({
  addLog,
  updateTask,
  addTask,
  setProgress,
  setIsLoading,
  stopRequestedRef,
  activeProcessesRef,
  setIsStopDisabledState,
  baseDownloadPath
}: UseDownloadEngineOptions) {

  const runSingleDownload = useCallback(async (
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
    
    try {
      if (!(await exists(downloadDir))) {
        await mkdir(downloadDir, { recursive: true });
        addLog(`📁 Created directory: ${downloadDir}`);
      }
    } catch (e) {}

    const smartLabel = label || (targetUrl.includes('t.me/') ? 'Telegram Link' : 'Direct Link');
    const clients = service === 'ytdlp' ? ['web_embedded,mweb', 'android,web', 'ios'] : ['default'];
    let lastCode: number | null = 1;
    const isWindows = checkIsWindows();

    for (const client of clients) {
      if (stopRequestedRef.current) break;
      setProgress(0);
      addLog(`🚀 [TRYING] ${client} for ${smartLabel}`);

      let args: string[] = [];
      if (service === 'ytdlp') {
        let ffmpegPath = "ffmpeg";
        if (isWindows) {
           ffmpegPath = "D:\\my-py-server\\OmniDownloader\\ffmpeg.exe";
        } else {
           ffmpegPath = "/run/media/kali/Win/my-py-server/OmniDownloader/src-tauri/bin/ffmpeg-x86_64-unknown-linux-gnu";
        }

        let qualityArgs: string;
        const q = options.quality || 'best';
        if (q === 'audio') {
          qualityArgs = "bestaudio/best";
        } else if (q === 'best') {
          qualityArgs = "bestvideo+bestaudio/best";
        } else {
          const heightMatch = q.match(/(\d+)/);
          if (heightMatch) {
            const h = parseInt(heightMatch[1]);
            qualityArgs = `bestvideo[height<=${h}][vcodec!*=av01]+bestaudio/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`;
          } else {
            qualityArgs = "bestvideo+bestaudio/best";
          }
        }

        args = [
          "--js-runtimes", "node",
          "--ffmpeg-location", ffmpegPath,
          "--merge-output-format", "mp4",
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
        
        if (options.subtitleLang && options.subtitleLang !== 'none' && q !== 'audio') {
          args.push("--write-subs", "--write-auto-subs", "--sub-langs", options.subtitleLang, "--convert-subs", "srt");
          if (options.embedSubtitles) {
            args.push("--embed-subs");
          }
        }

        args.push(targetUrl);
      } else {
        args = [
          "-c",
          "--continue",
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
      
      if (stopRequestedRef.current) {
        try {
          await child.kill();
          addLog("⚡ [HALTED] Process stopped immediately after spawn.");
        } catch (e) {}
        return 1;
      }

      if (taskId) activeProcessesRef.current.set(taskId, child);

      let currentComponentIdx = 0;
      let completedBytes = 0;
      let lastFilename = '';
      let detectedPhases = 0;
      let lastPhaseActualSize = 0;
      const totalEstimated = (options.estimatedVideoSize || 0) + (options.estimatedAudioSize || 0);

      cmd.stdout.on('data', (line) => {
        const cleanLine = line.trim();
        const formatsMatch = cleanLine.match(/Downloading (\d+) format\(s\)/);
        if (formatsMatch) {
          detectedPhases = parseInt(formatsMatch[1]);
        }

        if (cleanLine.includes('Destination: ')) {
          const filename = cleanLine.split('Destination: ').pop()?.trim() || '';
          if (filename && filename !== lastFilename) {
            completedBytes += lastPhaseActualSize;
            currentComponentIdx++;
            lastFilename = filename;
            lastPhaseActualSize = 0;
            addLog(`📦 Phase ${currentComponentIdx}: ${filename}`);
          }
        }

        if (cleanLine.includes('[download]')) {
          const p = parseProgress(cleanLine);
          if (p.percent !== null) {
            lastPhaseActualSize = p.totalBytes;
            let globalPercent = p.percent;
            let totalDownloaded = p.downloadedBytes;
            let totalSize = totalEstimated;

            if (totalEstimated > 0) {
              totalDownloaded = completedBytes + p.downloadedBytes;
              totalSize = completedBytes + p.totalBytes;
              if (currentComponentIdx === 1 && detectedPhases > 1) {
                  totalSize += (options.estimatedAudioSize || 0);
              }
              const finalTotal = Math.max(totalEstimated, totalSize);
              globalPercent = (totalDownloaded / finalTotal) * 100;
              const targetPhases = detectedPhases || (options.estimatedAudioSize ? 2 : 1);
              if (globalPercent > 99.9 && currentComponentIdx < targetPhases) {
                 globalPercent = 99.9;
              }
              totalSize = finalTotal;
            } else {
              totalSize = p.totalBytes;
            }

            globalPercent = Math.min(99.9, globalPercent);
            setProgress(globalPercent);
            if (taskId) {
              updateTask(taskId, { 
                progress: globalPercent, 
                downloadedBytes: totalDownloaded,
                totalBytes: totalSize,
                speed: p.speed, 
                size: p.size,
                eta: p.eta 
              });
            }
          }
        } else {
          addLog(cleanLine);
        }
      });

      cmd.stderr.on('data', (line) => {
        if (stopRequestedRef.current) return;
        addLog(`⚠️ ERR: ${line.trim()}`);
      });

      const output = await new Promise<{ code: number | null }>((resolve) => {
        cmd.on('close', (data) => resolve(data));
      });

      if (taskId) activeProcessesRef.current.delete(taskId);
      lastCode = output.code;
      if (lastCode === 0 || stopRequestedRef.current) break;
      addLog(`⚠️ Client ${client} failed. Retrying next...`);
    }

    return lastCode;
  }, [baseDownloadPath, updateTask, setProgress, addLog, stopRequestedRef, activeProcessesRef]);

  const startDownload = useCallback(async (targetUrl: string, service: DownloadService, options: DownloadOptions = {}, existingTaskId?: string) => {
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
  }, [addTask, updateTask, runSingleDownload, setProgress, addLog, stopRequestedRef, setIsStopDisabledState]);

  const startBatchDownload = useCallback(async (urlsText: string, options: DownloadOptions = {}) => {
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
    setIsStopDisabledState(true);
    setProgress(100);
    toast.success("Batch Download Finished!");
    addLog("🎉 All batch items processed!");
  }, [runSingleDownload, addLog, setIsLoading, setIsStopDisabledState, setProgress, stopRequestedRef]);

  return {
    runSingleDownload,
    startDownload,
    startBatchDownload
  };
}
