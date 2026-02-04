import { Layers } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';

interface BatchTabProps {
  batchUrls: string;
  setBatchUrls: (urls: string) => void;
  onDownload: (urls: string) => void;
  isLoading: boolean;
}

export function BatchTab({ batchUrls, setBatchUrls, onDownload, isLoading }: BatchTabProps) {
  return (
    <div className="flex flex-col h-full p-6 m-0 space-y-6">
       <div className="space-y-2">
          <label className="text-[10px] font-black text-blue-400 uppercase tracking-[2px]">Batch URL List (One per line)</label>
          <Textarea 
            placeholder="https://t.me/...&#10;https://youtube.com/..." 
            value={batchUrls}
            onChange={(e) => setBatchUrls(e.target.value)}
            className="bg-slate-900/50 border-white/10 min-h-[200px] font-mono text-sm leading-relaxed"
          />
          <p className="text-[10px] text-muted-foreground/60 italic">Links will be downloaded sequentially. Empty and invalid lines are ignored.</p>
       </div>
       <Button onClick={() => onDownload(batchUrls)} disabled={isLoading || !batchUrls} className="h-12 w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 font-bold shadow-lg shadow-blue-600/20 uppercase tracking-widest text-xs">
          <Layers className="w-5 h-5" /> Start Batch Processing
       </Button>
    </div>
  );
}
