import { useState, useMemo } from 'react';
import { SortIcon } from '../atoms/SortIcon';
import { EmptyDownloadState } from '../molecules/EmptyDownloadState';
import { TableToolbar } from '../molecules/TableToolbar';
import { DownloadRow } from '../molecules/DownloadRow';
import { parseSizeToBytes } from '../../lib/utils';
import type { DownloadTask } from '../../types/downloader';
import type { StatusFilter } from '../molecules/TableToolbar';

interface DownloadTableProps {
  tasks: DownloadTask[];
  onRemove: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onOpenFolder: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  isQueueActive: boolean;
}

type SortKey = 'title' | 'size' | 'status' | 'progress' | 'queueOrder' | 'createdAt';

const COLUMNS: { key: SortKey; label: string; span: string }[] = [
  { key: 'queueOrder', label: '#',         span: 'col-span-1' },
  { key: 'title',      label: 'File Name', span: 'col-span-4' },
  { key: 'size',       label: 'Size',      span: 'col-span-1' },
  { key: 'status',     label: 'Status',    span: 'col-span-2' },
  { key: 'progress',   label: 'Progress',  span: 'col-span-3' },
];

function getSortValue(task: DownloadTask, key: SortKey): any {
  switch (key) {
    case 'title':      return task.title.toLowerCase();
    case 'size':       return parseSizeToBytes(task.size || '0');
    case 'status':     return task.status;
    case 'progress':   return task.progress;
    case 'queueOrder': return task.queueOrder || 0;
    default:           return task.createdAt;
  }
}

function matchesStatus(task: DownloadTask, f: StatusFilter): boolean {
  if (f === 'all')      return true;
  if (f === 'ongoing')  return ['downloading', 'waiting', 'analyzing'].includes(task.status);
  if (f === 'finished') return task.status === 'completed';
  if (f === 'paused')   return task.status === 'paused' || task.status === 'failed';
  return true;
}

export function DownloadTable({ tasks, onRemove, onPause, onResume, onOpenFolder, onReorder, isQueueActive }: DownloadTableProps) {
  const [sortKey,      setSortKey]      = useState<SortKey>(() => (localStorage.getItem('omni_sort_key') as SortKey) || 'queueOrder');
  const [sortOrder,    setSortOrder]    = useState<'asc' | 'desc'>(() => (localStorage.getItem('omni_sort_order') as 'asc' | 'desc') || 'asc');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>(() => (localStorage.getItem('omni_filter_status') as StatusFilter) || 'all');
  const [searchQuery,  setSearchQuery]  = useState('');

  // Persist preferences
  useMemo(() => {
    localStorage.setItem('omni_sort_key',      sortKey);
    localStorage.setItem('omni_sort_order',    sortOrder);
    localStorage.setItem('omni_filter_status', filterStatus);
  }, [sortKey, sortOrder, filterStatus]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('asc'); }
  };

  const displayTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return [...tasks]
      .filter(t => matchesStatus(t, filterStatus))
      .filter(t => !q || t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))
      .sort((a, b) => {
        const va = getSortValue(a, sortKey);
        const vb = getSortValue(b, sortKey);
        if (va < vb) return sortOrder === 'asc' ? -1 : 1;
        if (va > vb) return sortOrder === 'asc' ?  1 : -1;
        return 0;
      });
  }, [tasks, sortKey, sortOrder, filterStatus, searchQuery]);

  if (tasks.length === 0) return <EmptyDownloadState />;

  return (
    <div className="flex flex-col h-full overflow-hidden border-t border-border">
      <TableToolbar
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Table header */}
      <div className="grid grid-cols-12 gap-1 p-3 bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border select-none">
        {COLUMNS.map(({ key, label, span }) => (
          <div key={key} className={`${span} flex items-center cursor-pointer hover:text-foreground transition-colors group/head`} onClick={() => toggleSort(key)}>
            {label} <SortIcon columnKey={key} activeKey={sortKey} order={sortOrder} />
          </div>
        ))}
        <div className="col-span-1 text-right flex items-center justify-end">Action</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {displayTasks.map(task => (
          <DownloadRow
            key={task.id}
            task={task}
            isQueueActive={isQueueActive}
            onPause={onPause}
            onResume={onResume}
            onOpenFolder={onOpenFolder}
            onRemove={onRemove}
            onReorder={onReorder}
          />
        ))}
      </div>
    </div>
  );
}
