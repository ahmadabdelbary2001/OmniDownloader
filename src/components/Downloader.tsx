import { useState } from 'react';
import { 
  Terminal, Search, Folder, FolderOpen, Plus, Pause, Trash2, 
  Clock, CheckCircle2, AlertCircle, Info, LayoutGrid,
  Sun, Moon
} from 'lucide-react';
import { toast } from "sonner";
import { open, ask } from '@tauri-apps/plugin-dialog';

import { useDownloader } from '../hooks/useDownloader';
import { DownloadTable } from './downloader/DownloadTable';
import { SmartAddDialog } from './downloader/SmartAddDialog';
import { SearchTab } from './downloader/SearchTab';
import { LogViewer } from './downloader/LogViewer';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Badge } from './ui/badge';
import { useTheme } from './ThemeProvider';
import { cn } from "../lib/utils";
import Logo from '../assets/logo.svg';

export function Downloader() {
  const {
    logs,
    setLogs,
    progress,
    isSearching,
    searchResults,
    handleSearch,
    startDownload,
    analyzeLink,
    stopDownload,
    isStopDisabled,
    endRef,
    baseDownloadPath,
    setBaseDownloadPath,
    tasks,
    setTasks,
    addTask,
    removeTask,
    clearTasks,
    isQueueActive,
    reorderTask,
    addTasksBulk,
    revealFolder
  } = useDownloader();

  const { theme, setTheme } = useTheme();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'downloading' | 'completed' | 'failed'>('all');

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'downloading') return ['downloading', 'waiting', 'analyzing'].includes(task.status);
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'failed') return ['paused', 'failed'].includes(task.status);
    return true;
  });

  const handleSelectDefaultPath = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: baseDownloadPath
    });
    if (selected && typeof selected === 'string') {
      setBaseDownloadPath(selected);
      toast.success("Default storage updated");
    }
  };

  const handleRemoveTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.status !== 'completed') {
      const confirmed = await ask(
        `The download "${task.title}" is not finished. Do you want to cancel it and remove all temporary files?`,
        { title: 'OmniDownloader', kind: 'warning' }
      );
      if (!confirmed) return;
      await removeTask(id, true);
    } else {
      await removeTask(id);
    }
  };

  const handleClearList = async () => {
    const hasUnfinished = tasks.some(t => t.status !== 'completed');
    if (hasUnfinished) {
      const confirmed = await ask(
        'Some downloads in the list are not finished. Do you want to clear the list and remove all temporary files?',
        { title: 'OmniDownloader', kind: 'warning' }
      );
      if (!confirmed) return;
    }
    await clearTasks();
  };

  const handlePauseTask = (id: string) => {
    stopDownload();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'paused', speed: undefined, eta: undefined } : t));
  };

  const handleResumeTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
        startDownload(task.url, task.service, task.options, id);
    }
  };

  const handleOpenFolder = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
        const folderPath = task.options.downloadPath || baseDownloadPath;
        await revealFolder(folderPath);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Top Toolbar - IDM Style */}
      <div className="shrink-0 h-20 bg-card border-b border-border flex items-center px-6 justify-between shadow-2xl z-10 transition-colors duration-500" style={{ borderBottomColor: 'rgba(126,202,196,0.15)' }}>
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
            <p className="text-[9px] uppercase font-bold tracking-[3px] text-muted-foreground mt-1 ml-14">v2.2 Lavender Tech</p>
          </div>

          <div className="h-10 w-px bg-border mx-2" />

          <div className="flex items-center gap-1">
            <Button 
                onClick={() => setIsAddDialogOpen(true)}
                variant="accent"
                className="flex-col h-16 border-none gap-1 px-4"
            >
                <Plus className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Add URL</span>
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" className="flex-col h-16 border-none hover:bg-muted text-muted-foreground hover:text-[var(--acc-300)] gap-1 px-4 transition-all">
                  <Search className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Search</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh] bg-background border-border p-0">
                <SearchTab 
                    onSearch={handleSearch}
                    isSearching={isSearching}
                    searchResults={searchResults}
                    onDownload={(u) => {
                        startDownload(u, 'ytdlp');
                        toast.success("Added to manager!");
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

        <div className="flex items-center gap-4">
            <div 
                className="flex items-center gap-1 bg-muted/50 border border-border rounded-xl transition-all group overflow-hidden"
            >
                <div 
                    onClick={handleSelectDefaultPath}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-muted cursor-pointer border-r border-border/50 transition-all"
                >
                    <Folder className="w-4 h-4 text-[var(--acc-300)] group-hover:scale-110 transition-transform" />
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Storage</span>
                        <span className="text-[10px] font-bold text-foreground/60 truncate max-w-[120px]">{baseDownloadPath.split(/[\\/]/).pop() || 'Downloads'}</span>
                    </div>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 rounded-none hover:bg-primary/10 hover:text-primary transition-all"
                    onClick={() => revealFolder()}
                >
                    <FolderOpen className="w-4 h-4" />
                </Button>
            </div>

            <div className="flex bg-muted p-1 rounded-xl gap-1">
                <Button 
                    onClick={() => setTheme("light")} 
                    variant={theme === "light" ? "default" : "ghost"} 
                    className="h-8 w-8 p-0 rounded-lg transition-all"
                >
                    <Sun className="w-4 h-4 text-[var(--acc-300)]" />
                </Button>
                <Button 
                    onClick={() => setTheme("dark")} 
                    variant={theme === "dark" ? "default" : "ghost"} 
                    className={cn("h-8 w-8 p-0 rounded-lg transition-all", theme === "dark" && "bg-[var(--acc-300)] text-white hover:bg-[var(--acc-400)] shadow-[0_0_12px_rgba(126,202,196,0.2)]")}
                >
                    <Moon className="w-4 h-4" />
                </Button>
            </div>

            <Button onClick={() => setIsLogsOpen(!isLogsOpen)} variant="outline" className={`h-10 w-10 p-0 rounded-xl transition-all ${isLogsOpen ? 'bg-[var(--acc-300)] border-[var(--acc-300)] text-white' : 'text-muted-foreground border-border hover:bg-muted hover:text-[var(--acc-300)]'}`}>
                <Terminal className="w-5 h-5" />
            </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden transition-colors duration-500">
        {/* Sidebar Filters */}
        <div className="w-64 bg-card border-r border-border p-6 flex flex-col gap-8 shrink-0 transition-colors dark:bg-grad-dark overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[3px] text-muted-foreground px-2">Categories</h3>
            <div className="space-y-1">
              {[
                { id: 'all', label: 'All Downloads', icon: LayoutGrid },
                { id: 'downloading', label: 'In Progress', icon: Clock },
                { id: 'completed', label: 'Finished', icon: CheckCircle2 },
                { id: 'failed', label: 'Unfinished', icon: AlertCircle },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id as any)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all border",
                    filter === item.id 
                    ? "bg-[var(--acc-300)]/15 text-[var(--acc-400)] border-[var(--acc-300)]/30 shadow-[0_0_15px_rgba(126,202,196,0.1)]" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4" />
                    <span className="text-xs font-bold">{item.label}</span>
                  </div>
                  <Badge variant="ghost" className="text-[10px] p-0 px-1 opacity-40">
                    {tasks.filter(t => {
                        if (item.id === 'all') return true;
                        if (item.id === 'downloading') return ['downloading', 'waiting', 'analyzing'].includes(t.status);
                        if (item.id === 'completed') return t.status === 'completed';
                        if (item.id === 'failed') return ['paused', 'failed'].includes(t.status);
                        return false;
                    }).length}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto p-4 rounded-xl bg-accent/[0.05] border border-accent/20 flex flex-col gap-2 transition-all shadow-[inset_0_0_20px_rgba(126,202,196,0.03)]">
            <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-accent" />
                <span className="text-[10px] font-black uppercase tracking-widest text-accent">Smart Engine</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">Automatic protocol detection active. Supports YT, Telegram & Direct links.</p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-background/50 overflow-hidden relative">
           <DownloadTable 
             tasks={filteredTasks}
             onRemove={handleRemoveTask}
             onPause={handlePauseTask}
             onResume={handleResumeTask}
             onOpenFolder={handleOpenFolder}
             onReorder={reorderTask}
             isQueueActive={isQueueActive}
           />

           {/* Small mini-logs at bottom if open */}
           {isLogsOpen && (
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

      {/* Dialogs */}
      <SmartAddDialog 
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAnalyze={analyzeLink}
        onAdd={(u, s, o, t, th) => {
            addTask(u, s, o, t, th).then(id => {
                if (!isQueueActive) {
                    startDownload(u, s, o, id);
                } else {
                    toast.info("Added to queue");
                }
            });
        }}
        onAddBulk={(items) => {
            addTasksBulk(items).then(ids => {
                if (!isQueueActive) {
                    items.forEach((item, i) => {
                        startDownload(item.url, item.service, item.options, ids[i]);
                    });
                } else {
                    toast.success(`Success: Added ${items.length} items to queue`);
                }
            });
        }}
        defaultPath={baseDownloadPath}
        onSelectPath={async () => {
            const selected = await open({ directory: true, multiple: false });
            return selected as string || undefined;
        }}
      />
    </div>
  );
}
