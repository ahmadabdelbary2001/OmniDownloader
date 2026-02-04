import { Download } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface DirectTabProps {
  url: string;
  setUrl: (url: string) => void;
  playlistItems: string;
  setPlaylistItems: (items: string) => void;
  onAnalyze: (url: string) => void;
  onDownload: (url: string, playlistItems: string) => void;
  isLoading: boolean;
}

export function DirectTab({ url, setUrl, playlistItems, setPlaylistItems, onAnalyze, onDownload, isLoading }: DirectTabProps) {
  return (
    <div className="flex flex-col h-full p-6 m-0 space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-blue-400 uppercase tracking-[2px]">Direct Media/Site URL</label>
          <div className="flex gap-2">
            <Input 
              placeholder="Paste link here (YouTube, Twitter, BTB, etc.)" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-slate-900/50 border-white/10 text-base py-6 flex-1"
            />
            <Button variant="secondary" onClick={() => onAnalyze(url)} disabled={isLoading || !url} className="h-12 px-6 font-bold border border-white/10">
              ANALYZE
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/60 italic">Supports smart detection for Telegram and special sites.</p>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-white/40 uppercase tracking-[2px]">Playlist Items (Optional)</label>
          <Input 
            placeholder="e.g. 1,2,5-10" 
            value={playlistItems}
            onChange={(e) => setPlaylistItems(e.target.value)}
            className="bg-slate-900/50 border-white/10"
          />
        </div>
        <Button onClick={() => onDownload(url, playlistItems)} disabled={isLoading || !url} className="h-12 w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold shadow-lg shadow-blue-600/20">
          <Download className="w-5 h-5" /> START YTDLP
        </Button>
      </div>
    </div>
  );
}
