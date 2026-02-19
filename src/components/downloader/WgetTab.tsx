import { FileDown, AlertCircle, Folder } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface WgetTabProps {
  url: string;
  setUrl: (url: string) => void;
  filename: string;
  setFilename: (name: string) => void;
  referer: string;
  setReferer: (ref: string) => void;
  onDownload: (url: string, options: { wgetFilename: string; wgetReferer: string; downloadPath?: string }) => void;
  onStop: () => void;
  isStopDisabled: boolean;
  isLoading: boolean;
  customPath: string;
  onSelectPath: () => void;
}

export function WgetTab({ 
  url, setUrl, 
  filename, setFilename, 
  referer, setReferer, 
  onDownload, onStop, 
  isStopDisabled, isLoading,
  customPath, onSelectPath
}: WgetTabProps) {
  return (
    <div className="flex flex-col h-full p-6 m-0 space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[2px]">Direct Download Link</label>
        <Input 
          placeholder="https://..." 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="bg-card/50 border-border/40 text-base py-6"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[2px]">Output Filename</label>
          <Input 
            placeholder="video.mp4" 
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="bg-card/50 border-border/40"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[2px]">Referer URL</label>
          <Input 
            placeholder="https://source-site.com/..." 
            value={referer}
            onChange={(e) => setReferer(e.target.value)}
            className="bg-card/50 border-border/40"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button 
          onClick={onSelectPath}
          variant="outline"
          title={customPath || "Use default path"}
          className={`h-12 px-4 ${customPath ? 'text-primary bg-primary/5 border-primary/30' : 'text-muted-foreground border-border/40'}`}
        >
          <Folder className="w-5 h-5" />
        </Button>
        <Button
          onClick={() => onDownload(url, { wgetFilename: filename, wgetReferer: referer, downloadPath: customPath || undefined })}
          disabled={isLoading || !url}
          className="h-12 flex-1 gap-2 font-bold"
          style={{ background: 'var(--grad-hero)' }}
        >
          <FileDown className="w-5 h-5" /> START WGET
        </Button>
        {!isStopDisabled && (
          <Button onClick={onStop} variant="destructive" className="h-12 px-6 font-bold uppercase tracking-tight">
            STOP
          </Button>
        )}
      </div>
      <div className="p-3 rounded-lg border flex items-start gap-3" style={{ background: 'rgba(123,104,160,0.05)', borderColor: 'rgba(123,104,160,0.15)' }}>
         <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
         <p className="text-[10px] text-muted-foreground/60 leading-normal">Wget is ideal for direct file links that require specific headers or referer URLs.</p>
      </div>
    </div>
  );
}
