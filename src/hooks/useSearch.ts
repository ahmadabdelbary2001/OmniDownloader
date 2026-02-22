import { useState, useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { toast } from "sonner";
import { SearchResult } from '../types/downloader';

interface UseSearchOptions {
  addLog?: (msg: string) => void;
  stopRequestedRef?: React.MutableRefObject<boolean>;
}

export function useSearch({ addLog, stopRequestedRef }: UseSearchOptions = {}) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query) return;
    setIsSearching(true);
    setSearchResults([]);
    if (addLog) addLog(`🔎 Searching for: ${query}`);
    
    try {
      const cmd = Command.sidecar("ytdlp", [
        "--js-runtimes", "node",
        `ytsearch10:${query}`,
        "--dump-json",
        "--no-download"
      ]);
      
      cmd.stdout.on('data', (data: string) => {
        if (stopRequestedRef?.current) return;
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
      if (addLog) addLog("✅ Search process started.");
    } catch (error: any) {
      toast.error("Search failed");
      if (addLog) addLog(`❌ Search error: ${error.message || error}`);
    } finally {
      setIsSearching(false);
    }
  }, [addLog, stopRequestedRef]);

  return {
    isSearching,
    searchResults,
    setSearchResults,
    handleSearch
  };
}
