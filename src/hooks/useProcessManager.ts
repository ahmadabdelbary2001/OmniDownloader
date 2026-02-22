import { useRef, useCallback, useState } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { isWindows as checkIsWindows } from '../lib/downloadUtils';

interface UseProcessManagerOptions {
  addLog?: (msg: string) => void;
  setTasks?: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useProcessManager({ addLog, setTasks }: UseProcessManagerOptions = {}) {
  const activeProcessesRef = useRef<Map<string, any>>(new Map());
  const stopRequestedRef = useRef<boolean>(false);
  const [isStopDisabledState, setIsStopDisabledState] = useState(true);

  const stopTaskProcess = useCallback(async (taskId: string) => {
    const child = activeProcessesRef.current.get(taskId);
    if (child) {
      try {
        await child.kill();
        activeProcessesRef.current.delete(taskId);
        if (addLog) addLog(`⚡ Terminated task process: ${taskId}`);
      } catch (e) {
        if (addLog) addLog(`⚠️ Failed to kill task ${taskId}: ${e}`);
      }
    }
  }, [addLog]);

  const stopDownload = useCallback(async () => {
    stopRequestedRef.current = true;
    if (addLog) addLog("🛑 STOP ALL requested - Terminating all active processes...");
    
    const processIds = Array.from(activeProcessesRef.current.keys());
    for (const id of processIds) {
      await stopTaskProcess(id);
    }

    const isWindows = checkIsWindows();
    if (isWindows) {
      const targets = [
        "ytdlp-x86_64-pc-windows-msvc.exe",
        "ytdlp-x86_64-pc-windows-gnu.exe",
        "wget-x86_64-pc-windows-msvc.exe",
        "wget-x86_64-pc-windows-gnu.exe",
        "ffmpeg.exe",
        "node.exe" 
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
    
    activeProcessesRef.current.clear();
    if (setTasks) {
      setTasks(prev => prev.map(t => 
        ['downloading', 'waiting', 'analyzing'].includes(t.status) 
          ? { ...t, status: 'paused', speed: undefined, eta: undefined } 
          : t
      ));
    }
    setIsStopDisabledState(true);
    if (addLog) addLog("✅ Cleanup complete. All processes should have stopped.");
  }, [addLog, stopTaskProcess, setTasks]);

  return {
    activeProcessesRef,
    stopRequestedRef,
    isStopDisabledState,
    setIsStopDisabledState,
    stopDownload,
    stopTaskProcess
  };
}
