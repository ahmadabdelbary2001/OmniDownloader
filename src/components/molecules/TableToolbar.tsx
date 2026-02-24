import { Search, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

type StatusFilter = 'all' | 'ongoing' | 'finished' | 'paused';

const FILTERS: { id: StatusFilter; label: string; activeClass: string }[] = [
  { id: 'all',      label: 'All',          activeClass: 'bg-background text-foreground shadow-sm' },
  { id: 'ongoing',  label: 'Ongoing',      activeClass: 'bg-primary/20 text-primary' },
  { id: 'finished', label: 'Finished',     activeClass: 'bg-accent/20 text-accent-foreground' },
  { id: 'paused',   label: 'Paused/Failed',activeClass: 'bg-destructive/20 text-destructive' },
];

interface TableToolbarProps {
  filterStatus: StatusFilter;
  onFilterChange: (f: StatusFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function TableToolbar({ filterStatus, onFilterChange, searchQuery, onSearchChange }: TableToolbarProps) {
  return (
    <div className="flex items-center justify-between p-2 px-3 bg-muted/20 gap-4 border-b border-border">
      <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 border border-border">
        {FILTERS.map(({ id, label, activeClass }) => (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 text-[9px] px-2 font-black uppercase tracking-widest transition-all',
              filterStatus === id ? activeClass : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onFilterChange(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="relative flex-1 max-w-[230px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <Input
          placeholder="SEARCH DOWNLOADS..."
          className="h-7 bg-muted/50 border-border pl-7 text-[10px] font-bold tracking-widest uppercase focus-visible:ring-primary/50 transition-all"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export type { StatusFilter };
