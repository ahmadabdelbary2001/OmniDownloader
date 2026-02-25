import { useState, useEffect } from 'react';
import { PlayCircle, Check, ListChecks, Hash, ArrowRight } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import type { PlaylistEntry } from '../../types/downloader';

interface PlaylistSelectorProps {
  entries: PlaylistEntry[];
  onSelectionChange: (value: string) => void;
  onIndicesChange?: (indices: Set<number>) => void;
  initialSelection?: Set<number>;
  onPreview?: (id: string, title: string) => void;
  requestedVideoId?: string;
  requestedIndex?: number;
}

type SelectionMode = 'checkbox' | 'range';

export function PlaylistSelector({ 
  entries, onSelectionChange, onIndicesChange, initialSelection, onPreview, requestedVideoId, requestedIndex 
}: PlaylistSelectorProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(initialSelection || new Set());
  const [rangeFrom, setRangeFrom]             = useState('');
  const [rangeTo, setRangeTo]                 = useState('');
  const [mode, setMode]                       = useState<SelectionMode>('checkbox');
  const total                                 = entries.length;

  useEffect(() => {
    if (initialSelection) setSelectedIndices(initialSelection);
  }, [initialSelection]);

  useEffect(() => {
    if (mode === 'range') {
      const start = Number(rangeFrom) || 1;
      const end = Number(rangeTo) || total;
      onSelectionChange(`${start}-${end}`);
      if (onIndicesChange) {
        const set = new Set<number>();
        for (let i = start; i <= end; i++) set.add(i);
        onIndicesChange(set);
      }
    } else {
      onSelectionChange(
        selectedIndices.size > 0
          ? Array.from(selectedIndices).sort((a: number, b: number) => a - b).join(',')
          : ''
      );
      if (onIndicesChange) onIndicesChange(selectedIndices);
    }
  }, [selectedIndices, rangeFrom, rangeTo, mode, onSelectionChange, onIndicesChange, total]);

  const toggle = (index: number) => {
    setSelectedIndices((prev: Set<number>) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
    setMode('checkbox');
  };

  const selectAll = () => { setSelectedIndices(new Set(entries.map(e => e.index))); setMode('checkbox'); };
  const clearAll  = () => { setSelectedIndices(new Set()); setRangeFrom(''); setRangeTo(''); };
  const clamp = (v: number) => Math.max(1, Math.min(v, total));

  return (
    <div className="flex-1 flex flex-col min-h-0 border border-white/5 rounded-2xl bg-black/30 overflow-hidden animate-in zoom-in-95 duration-300 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
      {/* Header */}
      <div className="p-3 border-b border-white/5 bg-white/[0.03] flex items-center justify-between shrink-0 backdrop-blur-sm">
        <div className="flex gap-4">
          {(['checkbox', 'range'] as SelectionMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${mode === m ? 'text-primary' : 'text-white/20 hover:text-white/50'}`}
            >
              {m === 'checkbox' ? <ListChecks className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
              {m === 'checkbox' ? 'Select Videos' : 'Range (From–To)'}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={selectAll} className="text-[9px] font-bold text-white/20 hover:text-primary uppercase tracking-widest transition-colors">All</button>
          <button onClick={clearAll}  className="text-[9px] font-bold text-white/20 hover:text-destructive uppercase tracking-widest transition-colors">Clear</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden transition-all duration-500" style={{ height: 350 }}>
        {mode === 'checkbox' ? (
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {entries.map(entry => {
                const selected = selectedIndices.has(entry.index);
                const isRequested = entry.id === requestedVideoId || entry.index === requestedIndex;
                return (
                  <div
                    key={entry.id}
                    onClick={() => toggle(entry.index)}
                    className={`group flex items-center gap-4 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-300 border backdrop-blur-md ${
                      selected
                        ? 'bg-primary/10 border-primary/30 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] scale-[1.01]'
                        : 'hover:bg-white/5 border-transparent hover:border-white/10'
                    } ${isRequested ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background' : ''}`}
                  >
                    {/* Glowing Checkbox */}
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
                      selected
                        ? 'bg-primary border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)]'
                        : 'border-white/10 group-hover:border-primary/50'
                    }`}>
                      {selected && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                    </div>

                    {/* Thumbnail */}
                    <div className="relative w-20 h-11 rounded-xl border border-white/5 overflow-hidden shrink-0 group-hover:border-primary/40 transition-all duration-500 shadow-xl">
                      <img
                        src={entry.thumbnail}
                        className={`object-cover w-full h-full transition-all duration-700 ${selected ? 'scale-110 opacity-100' : 'opacity-40 grayscale group-hover:opacity-90 group-hover:grayscale-0'}`}
                        alt=""
                      />
                      {onPreview && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onPreview(entry.id, entry.title); }}
                          className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300"
                        >
                          <PlayCircle className="w-5 h-5 text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                        </button>
                      )}
                    </div>

                    {/* Index & Title */}
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[10px] font-black tracking-widest transition-colors ${selected ? 'text-primary' : 'text-white/20'}`}>
                        VIDEO #{entry.index.toString().padStart(2, '0')}
                      </span>
                      <span className={`text-[12px] truncate leading-tight transition-colors ${
                        selected ? 'text-white font-bold' : 'text-white/40 group-hover:text-white/80'
                      }`}>
                        {entry.title}
                      </span>
                      {isRequested && <span className="text-[8px] font-black uppercase text-primary tracking-[0.2em] mt-0.5 animate-pulse">Original Link Task</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in zoom-in-95 duration-700">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-3xl bg-primary/5 border border-primary/10 flex items-center justify-center shadow-inner">
                 <Hash className="w-8 h-8 text-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]" />
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Range Selection</h3>
              <p className="text-[10px] text-white/20 text-center max-w-[200px] leading-relaxed">Download a custom range from the playlist</p>
            </div>
            <div className="flex items-center gap-6 bg-white/[0.02] p-8 rounded-[2rem] border border-white/5 shadow-2xl backdrop-blur-sm">
              {[
                { label: 'From', value: rangeFrom, placeholder: '1',            set: (v: string) => setRangeFrom(v) },
                { label: 'To',   value: rangeTo,   placeholder: total.toString(), set: (v: string) => setRangeTo(v)   },
              ].map((field, i, arr) => (
                <>
                  <div key={field.label} className="space-y-2">
                    <label className="text-[9px] font-bold text-white/20 uppercase block text-center">{field.label}</label>
                    <Input
                      type="number" min={1} max={total}
                      placeholder={field.placeholder}
                      value={field.value}
                      onChange={e => { field.set(clamp(Number(e.target.value) || 1).toString()); setMode('range'); }}
                      className="bg-white/5 border-white/10 w-28 text-center h-14 text-2xl font-black text-white focus-visible:ring-primary/50 rounded-xl"
                    />
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="w-5 h-5 text-white/10 mt-6" />}
                </>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: selection summary */}
      <div className="px-3 py-2 border-t border-white/5 bg-white/[0.02] flex items-center justify-between text-[9px] text-white/20 font-bold uppercase tracking-widest">
        <span>
          {mode === 'checkbox'
            ? selectedIndices.size > 0 ? `${selectedIndices.size} of ${total} selected` : 'None selected'
            : rangeFrom && rangeTo ? `Range ${rangeFrom}–${rangeTo}` : 'Set range above'
          }
        </span>
        <span>{total} videos total</span>
      </div>
    </div>
  );
}
