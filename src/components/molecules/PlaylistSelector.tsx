import { useState, useEffect } from 'react';
import { PlayCircle, Check, ListChecks, Hash, ArrowRight } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import type { PlaylistEntry } from '../../types/downloader';

interface PlaylistSelectorProps {
  entries: PlaylistEntry[];
  onSelectionChange: (value: string) => void;
  initialSelection?: Set<number>;
  onPreview?: (id: string, title: string) => void;
}

type SelectionMode = 'checkbox' | 'range';

export function PlaylistSelector({ entries, onSelectionChange, initialSelection, onPreview }: PlaylistSelectorProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(initialSelection || new Set());
  const [rangeFrom, setRangeFrom]             = useState('');
  const [rangeTo, setRangeTo]                 = useState('');
  const [mode, setMode]                       = useState<SelectionMode>('checkbox');
  const total                                 = entries.length;

  useEffect(() => {
    if (initialSelection) setSelectedIndices(initialSelection);
  }, [initialSelection]);

  // Sync selection → parent string
  useEffect(() => {
    if (mode === 'range') {
      onSelectionChange(rangeFrom || rangeTo ? `${rangeFrom || 1}-${rangeTo || ''}` : '');
    } else {
      onSelectionChange(
        selectedIndices.size > 0
          ? Array.from(selectedIndices).sort((a: number, b: number) => a - b).join(',')
          : ''
      );
    }
  }, [selectedIndices, rangeFrom, rangeTo, mode, onSelectionChange]);

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
      <div className="flex-1 overflow-hidden" style={{ height: 320 }}>
        {mode === 'checkbox' ? (
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {entries.map(entry => {
                const selected = selectedIndices.has(entry.index);
                return (
                  <div
                    key={entry.id}
                    onClick={() => toggle(entry.index)}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border ${
                      selected
                        ? 'bg-primary/10 border-primary/20 shadow-[0_0_12px_rgba(var(--primary-rgb),0.1)]'
                        : 'hover:bg-white/5 border-transparent hover:border-white/5'
                    }`}
                  >
                    {/* Glowing Checkbox */}
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all shadow-sm ${
                      selected
                        ? 'bg-primary border-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]'
                        : 'border-white/10 group-hover:border-white/30'
                    }`}>
                      {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>

                    {/* Thumbnail */}
                    <div className="relative w-16 h-9 rounded-lg border border-white/5 overflow-hidden shrink-0 group-hover:border-primary/30 transition-colors shadow-md">
                      <img
                        src={entry.thumbnail}
                        className={`object-cover w-full h-full transition-all duration-300 ${selected ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'}`}
                        alt=""
                      />
                      {onPreview && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onPreview(entry.id, entry.title); }}
                          className="absolute inset-0 bg-primary/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <PlayCircle className="w-4 h-4 text-white drop-shadow-lg" />
                        </button>
                      )}
                    </div>

                    {/* Index */}
                    <span className={`text-[10px] font-black w-5 shrink-0 transition-colors ${selected ? 'text-primary' : 'text-white/15'}`}>
                      {entry.index}
                    </span>

                    {/* Title */}
                    <span className={`text-[11px] truncate flex-1 font-semibold transition-colors ${
                      selected ? 'text-white font-black' : 'text-white/40 group-hover:text-white/70'
                    }`}>
                      {entry.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 space-y-6">
            <div className="flex flex-col items-center gap-2 mb-2">
              <Hash className="w-10 h-10 text-primary/20" />
              <h3 className="text-[10px] font-black uppercase tracking-[3px] text-white/25">Range Selection</h3>
              <p className="text-[9px] text-white/15 text-center">Download a continuous range of videos</p>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-6 rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
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
