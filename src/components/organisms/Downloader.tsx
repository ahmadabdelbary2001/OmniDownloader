import { useState, useEffect, useRef } from 'react';
import { Terminal, Search, Plus, Pause, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { open, ask } from '@tauri-apps/plugin-dialog';

import { useDownloader } from '../../hooks/useDownloader';
import { parseYtdlpOutput } from '../../hooks/useMetadata';
import { DownloadTable } from './DownloadTable';
import { SmartAddDialog } from './SmartAddDialog';
import { SearchTab } from './SearchTab';
import { LogViewer } from './LogViewer';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '../ui/sheet';
import { ThemeToggle } from '../atoms/ThemeToggle';
import { StoragePicker } from '../molecules/StoragePicker';
import { FilterSidebar, matchesFilter } from '../molecules/FilterSidebar';
import type { FilterType } from '../molecules/FilterSidebar';
import { VideoPlayer } from './VideoPlayer';
import Logo from '../../assets/logo.svg';

export function Downloader() {
  const {
    logs, setLogs,
    progress,
    isSearching, searchResults, handleSearch,
    startDownload, analyzeLink, stopDownload,
    isStopDisabled, endRef,
    baseDownloadPath, setBaseDownloadPath,
    tasks, setTasks,
    addTask, removeTask, clearTasks,
    isQueueActive,
    reorderTask, addTasksBulk,
    revealFolder,
  } = useDownloader();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen]           = useState(false);
  const [filter, setFilter]                   = useState<FilterType>('all');
  const [prefilledUrl, setPrefilledUrl]       = useState<string | undefined>();
  const [prefilledOptions, setPrefilledOptions] = useState<{
    quality?: string;
    subtitle_lang?: string;
    download_path?: string;
    metadata?: import('../../types/downloader').MediaMetadata;
  } | undefined>();
  const [playingVideo, setPlayingVideo]       = useState<{ url: string; title: string } | null>(null);

  const lastProcessedUrlRef = useRef<{ url: string; time: number } | null>(null);

  // Listen for URLs sent by the browser extension
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    
    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<{
        url: string;
        title?: string;
        auto_start?: boolean;
        quality?: string;
        subtitle_lang?: string;
        download_path?: string;
        estimated_size?: number;
        thumbnail?: string;
        metadata?: any;
        instant?: boolean;
        selected_entries?: any[];
        is_playlist?: boolean;
        playlist_title?: string;
      }>('omni://add-url', (event) => {
        const { 
          url, title, thumbnail, quality, subtitle_lang, download_path, 
          estimated_size, metadata, instant, selected_entries, playlist_title
        } = event.payload;

        // --- Deduplication Logic ---
        const now = Date.now();
        if (lastProcessedUrlRef.current && 
            lastProcessedUrlRef.current.url === url && 
            (now - lastProcessedUrlRef.current.time) < 2000) {
          console.log(`[Omni] Skipping duplicate event for ${url}`);
          return;
        }
        lastProcessedUrlRef.current = { url, time: now };

        // Phase 54: If metadata is present, parse it to avoid redundant analysis
        let parsedMeta: any = null;
        if (metadata) {
          try {
            parsedMeta = parseYtdlpOutput(metadata, url);
            console.log("[Omni] Successfully parsed metadata from extension payload");
          } catch (e) {
            console.error("[Omni] Failed to parse extension metadata:", e);
          }
        }

        setPrefilledUrl(url);
        setPrefilledOptions({
          quality,
          subtitle_lang,
          download_path,
          metadata: parsedMeta
        });

        if (instant) {
          // Phase 56: Bulk Add Selection 🚀
          if (selected_entries && selected_entries.length > 0) {
            import('../../lib/linkAnalyzer').then(({ analyzeLinkType }) => {
              // Build a playlist sub-folder — use explicit playlist_title, NOT video title 📂
              const basePath = download_path || baseDownloadPath;
              let playlistPath = basePath;
              const folderName = playlist_title; // Sent from extension: lastMetadata.title
              if (folderName) {
                const safeTitle = folderName.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
                if (safeTitle) {
                  playlistPath = basePath.replace(/[\\/]$/, '') + '\\' + safeTitle;
                }
              }

              const bulkItems = selected_entries.map((entry: any) => ({
                url: entry.url || entry.webpage_url || url,
                title: entry.title || 'Unknown Video',
                service: analyzeLinkType(entry.url || url).service,
                thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url,
                options: {
                  quality: (quality || 'best') as any,
                  subtitleLang: subtitle_lang || undefined,
                  downloadPath: playlistPath,
                  estimatedVideoSize: estimated_size || undefined,
                }
              }));

              addTasksBulk(bulkItems).then(() => {
                toast.success(`Added ${bulkItems.length} videos from playlist`);
              });
            });
            return;
          }

          // Instant background download logic (Single Video) 🚀
          import('../../lib/linkAnalyzer').then(({ analyzeLinkType }) => {
            const info = analyzeLinkType(url);
            const options = {
              quality: (quality || 'best') as any,
              subtitleLang: subtitle_lang || undefined,
              downloadPath: download_path || baseDownloadPath,
              estimatedVideoSize: estimated_size || undefined,
            };

            const finalizeAdd = (finalTitle: string, finalThumb?: string) => {
              addTask(url, info.service, options, finalTitle, finalThumb).then(() => {
                toast.success(`Added to queue: ${finalTitle}`);
              });
            };

            // Phase 54: use parsed metadata if available, skip analyzeLink
            if (parsedMeta) {
              finalizeAdd(parsedMeta.title || title || 'Unknown', thumbnail || parsedMeta.thumbnail);
            } else if (title && thumbnail) {
              finalizeAdd(title, thumbnail);
            } else {
              analyzeLink(url).then(result => {
                if (!result?.metadata) return;
                finalizeAdd(result.metadata.title, result.metadata.thumbnail);
              });
            }
          });
        } else {
          setIsAddDialogOpen(true);
        }
      });
    };

    setupListener();
    return () => { if (unlisten) unlisten(); };
  }, [baseDownloadPath, addTask, analyzeLink]);

  const filteredTasks = tasks.filter(t => matchesFilter(t, filter));

  /* ── handlers ─────────────────────────────────────────────────── */

  const handleOpenAddDialog = () => {
    setPrefilledUrl(undefined);
    setIsAddDialogOpen(true);
  };

  const handleSelectDefaultPath = async () => {
    const selected = await open({ directory: true, multiple: false, defaultPath: baseDownloadPath });
    if (selected && typeof selected === 'string') {
      setBaseDownloadPath(selected);
      toast.success('Default storage updated');
    }
  };

  const handleRemoveTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (task.status !== 'completed') {
      const ok = await ask(
        `The download "${task.title}" is not finished. Do you want to cancel it and remove all temporary files?`,
        { title: 'OmniDownloader', kind: 'warning' }
      );
      if (!ok) return;
      await removeTask(id, true);
    } else {
      await removeTask(id);
    }
  };

  const handleClearList = async () => {
    if (tasks.some(t => t.status !== 'completed')) {
      const ok = await ask(
        'Some downloads in the list are not finished. Do you want to clear the list and remove all temporary files?',
        { title: 'OmniDownloader', kind: 'warning' }
      );
      if (!ok) return;
    }
    await clearTasks();
  };

  const handlePauseTask = (id: string) => {
    stopDownload();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'paused', speed: undefined, eta: undefined } : t));
  };

  const handleResumeTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) startDownload(task.url, task.service, task.options, id);
  };

  const handleOpenFolder = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) await revealFolder(task.options.downloadPath || baseDownloadPath);
  };

  /* ── render ────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div
        className="shrink-0 h-20 bg-card border-b border-border flex items-center px-6 justify-between shadow-2xl z-10 transition-colors duration-500"
        style={{ borderBottomColor: 'rgba(126,202,196,0.15)' }}
      >
        {/* Left: logo + actions */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-primary/20">
                <img src={Logo} alt="OmniDownloader Logo" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-xl font-black tracking-tighter flex flex-col leading-none">
                <span className="text-primary">OMNI</span>
                <span className="text-foreground text-sm tracking-[0.2em]">DOWNLOADER</span>
              </h1>
            </div>
            <p className="text-[9px] uppercase font-bold tracking-[3px] text-muted-foreground mt-1 ml-14">v2.4 Lavender Tech</p>
          </div>

          <div className="h-10 w-px bg-border mx-2" />

          <div className="flex items-center gap-1">
            <Button onClick={handleOpenAddDialog} variant="hero" className="flex-col h-16 border-none gap-1 px-4">
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Add URL</span>
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" className="flex-col h-16 border-none hover:bg-muted text-muted-foreground hover:text-primary gap-1 px-4 transition-all">
                  <Search className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Search</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh] bg-background border-border p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>YouTube Search</SheetTitle>
                  <SheetDescription>Search for videos, shorts, or playlists directly.</SheetDescription>
                </SheetHeader>
                <SearchTab
                  onSearch={handleSearch}
                  isSearching={isSearching}
                  searchResults={searchResults}
                  onDownload={(u) => {
                    setPrefilledUrl(u);
                    setIsAddDialogOpen(true);
                  }}
                />
              </SheetContent>
            </Sheet>

            <Button
              onClick={stopDownload}
              disabled={isStopDisabled}
              variant="ghost"
              className="flex-col h-16 border-none hover:bg-muted text-muted-foreground hover:text-destructive gap-1 px-4 disabled:opacity-20 transition-all"
            >
              <Pause className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Stop All</span>
            </Button>

            <Button
              onClick={handleClearList}
              variant="ghost"
              className="flex-col h-16 border-none hover:bg-muted text-muted-foreground hover:text-destructive gap-1 px-4 transition-all"
            >
              <Trash2 className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Clear List</span>
            </Button>
          </div>
        </div>

        {/* Right: storage + theme + logs */}
        <div className="flex items-center gap-4">
          <StoragePicker
            path={baseDownloadPath}
            onChangePath={handleSelectDefaultPath}
            onOpenFolder={() => revealFolder()}
          />
          <ThemeToggle />
          {import.meta.env.DEV && (
            <Button
              onClick={() => setIsLogsOpen(v => !v)}
              variant="outline"
              className={`h-10 w-10 p-0 rounded-xl transition-all ${
                isLogsOpen
                  ? 'bg-[var(--acc-300)] border-[var(--acc-300)] text-white'
                  : 'text-muted-foreground border-border hover:bg-muted hover:text-[var(--acc-300)]'
              }`}
            >
              <Terminal className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden transition-colors duration-500">
        <FilterSidebar tasks={tasks} filter={filter} onFilterChange={setFilter} />

        <div className="flex-1 flex flex-col bg-background/50 overflow-hidden relative">
          <DownloadTable
            tasks={filteredTasks}
            onRemove={handleRemoveTask}
            onPause={handlePauseTask}
            onResume={handleResumeTask}
            onOpenFolder={handleOpenFolder}
            onReorder={reorderTask}
            isQueueActive={isQueueActive}
            onPreview={(url, title) => setPlayingVideo({ url, title })}
          />

          {import.meta.env.DEV && isLogsOpen && (
            <div className="absolute inset-x-0 bottom-0 h-1/3 border-t border-border shadow-2xl z-20">
              <LogViewer
                logs={logs}
                progress={progress}
                onClear={() => setLogs([])}
                onStop={stopDownload}
                isStopDisabled={isStopDisabled}
                endRef={endRef as React.RefObject<HTMLDivElement>}
              />
            </div>
          )}
        </div>
      </div>

      {playingVideo && (
        <VideoPlayer
          url={playingVideo.url}
          title={playingVideo.title}
          onClose={() => setPlayingVideo(null)}
        />
      )}

      {/* ── Dialogs ──────────────────────────────────────────────── */}
      <SmartAddDialog
        isOpen={isAddDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false);
          setPrefilledUrl(undefined);
          setPrefilledOptions(undefined);
        }}
        initialUrl={prefilledUrl}
        initialOptions={prefilledOptions}
        onAnalyze={analyzeLink}
        onAdd={(u, s, o, t, th) => {
          addTask(u, s, o, t, th).then(id => {
            if (!isQueueActive) startDownload(u, s, o, id);
            else toast.info('Added to queue');
          });
        }}
        onAddBulk={(items) => {
          addTasksBulk(items).then(ids => {
            if (!isQueueActive) items.forEach((item, i) => startDownload(item.url, item.service, item.options, ids[i]));
            else toast.success(`Success: Added ${items.length} items to queue`);
          });
        }}
        defaultPath={baseDownloadPath}
        onSelectPath={async () => {
          const selected = await open({ directory: true, multiple: false });
          return (selected as string) || undefined;
        }}
      />
    </div>
  );
}
