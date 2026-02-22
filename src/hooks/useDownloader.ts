import { useState, useEffect } from 'react';
import { path } from '@tauri-apps/api';
import { exists, remove, readDir } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import { toast } from "sonner";
import { DownloadTask } from '../types/downloader';
import { useLogs } from './useLogs';
import { useTasks } from './useTasks';
import { useDownloadPath } from './useDownloadPath';
import { useSearch } from './useSearch';
import { useMetadata } from './useMetadata';
import { useProcessManager } from './useProcessManager';
import { useDownloadEngine } from './useDownloadEngine';
import { useLinkAnalyzer } from './useLinkAnalyzer';

export function useDownloader() {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const { logs, setLogs, addLog, endRef } = useLogs();
  
  const { 
    tasks, 
    setTasks, 
    updateTask, 
    reorderTask, 
    removeTask: removeTaskState, 
    clearTasks: clearTasksState,
    addTask,
    addTasksBulk
  } = useTasks();

  const { baseDownloadPath, updateBaseDownloadPath } = useDownloadPath({ addLog });

  const { 
    activeProcessesRef, 
    stopRequestedRef, 
    isStopDisabledState, 
    setIsStopDisabledState, 
    stopDownload, 
  } = useProcessManager({ addLog, setTasks });

  const { isSearching, searchResults, handleSearch } = useSearch({ addLog, stopRequestedRef });

  const { getMediaMetadata } = useMetadata({ addLog, setIsLoading, stopRequestedRef, activeProcessesRef });

  const { startDownload, startBatchDownload } = useDownloadEngine({
    addLog,
    updateTask,
    addTask,
    setProgress,
    setIsLoading,
    stopRequestedRef,
    activeProcessesRef,
    setIsStopDisabledState,
    baseDownloadPath
  });

  const { analyzeLink } = useLinkAnalyzer({
    addLog,
    setIsLoading,
    getMediaMetadata,
    stopRequestedRef,
    activeProcessesRef
  });

  const isQueueActive = true;
  const isAnyDownloading = tasks.some(t => t.status === 'downloading');
  const isStopDisabled = !isAnyDownloading && isStopDisabledState;

  // Background Queue Manager
  useEffect(() => {
    if (!isQueueActive || stopRequestedRef.current) return;

    const isAnyActive = tasks.some(t => t.status === 'downloading');
    if (isAnyActive) return;

    const sortedWaiting = [...tasks]
        .filter(t => t.status === 'waiting')
        .sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0));

    const nextTask = sortedWaiting[0];

    if (nextTask) {
        addLog(`🕒 Queue Manager: Starting next task: ${nextTask.title}`);
        startDownload(nextTask.url, nextTask.service, nextTask.options, nextTask.id);
    }
  }, [isQueueActive, tasks, startDownload, stopRequestedRef, addLog]);

  const performFileCleanup = async (task: DownloadTask) => {
    try {
      const downloadDir = task.options.downloadPath || baseDownloadPath;
      if (!(await exists(downloadDir))) return;

      const entries = await readDir(downloadDir);
      const terms: string[] = [];
      let cleanTitle = task.title.replace(/\.(mp4|mkv|webm|avi|mp3|zip|rar|exe|pdf|iso)$|(\.part)$|(\.ytdl)$|(\.temp)$|(\.tmp)$/gi, '');
      cleanTitle = cleanTitle.replace(/[^a-z0-9]/gi, ' ').trim();
      if (cleanTitle.length > 3) terms.push(cleanTitle.split(' ')[0]);

      try {
        const urlObj = new URL(task.url);
        const urlFile = urlObj.pathname.split('/').pop()?.split('?')[0];
        if (urlFile) {
          const cleanUrlFile = urlFile.replace(/\.(mp4|mkv|webm|avi|mp3|zip|rar|exe|pdf|iso)$/i, '').replace(/[^a-z0-9]/gi, ' ').trim();
          if (cleanUrlFile.length > 3) terms.push(cleanUrlFile.split(' ')[0]);
        }
      } catch (e) {}

      const tempExts = ['.part', '.ytdl', '.temp', '.tmp', '.unknown_video.part'];
      addLog(`🧹 Scanning for fragments of "${task.title}"...`);
      let count = 0;

      for (const entry of entries) {
        const entryLower = entry.name.toLowerCase();
        const isTemp = tempExts.some(ext => entryLower.endsWith(ext)) || entryLower.includes('.ytdl-');
        if (isTemp) {
          const matches = terms.some(term => term.length > 2 && entryLower.includes(term.toLowerCase()));
          if (matches || entryLower.includes(task.id)) {
            const fullPath = await path.join(downloadDir, entry.name);
            await remove(fullPath);
            addLog(`🗑️ Deleted: ${entry.name}`);
            count++;
          }
        }
      }
      if (count > 0) addLog(`✅ Cleaned up ${count} file(s).`);
    } catch (e) {
      addLog(`⚠️ Cleanup failed: ${e}`);
    }
  };

  const removeTaskWithCleanup = async (id: string, deleteFiles: boolean = false) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.status === 'downloading' || task.status === 'analyzing') {
       await stopDownload();
       await new Promise(r => setTimeout(r, 800));
    }

    if (deleteFiles || task.status !== 'completed') {
      await performFileCleanup(task);
    }
    removeTaskState(id);
  };

  const clearTasksWithCleanup = async (onlyCompleted: boolean = false) => {
    if (!onlyCompleted) {
      const hasActive = tasks.some(t => t.status === 'downloading' || t.status === 'analyzing');
      if (hasActive) {
        await stopDownload();
        await new Promise(r => setTimeout(r, 1000));
      }

      for (const task of tasks) {
        if (task.status !== 'completed') {
           await performFileCleanup(task);
        }
      }
      clearTasksState();
      toast.success("List cleared and temporary files removed");
    } else {
      setTasks(prev => prev.filter(t => t.status !== 'completed'));
    }
  };

  const revealFolder = async (folderPath?: string) => {
    const targetPath = folderPath || baseDownloadPath;
    if (!targetPath) return toast.error("Download path not set");

    try {
      if (!(await exists(targetPath))) return toast.error("Folder does not exist yet");
      const isWindowsOS = /^[A-Za-z]:[\\\/]/.test(targetPath);
      if (isWindowsOS) await Command.create('explorer', [targetPath]).execute();
      else await Command.create('xdg-open', [targetPath]).execute();
      addLog(`📁 Opening folder: ${targetPath}`);
    } catch (e) {
      toast.error("Failed to open folder");
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
    removeTask: removeTaskWithCleanup,
    clearTasks: clearTasksWithCleanup,
    getMediaMetadata,
    isQueueActive,
    reorderTask,
    revealFolder
  };
}
