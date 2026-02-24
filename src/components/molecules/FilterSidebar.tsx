import { LayoutGrid, Clock, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type { DownloadTask } from '../../types/downloader';

export type FilterType = 'all' | 'downloading' | 'completed' | 'failed';

const FILTERS: { id: FilterType; label: string; icon: React.ElementType }[] = [
  { id: 'all',         label: 'All Downloads', icon: LayoutGrid   },
  { id: 'downloading', label: 'In Progress',   icon: Clock        },
  { id: 'completed',   label: 'Finished',      icon: CheckCircle2 },
  { id: 'failed',      label: 'Unfinished',    icon: AlertCircle  },
];

export function matchesFilter(task: DownloadTask, filter: FilterType): boolean {
  if (filter === 'all')         return true;
  if (filter === 'downloading') return ['downloading', 'waiting', 'analyzing'].includes(task.status);
  if (filter === 'completed')   return task.status === 'completed';
  if (filter === 'failed')      return ['paused', 'failed'].includes(task.status);
  return false;
}

interface FilterSidebarProps {
  tasks: DownloadTask[];
  filter: FilterType;
  onFilterChange: (f: FilterType) => void;
}

export function FilterSidebar({ tasks, filter, onFilterChange }: FilterSidebarProps) {
  return (
    <div className="w-64 bg-card border-r border-border p-6 flex flex-col gap-8 shrink-0 transition-colors dark:bg-grad-dark overflow-y-auto">
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[3px] text-muted-foreground px-2">Categories</h3>
        <div className="space-y-1">
          {FILTERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onFilterChange(id)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all border",
                filter === id
                  ? "bg-[var(--acc-300)]/15 text-[var(--acc-400)] border-[var(--acc-300)]/30 shadow-[0_0_15px_rgba(126,202,196,0.1)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4" />
                <span className="text-xs font-bold">{label}</span>
              </div>
              <Badge variant="ghost" className="text-[10px] p-0 px-1 opacity-40">
                {tasks.filter(t => matchesFilter(t, id)).length}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto p-4 rounded-xl bg-accent/[0.05] border border-accent/20 flex flex-col gap-2 shadow-[inset_0_0_20px_rgba(126,202,196,0.03)]">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-accent" />
          <span className="text-[10px] font-black uppercase tracking-widest text-accent">Smart Engine</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
          Automatic protocol detection active. Supports YT, Telegram &amp; Direct links.
        </p>
      </div>
    </div>
  );
}
