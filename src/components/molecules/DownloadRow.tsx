import { Play, Pause, X, FolderOpen, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { cn, formatBytes } from '../../lib/utils';
import type { DownloadTask } from '../../types/downloader';

interface DownloadRowProps {
  task: DownloadTask;
  isQueueActive: boolean;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onOpenFolder: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
}

export function DownloadRow({ task, isQueueActive, onPause, onResume, onOpenFolder, onRemove, onReorder }: DownloadRowProps) {
  return (
    <div className={cn(
      'grid grid-cols-12 gap-1 p-3 border-b border-border hover:bg-muted/30 transition-colors items-center group relative',
      task.status === 'downloading' && 'bg-primary/[0.03]'
    )}>
      {/* Queue order */}
      <div className="col-span-1 flex flex-col items-center justify-center gap-0.5">
        {isQueueActive ? (
          <>
            <button onClick={e => { e.stopPropagation(); onReorder(task.id, 'up'); }} className="text-muted-foreground/30 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUp className="w-2.5 h-2.5" />
            </button>
            <span className="text-[10px] font-black text-primary leading-none">#{task.queueOrder || '-'}</span>
            <button onClick={e => { e.stopPropagation(); onReorder(task.id, 'down'); }} className="text-muted-foreground/30 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowDown className="w-2.5 h-2.5" />
            </button>
          </>
        ) : (
          <span className="text-[10px] font-black text-muted-foreground/30">#{task.queueOrder || '-'}</span>
        )}
      </div>

      {/* Thumbnail + title */}
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

      {/* Size */}
      <div className="col-span-1 text-[10px] text-muted-foreground font-mono truncate">
        {task.totalBytes ? formatBytes(task.totalBytes) : (task.size || 'Unknown')}
      </div>

      {/* Status badge */}
      <div className="col-span-2 flex items-center gap-1.5">
        {task.status === 'downloading' && (
          <div className="flex flex-col gap-0.5">
            <Badge className="bg-primary/20 text-primary border-primary/20 text-[9px] h-4">Active</Badge>
            <span className="text-[9px] font-mono text-primary/70">{task.speed}</span>
          </div>
        )}
        {task.status === 'completed' && <Badge className="text-[9px] h-4" style={{ background: 'rgba(126,202,196,0.2)', color: 'var(--acc-400)', borderColor: 'rgba(126,202,196,0.25)' }}>Finished</Badge>}
        {task.status === 'paused'    && <Badge className="bg-destructive/10 text-destructive border-destructive/10 text-[9px] h-4">Paused</Badge>}
        {task.status === 'failed'    && <Badge className="bg-destructive/20 text-destructive border-destructive/20 text-[9px] h-4">Failed</Badge>}
        {task.status === 'waiting'   && <Badge className="bg-muted text-muted-foreground border-border text-[9px] h-4">Queued</Badge>}
      </div>

      {/* Progress */}
      <div className="col-span-3 flex flex-col gap-1 pr-4">
        <div className="flex justify-between text-[9px] font-bold text-muted-foreground tracking-tighter">
          <div className="flex gap-1">
            <span className="text-primary">{Math.min(100, task.progress).toFixed(1)}%</span>
            {task.totalBytes !== undefined && task.totalBytes > 0 && (
              <span className="opacity-60">({formatBytes(task.downloadedBytes || 0)} / {formatBytes(task.totalBytes)})</span>
            )}
          </div>
          {task.status === 'downloading' && <span>{task.eta} left</span>}
        </div>
        <Progress value={task.progress} className="h-1 bg-muted" />
      </div>

      {/* Actions */}
      <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {task.status === 'downloading' && (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive/80" onClick={() => onPause(task.id)}>
            <Pause className="w-3.5 h-3.5" />
          </Button>
        )}
        {['paused', 'failed', 'waiting'].includes(task.status) && (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary group/btn relative" onClick={() => onResume(task.id)}>
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
  );
}
