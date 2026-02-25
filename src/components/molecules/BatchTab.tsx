import { Layers, Folder } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

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
  batchUrls, setBatchUrls,
  onDownload, onStop, isStopDisabled, isLoading,
  customPath, onSelectPath,
}: BatchTabProps) {
  return (
    <div className="flex flex-col h-full p-6 m-0 space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-black text-primary uppercase tracking-[2px]">Batch URL List (One per line)</label>
        <Textarea
          placeholder={"https://t.me/...\nhttps://youtube.com/..."}
          value={batchUrls}
          onChange={e => setBatchUrls(e.target.value)}
          className="bg-card/50 border-border/40 min-h-[200px] font-mono text-sm leading-relaxed"
        />
        <p className="text-[10px] text-muted-foreground/60 italic">Links will be downloaded sequentially. Empty and invalid lines are ignored.</p>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onSelectPath}
          variant="outline"
          title={customPath || 'Use default path'}
          className={cn("h-12 px-4 rounded-xl", customPath && "text-primary border-primary/30 bg-primary/5")}
        >
          <Folder className="w-5 h-5" />
        </Button>
        <Button
          onClick={() => onDownload(batchUrls)}
          disabled={isLoading || !batchUrls}
          variant="hero"
          size="xl"
          className="flex-1 gap-2"
        >
          <Layers className="w-5 h-5" /> Start Batch Processing
        </Button>
        {!isStopDisabled && (
          <Button onClick={onStop} variant="destructive" className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-[10px]">STOP</Button>
        )}
      </div>
    </div>
  );
}
