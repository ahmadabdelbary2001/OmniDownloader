import { useState, useEffect, useCallback } from 'react';
import { path } from '@tauri-apps/api';
import { mkdir, exists } from '@tauri-apps/plugin-fs';

interface UseDownloadPathOptions {
  addLog?: (msg: string) => void;
}

export function useDownloadPath({ addLog }: UseDownloadPathOptions = {}) {
  const [baseDownloadPath, setBaseDownloadPath] = useState<string>(localStorage.getItem('omni_base_path') || '');

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
        
        const isExists = await exists(current);
        if (!isExists) {
          await mkdir(current, { recursive: true });
          if (addLog) addLog(`📁 Created default download folder: ${current}`);
        }
      } catch (e) {
        console.error("Failed to init download path:", e);
      }
    };
    initPath();
  }, [addLog]);

  const updateBaseDownloadPath = useCallback((newPath: string) => {
    setBaseDownloadPath(newPath);
    localStorage.setItem('omni_base_path', newPath);
  }, []);

  return {
    baseDownloadPath,
    updateBaseDownloadPath
  };
}
