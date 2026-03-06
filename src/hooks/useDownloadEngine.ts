import { useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { path } from '@tauri-apps/api';
import { mkdir, exists } from '@tauri-apps/plugin-fs';
import { toast } from "sonner";
import { DownloadService, DownloadOptions, DownloadTask } from '../types/downloader';
import { parseProgress, isWindows as checkIsWindows } from '../lib/downloadUtils';
import { buildYtDlpArgs } from '../lib/ytdlpArgsBuilder';

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
  addTasksBulk: (items: any[]) => Promise<string[]>;
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
  baseDownloadPath,
  addTasksBulk
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

    const smartLabel = label || targetUrl;
    
    // Phase 50-53: Optimized client list focusing on Web/Desktop and JS-less fallbacks
    const isSubtitleOnly = options.quality === 'subtitles';
    const clients = service === 'ytdlp' 
      ? (isSubtitleOnly 
          ? ['android_vr', 'web_embedded,mweb', 'android,web']
          : ['android_vr', 'web_embedded,mweb', 'web', 'tv_embedded', 'android,web'])
      : ['default'];

    const browsers = ['chrome', 'edge', 'firefox', 'brave', 'none'];
    let lastCode: number | null = 1;
    let hadSuccess = false;
    let finalQualityViolated = false;
    const isWindows = checkIsWindows();

    for (const client of clients) {
      if (stopRequestedRef.current) break;

      for (const browser of browsers) {
        if (stopRequestedRef.current) break;

        setProgress(0);
        addLog(`🚀 [TRYING] ${client} (Auth: ${browser}) for ${smartLabel}`);

        let restrictionNoted = false;
        let currentTryQualityViolated = false;
        let cookieLock = false;

        let args: string[] = [];
        if (service === 'ytdlp') {
          let ffmpegPath = isWindows ? "D:\\my-py-server\\OmniDownloader\\ffmpeg.exe" : "/usr/bin/ffmpeg"; 
          if (!isWindows) {
            ffmpegPath = "/run/media/kali/Win/my-py-server/OmniDownloader/src-tauri/bin/ffmpeg-x86_64-unknown-linux-gnu";
          }

          args = buildYtDlpArgs(targetUrl, options, downloadDir, ffmpegPath, client, browser);
          if (browser !== 'none') {
            addLog(`🚀 [ytdlp] Launching download (Target: ${options.quality || 'best'}, Client: ${client}, Browser: ${browser})...`);
          } else {
            addLog(`🚀 [ytdlp] Launching download (Target: ${options.quality || 'best'}, Client: ${client}, Auth: Standard/None)...`);
          }
        } else {
          // wget
          args = [
            "-c",
            "--continue",
            "--progress=dot:giga",
            "-P", downloadDir,
            `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
          ];
          if (options.wgetReferer) args.push(`--referer=${options.wgetReferer}`);
          if (options.wgetFilename) args.push("-O", options.wgetFilename);
          args.push(targetUrl);
        }

        const cmd = Command.sidecar(service, args);

        let currentComponentIdx = 0;
        let completedBytes = 0;
        let lastFilename = '';
        let detectedPhases = 0;
        let lastPhaseActualSize = 0;
        const totalEstimated = (options.estimatedVideoSize || 0) + (options.estimatedAudioSize || 0);
        let lastUpdateAt = 0;
        const THROTTLE_MS = 500;

        cmd.stdout.on('data', (line: string) => {
          if (stopRequestedRef.current) return;
          const cleanLine = line.trim();
          if (!cleanLine) return;

          const formatsMatch = cleanLine.match(/Downloading (\d+) format\(s\)/);
          if (formatsMatch) detectedPhases = parseInt(formatsMatch[1]);

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
              
              const now = Date.now();
              if (now - lastUpdateAt > THROTTLE_MS) {
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
                lastUpdateAt = now;
              }
            }
          } else if (cleanLine.includes('[ffmpeg]')) {
            if (taskId) updateTask(taskId, { speed: 'Merging Components...' });
            addLog(cleanLine);
          } else if (!cleanLine.startsWith('[download]') && !cleanLine.includes('%')) {
            addLog(cleanLine);
          }
        });

        cmd.stderr.on('data', (line: string) => {
          if (stopRequestedRef.current) return;
          const trimmed = line.trim();
          if (trimmed) {
            addLog(`⚠️ [engine] ${trimmed}`);
            
            if (trimmed.includes('Could not copy') && (trimmed.includes('cookie database') || trimmed.includes('Locked'))) {
              cookieLock = true;
              addLog(`🕵️‍♂️ [Cookie Lock] ${browser} is locked (likely open in another window). Suggestion: Close ${browser} or set Browser to "None" to use PO Tokens instead.`);
            }

            if (
              trimmed.includes('GVS PO Token') || 
              trimmed.includes('SABR streaming') || 
              trimmed.includes('Error code: 152') ||
              trimmed.includes('confirm you are not a bot') ||
              trimmed.includes('YouTube is no longer supported') ||
              trimmed.includes('no subtitles') ||
              trimmed.includes("There aren't any subtitles") ||
              trimmed.includes('Sign in to confirm') || 
              trimmed.includes('confirm your age') || 
              trimmed.includes('Join this channel') ||
              trimmed.includes('This video is unavailable') ||
              trimmed.includes('HTTP Error 403') ||
              trimmed.includes('n challenge failed')
            ) {
              restrictionNoted = true;
              addLog(`🕵️‍♂️ [Rescue] Restriction or Missing Subtitles detected. Attempting bypass...`);
            }
          }
        });

        const closePromise = new Promise<{ code: number | null }>((resolve) => {
          cmd.on('close', (data) => resolve(data));
        });

        const child = await cmd.spawn();
        if (stopRequestedRef.current) {
          try { await child.kill(); } catch (e) {}
          addLog("🛑 Download stopped.");
          return 1;
        }

        if (taskId) activeProcessesRef.current.set(taskId, child);
        const output = await closePromise;
        if (taskId) activeProcessesRef.current.delete(taskId);

        lastCode = output.code;
        
        if (lastCode === 0 && options.quality && (options.quality.includes('1080') || options.quality.includes('2160') || options.quality.includes('1440'))) {
          const actualTotal = completedBytes + lastPhaseActualSize;
          // For high-res, if size is less than 50% of estimated, it's likely a 360p fallback
          if (options.estimatedVideoSize && actualTotal < (options.estimatedVideoSize * 0.5)) {
            addLog(`🕵️‍♂️ [Quality Guard] Final size (${Math.round(actualTotal/1024/1024)}mb) is suspiciously low for ${options.quality}.`);
            currentTryQualityViolated = true;
            finalQualityViolated = true;
          }
        }

        addLog(`🏁 Client ${client} (${browser}) finished with code: ${lastCode}`);
        
        if (lastCode === 0 && !cookieLock) {
          hadSuccess = true;
          if (!isSubtitleOnly && currentTryQualityViolated) {
            addLog(`🔄 Quality Guard triggered. Holding this success and attempting a better client...`);
          } else {
            finalQualityViolated = false; // We found a good one!
            return 0; // SUCCESS (Good quality or not high-res request)
          }
        }

        if (stopRequestedRef.current) break;

        if (cookieLock) {
          continue; // Try next browser
        } else {
          addLog(`🔄 Client ${client} ${lastCode === 0 ? 'restricted' : 'failed'}${restrictionNoted ? ' (Restrictions noted)' : ''}. Proceeding to next client...`);
          break; // Move to next client
        }
      }
    }

    if (hadSuccess && finalQualityViolated) {
      addLog(`⚠️ [Quality Warning] The requested quality (${options.quality}) might not have been fully met (possibly limited by content/region). Settle for the best available resolution.`);
    }

    return hadSuccess ? 0 : lastCode;
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
      addLog("🛑 Download stopped.");
      return;
    }

    if (code === 0) {
      setProgress(100);
      updateTask(taskId, { status: 'completed', progress: 100, speed: undefined, eta: undefined });
      toast.success("Download Finished!");
      addLog("🎉 Completed successfully!");
    } else {
      updateTask(taskId, { status: 'failed' });
      toast.error("Download Failed");
      addLog(`❌ Process failed with code: ${code}`);
    }
  }, [addTask, updateTask, runSingleDownload, setProgress, addLog, stopRequestedRef, setIsStopDisabledState]);

  const startBatchDownload = useCallback(async (urlsText: string, options: DownloadOptions = {}) => {
    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u);
    if (urls.length === 0) return;

    addLog(`🚀 [BATCH] Preparing ${urls.length} items...`);
    setIsLoading(true);
    setIsStopDisabledState(false);
    stopRequestedRef.current = false;

    const items = urls.map(url => ({
      url,
      service: 'ytdlp' as DownloadService,
      options,
      title: url
    }));

    const ids = await addTasksBulk(items);
    addLog(`✅ Added ${ids.length} tasks to manager list.`);

    setIsLoading(false);
  }, [addTasksBulk, addLog, setIsLoading, setIsStopDisabledState, stopRequestedRef]);

  return {
    runSingleDownload,
    startDownload,
    startBatchDownload
  };
}
