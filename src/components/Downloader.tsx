import { useState } from 'react';
import { 
  Download, Terminal, Search, Folder, Plus, Pause, Trash2, 
  Clock, CheckCircle2, AlertCircle, Info, LayoutGrid, ListChecks
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
    setIsQueueActive,
    reorderTask
  } = useDownloader();

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
    // Current simple implementation: stop the global process
    // and specifically mark this task as paused in the list
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
        const path = task.options.downloadPath || baseDownloadPath;
        toast.info(`Location: ${path}`);
        // Future: Add platform-specific folder opening command (explorer/xdg-open)
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      {/* Top Toolbar - IDM Style */}
      <div className="shrink-0 h-20 bg-slate-900 border-b border-white/5 flex items-center px-6 justify-between shadow-2xl z-10">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-lg font-black tracking-tighter flex items-center gap-2">
              <div className="p-1.5 bg-blue-600 rounded-lg">
                <Download className="w-5 h-5 text-white" />
              </div>
              OMNI<span className="text-blue-500">DOWNLOADER</span>
            </h1>
            <p className="text-[9px] uppercase font-bold tracking-[3px] text-white/30 text-center">Version 2.0 Pro</p>
          </div>

          <div className="h-10 w-px bg-white/5 mx-2" />

          <div className="flex items-center gap-1">
            <Button 
                onClick={() => setIsAddDialogOpen(true)}
                className="flex-col h-16 border-none bg-transparent hover:bg-white/5 text-white/60 hover:text-blue-400 gap-1 px-4"
            >
                <Plus className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Add URL</span>
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button className="flex-col h-16 border-none bg-transparent hover:bg-white/5 text-white/60 hover:text-cyan-400 gap-1 px-4">
                  <Search className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Search</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh] bg-slate-950 border-white/5 p-0">
                <SearchTab 
                    onSearch={handleSearch}
                    isSearching={isSearching}
                    searchResults={searchResults}
                    onDownload={(u) => {
                        // For search results, we open the add dialog with the URL
                        // setIsAddDialogOpen(true);
                        // setUrl(u);
                        // Future: Auto-analyze results
                        startDownload(u, 'ytdlp');
                        toast.success("Added to manager!");
                    }}
                />
              </SheetContent>
            </Sheet>

            <Button 
                onClick={stopDownload}
                disabled={isStopDisabled}
                className="flex-col h-16 border-none bg-transparent hover:bg-white/5 text-white/60 hover:text-red-400 gap-1 px-4 disabled:opacity-20"
            >
                <Pause className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Stop All</span>
            </Button>

            <Button 
                onClick={handleClearList}
                className="flex-col h-16 border-none bg-transparent hover:bg-white/5 text-white/60 hover:text-red-500 gap-1 px-4"
            >
                <Trash2 className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Clear List</span>
            </Button>

            <div className="h-10 w-px bg-white/5 mx-2" />

            <Button 
                onClick={() => setIsQueueActive(!isQueueActive)}
                className={`flex-col h-16 border-none bg-transparent hover:bg-white/5 gap-1 px-4 transition-all ${isQueueActive ? 'text-blue-400' : 'text-white/20'}`}
            >
                <div className="relative">
                    <ListChecks className="w-5 h-5" />
                    {isQueueActive && <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Smart Queue</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
            <div 
                onClick={handleSelectDefaultPath}
                className="flex items-center gap-3 px-4 py-2 bg-black/40 border border-white/5 rounded-xl cursor-pointer hover:border-blue-500/50 transition-all group"
            >
                <Folder className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase text-white/20 tracking-widest">Storage</span>
                    <span className="text-[10px] font-bold text-white/60 truncate max-w-[150px]">{baseDownloadPath.split(/[\\/]/).pop() || 'Downloads'}</span>
                </div>
            </div>

            <Button onClick={() => setIsLogsOpen(!isLogsOpen)} variant="outline" className={`h-10 w-10 p-0 rounded-xl ${isLogsOpen ? 'bg-blue-600 border-blue-600 text-white' : 'text-white/20 border-white/5'}`}>
                <Terminal className="w-5 h-5" />
            </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Filters */}
        <div className="w-64 bg-slate-900/50 border-r border-white/5 p-6 flex flex-col gap-8 shrink-0">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[3px] text-white/20 px-2">Categories</h3>
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
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all ${
                    filter === item.id 
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                    : 'text-white/40 hover:text-white/60 hover:bg-white/5 border border-transparent'
                  }`}
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

          <div className="mt-auto p-4 rounded-xl bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/10 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Smart Engine</span>
            </div>
            <p className="text-[10px] text-blue-200/40 leading-relaxed font-medium">Automatic protocol detection active. Supports YT, Telegram & Direct links.</p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-black/20 overflow-hidden relative">
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
             <div className="absolute inset-x-0 bottom-0 h-1/3 border-t border-white/10 shadow-2xl z-20">
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
        defaultPath={baseDownloadPath}
        onSelectPath={async () => {
            const selected = await open({ directory: true, multiple: false });
            return selected as string || undefined;
        }}
      />
    </div>
  );
}
