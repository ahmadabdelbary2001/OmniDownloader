import { useState, useEffect } from 'react';
import { Check, ListChecks, Hash, ArrowRight } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import type { PlaylistEntry } from '../../types/downloader';

interface PlaylistSelectorProps {
  entries: PlaylistEntry[];
  onSelectionChange: (value: string) => void;
}

type SelectionMode = 'checkbox' | 'range';

export function PlaylistSelector({ entries, onSelectionChange }: PlaylistSelectorProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [rangeFrom, setRangeFrom]             = useState('');
  const [rangeTo, setRangeTo]                 = useState('');
  const [mode, setMode]                       = useState<SelectionMode>('checkbox');
  const total                                 = entries.length;

  // Sync selection → parent string
  useEffect(() => {
    if (mode === 'range') {
      onSelectionChange(rangeFrom || rangeTo ? `${rangeFrom || 1}-${rangeTo || ''}` : '');
    } else {
      onSelectionChange(
        selectedIndices.size > 0
          ? Array.from(selectedIndices).sort((a, b) => a - b).join(',')
          : ''
      );
    }
  }, [selectedIndices, rangeFrom, rangeTo, mode, onSelectionChange]);

  const toggle = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
    setMode('checkbox');
  };

  const selectAll   = () => { setSelectedIndices(new Set(entries.map(e => e.index))); setMode('checkbox'); };
  const clearAll    = () => { setSelectedIndices(new Set()); setRangeFrom(''); setRangeTo(''); };
  const clamp = (v: number) => Math.max(1, Math.min(v, total));

  return (
    <div className="flex-1 flex flex-col min-h-0 border border-white/5 rounded-xl bg-black/20 overflow-hidden animate-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="p-3 border-b border-white/5 bg-white/5 flex items-center justify-between shrink-0">
        <div className="flex gap-4">
          {(['checkbox', 'range'] as SelectionMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${mode === m ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
            >
              <ListChecks className="w-3 h-3" />
              {m === 'checkbox' ? 'Select Videos' : 'Range (From-To)'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={selectAll} className="text-[9px] font-bold text-white/30 hover:text-white uppercase transition-colors">Select All</button>
          <button onClick={clearAll}  className="text-[9px] font-bold text-white/30 hover:text-white uppercase transition-colors">Clear</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden relative">
        {mode === 'checkbox' ? (
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {entries.map(entry => (
                <div
                  key={entry.id}
                  onClick={() => toggle(entry.index)}
                  className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200 border ${selectedIndices.has(entry.index) ? 'bg-primary/10 border-primary/20' : 'hover:bg-muted/30 border-transparent'}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedIndices.has(entry.index) ? 'bg-primary border-primary' : 'border-border/30 group-hover:border-border/60'}`}>
                    {selectedIndices.has(entry.index) && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                  </div>
                  <span className="text-[10px] font-bold text-white/30 w-4 shrink-0">{entry.index}</span>
                  <span className={`text-xs truncate flex-1 ${selectedIndices.has(entry.index) ? 'text-primary font-bold' : 'text-muted-foreground group-hover:text-foreground'}`}>
                    {entry.title}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 space-y-6">
            <div className="flex flex-col items-center gap-2 mb-2">
              <Hash className="w-8 h-8 text-primary/40" />
              <h3 className="text-[10px] font-black uppercase tracking-[3px] text-white/40">Range Selection</h3>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-6 rounded-2xl border border-white/10 shadow-2xl">
              {[
                { label: 'From Index', value: rangeFrom, placeholder: '1',            set: (v: string) => setRangeFrom(v) },
                { label: 'To Index',   value: rangeTo,   placeholder: total.toString(), set: (v: string) => setRangeTo(v)   },
              ].map((field, i, arr) => (
                <>
                  <div key={field.label} className="space-y-2">
                    <label className="text-[9px] font-bold text-white/20 uppercase block ml-1">{field.label}</label>
                    <Input
                      type="number" min={1} max={total}
                      placeholder={field.placeholder}
                      value={field.value}
                      onChange={e => { field.set(clamp(Number(e.target.value) || 1).toString()); setMode('range'); }}
                      className="bg-card/50 border-border/40 w-24 text-center h-12 text-lg font-black"
                    />
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-white/20 mt-6" />}
                </>
              ))}
            </div>
            <p className="text-[10px] text-white/20 italic max-w-[200px] text-center">
              Enter the start and end positions. Leave "To" empty to download until the end.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
