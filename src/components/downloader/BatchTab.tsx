import { Layers, Folder } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';

interface BatchTabProps {
  batchUrls: string;
  setBatchUrls: (urls: string) => void;
  onDownload: (urls: string) => void;
  onStop: () => void;
  isStopDisabled: boolean;
  isLoading: boolean;
  customPath: string;
  onSelectPath: () => void;
}

export function BatchTab({
  batchUrls, 
  setBatchUrls, 
  onDownload, 
  onStop, 
  isStopDisabled, 
  isLoading,
  customPath,
  onSelectPath
}: BatchTabProps) {
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
       <div className="flex gap-2">
         <Button 
            onClick={onSelectPath}
            variant="outline"
            title={customPath || "Use default path"}
            className={`h-12 px-4 border-white/10 ${customPath ? 'text-blue-400 bg-blue-400/5 border-blue-400/30' : 'text-white/40'}`}
         >
            <Folder className="w-5 h-5" />
         </Button>
         <Button onClick={() => onDownload(batchUrls)} disabled={isLoading || !batchUrls} className="h-12 flex-1 gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 font-bold shadow-lg shadow-blue-600/20 uppercase tracking-widest text-xs">
            <Layers className="w-5 h-5" /> Start Batch Processing
         </Button>
         {!isStopDisabled && (
           <Button onClick={onStop} variant="destructive" className="h-12 px-6 font-bold uppercase tracking-tight">
             STOP
           </Button>
         )}
       </div>
    </div>
  );
}
