import { DownloadTask } from "../../types/downloader";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { Play, Pause, X, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "../ui/button";

interface DownloadTableProps {
  tasks: DownloadTask[];
  onRemove: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onOpenFolder: (id: string) => void;
}

export function DownloadTable({ tasks, onRemove, onPause, onResume, onOpenFolder }: DownloadTableProps) {
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
      <div className="grid grid-cols-12 gap-2 p-3 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/40 border-b border-white/5">
        <div className="col-span-4">File Name</div>
        <div className="col-span-2">Size</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-3">Progress</div>
        <div className="col-span-1 text-right">Action</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.map((task) => (
          <div 
            key={task.id} 
            className="grid grid-cols-12 gap-2 p-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors items-center group"
          >
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

            <div className="col-span-2 text-xs text-white/60 font-mono">
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
              {(task.status === 'paused' || task.status === 'failed') && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-500 hover:text-blue-400" onClick={() => onResume(task.id)}>
                  <Play className="w-3.5 h-3.5" />
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
