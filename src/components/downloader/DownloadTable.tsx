import { useState, useMemo } from 'react';
import { DownloadTask } from "../../types/downloader";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { 
    Play, Pause, X, FolderOpen, ArrowUp, ArrowDown, 
    ChevronUp, ChevronDown, Search, ArrowUpDown, Plus
} from "lucide-react";
import Logo from '../../assets/logo.svg';
import { Button } from "../ui/button";
import { cn, parseSizeToBytes, formatBytes } from "../../lib/utils";
import { Input } from "../ui/input";

interface DownloadTableProps {
  tasks: DownloadTask[];
  onRemove: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onOpenFolder: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  isQueueActive: boolean;
}

export function DownloadTable({ tasks, onRemove, onPause, onResume, onOpenFolder, onReorder, isQueueActive }: DownloadTableProps) {
  const [sortKey, setSortKey] = useState<string>(() => localStorage.getItem('omni_sort_key') || 'queueOrder');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => (localStorage.getItem('omni_sort_order') as 'asc' | 'desc') || 'asc');
  const [filterStatus, setFilterStatus] = useState<string>(() => localStorage.getItem('omni_filter_status') || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  // Persistence
  useMemo(() => {
    localStorage.setItem('omni_sort_key', sortKey);
    localStorage.setItem('omni_sort_order', sortOrder);
    localStorage.setItem('omni_filter_status', filterStatus);
  }, [sortKey, sortOrder, filterStatus]);

  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks];

    // Filtering
    if (filterStatus !== 'all') {
      result = result.filter(t => {
        if (filterStatus === 'ongoing') return ['downloading', 'waiting', 'analyzing'].includes(t.status);
        if (filterStatus === 'finished') return t.status === 'completed';
        if (filterStatus === 'paused') return t.status === 'paused' || t.status === 'failed';
        return true;
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q));
    }

    // Sorting
    result.sort((a, b) => {
      let valA: any, valB: any;

      switch (sortKey) {
        case 'title':
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
          break;
        case 'size':
          valA = parseSizeToBytes(a.size || '0');
          valB = parseSizeToBytes(b.size || '0');
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
        case 'progress':
          valA = a.progress;
          valB = b.progress;
          break;
        case 'queueOrder':
          valA = a.queueOrder || 0;
          valB = b.queueOrder || 0;
          break;
        default:
          valA = a.createdAt;
          valB = b.createdAt;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [tasks, sortKey, sortOrder, filterStatus, searchQuery]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ k }: { k: string }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover/head:opacity-100 transition-opacity ml-1" />;
    return sortOrder === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-primary ml-1" /> : <ChevronDown className="w-2.5 h-2.5 text-primary ml-1" />;
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full relative overflow-hidden">
        {/* Background aurora effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.06]" style={{ background: 'var(--grad-aurora)' }} />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, var(--acc-300), transparent)' }} />
          <div className="absolute top-1/4 right-1/4 w-48 h-48 rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, var(--lav-400), transparent)' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-sm text-center p-8">
          {/* Logo Hero */}
          <div
            className="w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl relative"
            style={{ background: 'var(--grad-hero)' }}
          >
            <div className="absolute inset-0 rounded-3xl opacity-40" style={{ background: 'radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.25) 0%, transparent 60%)' }} />
            <img src={Logo} alt="OmniDownloader" className="w-16 h-16 drop-shadow-xl relative z-10" />
          </div>

          {/* Title & Sub */}
          <div className="space-y-2">
            <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--acc-300)' }}>
              Ready to Download
            </h2>
            <p className="text-xs font-bold text-muted-foreground tracking-widest uppercase">
              No downloads in your list yet
            </p>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed mt-2">
              Add a URL by clicking <strong className="text-accent">Add URL</strong> in the toolbar above
            </p>
          </div>

          {/* Decorative badge */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border"
            style={{
              background: 'rgba(126,202,196,0.08)',
              borderColor: 'rgba(126,202,196,0.2)',
              color: 'var(--acc-400)'
            }}
          >
            <Plus className="w-3 h-3" />
            Add URL to get started
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden border-t border-border">
      {/* Filter Toolbar */}
      <div className="flex items-center justify-between p-2 px-3 bg-muted/20 gap-4 border-b border-border">
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 border border-border">
            <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-6 text-[9px] px-2 font-black uppercase tracking-widest transition-all", filterStatus === 'all' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setFilterStatus('all')}
            >All</Button>
            <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-6 text-[9px] px-2 font-black uppercase tracking-widest transition-all", filterStatus === 'ongoing' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setFilterStatus('ongoing')}
            >Ongoing</Button>
            <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-6 text-[9px] px-2 font-black uppercase tracking-widest transition-all", filterStatus === 'finished' ? "bg-accent/20 text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setFilterStatus('finished')}
            >Finished</Button>
            <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-6 text-[9px] px-2 font-black uppercase tracking-widest transition-all", filterStatus === 'paused' ? "bg-destructive/20 text-destructive" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setFilterStatus('paused')}
            >Paused/Failed</Button>
        </div>

        <div className="relative flex-1 max-w-[230px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input 
                placeholder="SEARCH DOWNLOADS..." 
                className="h-7 bg-muted/50 border-border pl-7 text-[10px] font-bold tracking-widest uppercase focus-visible:ring-primary/50 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-1 p-3 bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border select-none">
        <div className="col-span-1 flex items-center cursor-pointer hover:text-foreground transition-colors group/head" onClick={() => toggleSort('queueOrder')}>
            # <SortIcon k="queueOrder" />
        </div>
        <div className="col-span-4 flex items-center cursor-pointer hover:text-foreground transition-colors group/head" onClick={() => toggleSort('title')}>
            File Name <SortIcon k="title" />
        </div>
        <div className="col-span-1 flex items-center cursor-pointer hover:text-foreground transition-colors group/head" onClick={() => toggleSort('size')}>
            Size <SortIcon k="size" />
        </div>
        <div className="col-span-2 flex items-center cursor-pointer hover:text-foreground transition-colors group/head" onClick={() => toggleSort('status')}>
            Status <SortIcon k="status" />
        </div>
        <div className="col-span-3 flex items-center cursor-pointer hover:text-foreground transition-colors group/head" onClick={() => toggleSort('progress')}>
            Progress <SortIcon k="progress" />
        </div>
        <div className="col-span-1 text-right flex items-center justify-end">
            Action
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredAndSortedTasks.map((task) => (
          <div 
            key={task.id} 
            className={cn(
                "grid grid-cols-12 gap-1 p-3 border-b border-border hover:bg-muted/30 transition-colors items-center group relative",
                task.status === 'downloading' && "bg-primary/[0.03]"
            )}
          >
            <div className="col-span-1 flex flex-col items-center justify-center gap-0.5">
               {isQueueActive ? (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); onReorder(task.id, 'up'); }} className="text-muted-foreground/30 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowUp className="w-2.5 h-2.5" />
                    </button>
                    <span className="text-[10px] font-black text-primary leading-none">#{task.queueOrder || '-'}</span>
                    <button onClick={(e) => { e.stopPropagation(); onReorder(task.id, 'down'); }} className="text-muted-foreground/30 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowDown className="w-2.5 h-2.5" />
                    </button>
                  </>
               ) : (
                  <span className="text-[10px] font-black text-muted-foreground/30">#{task.queueOrder || '-'}</span>
               )}
            </div>

            <div className="col-span-4 flex items-center gap-3 overflow-hidden">
              {task.thumbnail ? (
                <img src={task.thumbnail} className="w-10 h-6 object-cover rounded bg-muted border border-border" alt="" />
              ) : (
                <div className="w-10 h-6 rounded bg-muted border border-border flex items-center justify-center">
                   <Badge variant="outline" className="text-[8px] p-0 px-1 opacity-40">{task.service}</Badge>
                </div>
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-foreground/90 truncate">{task.title}</span>
                <span className="text-[9px] text-muted-foreground truncate uppercase tracking-tighter">{task.url}</span>
              </div>
            </div>

            <div className="col-span-1 text-[10px] text-muted-foreground font-mono truncate">
              {task.totalBytes ? formatBytes(task.totalBytes) : (task.size || 'Unknown')}
            </div>

            <div className="col-span-2 flex items-center gap-1.5">
              {task.status === 'downloading' && (
                <div className="flex flex-col gap-0.5">
                  <Badge className="bg-primary/20 text-primary border-primary/20 text-[9px] h-4">Active</Badge>
                  <span className="text-[9px] font-mono text-primary/70">{task.speed}</span>
                </div>
              )}
              {task.status === 'completed' && <Badge className="text-[9px] h-4" style={{ background: 'rgba(126,202,196,0.2)', color: 'var(--acc-400)', borderColor: 'rgba(126,202,196,0.25)' }}>Finished</Badge>}
              {task.status === 'paused' && <Badge className="bg-destructive/10 text-destructive border-destructive/10 text-[9px] h-4">Paused</Badge>}
              {task.status === 'failed' && <Badge className="bg-destructive/20 text-destructive border-destructive/20 text-[9px] h-4">Failed</Badge>}
              {task.status === 'waiting' && <Badge className="bg-muted text-muted-foreground border-border text-[9px] h-4">Queued</Badge>}
            </div>

            <div className="col-span-3 flex flex-col gap-1 pr-4">
              <div className="flex justify-between text-[9px] font-bold text-muted-foreground tracking-tighter">
                <div className="flex gap-1">
                   <span className="text-primary">{Math.min(100, task.progress).toFixed(1)}%</span>
                   {task.totalBytes !== undefined && task.totalBytes > 0 && (
                     <span className="opacity-60">
                       ({formatBytes(task.downloadedBytes || 0)} / {formatBytes(task.totalBytes)})
                     </span>
                   )}
                </div>
                {task.status === 'downloading' && <span>{task.eta} left</span>}
              </div>
              <Progress value={task.progress} className="h-1 bg-muted" />
            </div>

            <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {task.status === 'downloading' && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive/80" onClick={() => onPause(task.id)}>
                  <Pause className="w-3.5 h-3.5" />
                </Button>
              )}
              {(task.status === 'paused' || task.status === 'failed' || task.status === 'waiting') && (
                <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7 text-primary hover:text-primary group/btn relative" 
                    onClick={() => onResume(task.id)}
                >
                  <Play className="w-3.5 h-3.5" />
                  {task.status === 'waiting' && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_5px_rgba(var(--primary),0.5)]" />}
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary" onClick={() => onOpenFolder(task.id)}>
                <FolderOpen className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground/30 hover:text-destructive" onClick={() => onRemove(task.id)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
