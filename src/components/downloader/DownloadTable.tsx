import { useState, useMemo } from 'react';
import { DownloadTask } from "../../types/downloader";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { 
    Play, Pause, X, FolderOpen, Loader2, ArrowUp, ArrowDown, 
    ChevronUp, ChevronDown, Search, ArrowUpDown
} from "lucide-react";
import { Button } from "../ui/button";
import { cn, parseSizeToBytes } from "../../lib/utils";
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
    return sortOrder === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-blue-400 ml-1" /> : <ChevronDown className="w-2.5 h-2.5 text-blue-400 ml-1" />;
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/20 p-12">
        <Loader2 className="w-12 h-12 mb-4 opacity-10" />
        <p className="font-bold tracking-widest uppercase text-xs">No downloads in list</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden border-t border-white/5">
      {/* Filter Toolbar */}
      <div className="flex items-center justify-between p-2 px-3 bg-black/20 gap-4 border-b border-white/5">
        <div className="flex items-center gap-1 bg-white/5 rounded-md p-0.5 border border-white/5">
            <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-6 text-[9px] px-2 font-black uppercase tracking-widest", filterStatus === 'all' ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}
                onClick={() => setFilterStatus('all')}
            >All</Button>
            <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-6 text-[9px] px-2 font-black uppercase tracking-widest", filterStatus === 'ongoing' ? "bg-blue-500/20 text-blue-400" : "text-white/40 hover:text-white")}
                onClick={() => setFilterStatus('ongoing')}
            >Ongoing</Button>
            <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-6 text-[9px] px-2 font-black uppercase tracking-widest", filterStatus === 'finished' ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white")}
                onClick={() => setFilterStatus('finished')}
            >Finished</Button>
            <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-6 text-[9px] px-2 font-black uppercase tracking-widest", filterStatus === 'paused' ? "bg-yellow-500/20 text-yellow-400" : "text-white/40 hover:text-white")}
                onClick={() => setFilterStatus('paused')}
            >Paused/Failed</Button>
        </div>

        <div className="relative flex-1 max-w-[230px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
            <Input 
                placeholder="SEARCH DOWNLOADS..." 
                className="h-7 bg-white/5 border-white/5 pl-7 text-[10px] font-bold tracking-widest uppercase focus-visible:ring-blue-500/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white">
                    <X className="w-3 h-3" />
                </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-1 p-3 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/40 border-b border-white/5 select-none">
        <div className="col-span-1 flex items-center cursor-pointer hover:text-white transition-colors group/head" onClick={() => toggleSort('queueOrder')}>
            # <SortIcon k="queueOrder" />
        </div>
        <div className="col-span-4 flex items-center cursor-pointer hover:text-white transition-colors group/head" onClick={() => toggleSort('title')}>
            File Name <SortIcon k="title" />
        </div>
        <div className="col-span-1 flex items-center cursor-pointer hover:text-white transition-colors group/head" onClick={() => toggleSort('size')}>
            Size <SortIcon k="size" />
        </div>
        <div className="col-span-2 flex items-center cursor-pointer hover:text-white transition-colors group/head" onClick={() => toggleSort('status')}>
            Status <SortIcon k="status" />
        </div>
        <div className="col-span-3 flex items-center cursor-pointer hover:text-white transition-colors group/head" onClick={() => toggleSort('progress')}>
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
                "grid grid-cols-12 gap-1 p-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors items-center group relative",
                task.status === 'downloading' && "bg-blue-500/[0.01]"
            )}
          >
            <div className="col-span-1 flex flex-col items-center justify-center gap-0.5">
               {isQueueActive ? (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); onReorder(task.id, 'up'); }} className="text-white/10 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowUp className="w-2.5 h-2.5" />
                    </button>
                    <span className="text-[10px] font-black text-blue-500/60 leading-none">#{task.queueOrder || '-'}</span>
                    <button onClick={(e) => { e.stopPropagation(); onReorder(task.id, 'down'); }} className="text-white/10 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowDown className="w-2.5 h-2.5" />
                    </button>
                  </>
               ) : (
                  <span className="text-[10px] font-black text-white/10">#{task.queueOrder || '-'}</span>
               )}
            </div>

            <div className="col-span-4 flex items-center gap-3 overflow-hidden">
              {task.thumbnail ? (
                <img src={task.thumbnail} className="w-10 h-6 object-cover rounded bg-black/40" alt="" />
              ) : (
                <div className="w-10 h-6 rounded bg-white/5 flex items-center justify-center">
                   <Badge variant="outline" className="text-[8px] p-0 px-1 opacity-40">{task.service}</Badge>
                </div>
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-white/90 truncate">{task.title}</span>
                <span className="text-[9px] text-white/30 truncate uppercase tracking-tighter">{task.url}</span>
              </div>
            </div>

            <div className="col-span-1 text-xs text-white/60 font-mono truncate">
              {task.size || 'Unknown'}
            </div>

            <div className="col-span-2 flex items-center gap-1.5">
              {task.status === 'downloading' && (
                <div className="flex flex-col gap-0.5">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/20 text-[9px] h-4">Active</Badge>
                  <span className="text-[9px] font-mono text-blue-400/70">{task.speed}</span>
                </div>
              )}
              {task.status === 'completed' && <Badge className="bg-green-500/20 text-green-400 border-green-500/20 text-[9px] h-4">Finished</Badge>}
              {task.status === 'paused' && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/20 text-[9px] h-4">Paused</Badge>}
              {task.status === 'failed' && <Badge className="bg-red-500/20 text-red-400 border-red-500/20 text-[9px] h-4">Failed</Badge>}
              {task.status === 'waiting' && <Badge className="bg-white/5 text-white/40 border-white/10 text-[9px] h-4">Queued</Badge>}
            </div>

            <div className="col-span-3 flex flex-col gap-1 pr-4">
              <div className="flex justify-between text-[9px] font-bold text-white/30 tracking-tighter">
                <span>{task.progress.toFixed(1)}%</span>
                {task.status === 'downloading' && <span>{task.eta} left</span>}
              </div>
              <Progress value={task.progress} className="h-1 bg-white/5" />
            </div>

            <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {task.status === 'downloading' && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-yellow-500 hover:text-yellow-400" onClick={() => onPause(task.id)}>
                  <Pause className="w-3.5 h-3.5" />
                </Button>
              )}
              {(task.status === 'paused' || task.status === 'failed' || task.status === 'waiting') && (
                <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7 text-blue-500 hover:text-blue-400 group/btn relative" 
                    onClick={() => onResume(task.id)}
                >
                  <Play className="w-3.5 h-3.5" />
                  {task.status === 'waiting' && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse shadow-[0_0_5px_rgba(96,165,250,0.5)]" />}
                </Button>
              )}
              {task.status === 'completed' && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:text-green-400" onClick={() => onOpenFolder(task.id)}>
                  <FolderOpen className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white/20 hover:text-red-500" onClick={() => onRemove(task.id)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
