import { FileDown, AlertCircle } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface WgetTabProps {
  url: string;
  setUrl: (url: string) => void;
  filename: string;
  setFilename: (name: string) => void;
  referer: string;
  setReferer: (ref: string) => void;
  onDownload: (url: string, options: { wgetFilename: string; wgetReferer: string }) => void;
  isLoading: boolean;
}

export function WgetTab({ url, setUrl, filename, setFilename, referer, setReferer, onDownload, isLoading }: WgetTabProps) {
  return (
    <div className="flex flex-col h-full p-6 m-0 space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-black text-white/40 uppercase tracking-[2px]">Direct Download Link</label>
        <Input 
          placeholder="https://..." 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="bg-slate-900/50 border-white/10 text-base py-6"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-white/40 uppercase tracking-[2px]">Output Filename</label>
          <Input 
            placeholder="video.mp4" 
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="bg-slate-900/50 border-white/10"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-white/40 uppercase tracking-[2px]">Referer URL</label>
          <Input 
            placeholder="https://source-site.com/..." 
            value={referer}
            onChange={(e) => setReferer(e.target.value)}
            className="bg-slate-900/50 border-white/10"
          />
        </div>
      </div>
      <Button onClick={() => onDownload(url, { wgetFilename: filename, wgetReferer: referer })} disabled={isLoading || !url} className="h-12 w-full gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-bold shadow-lg shadow-indigo-600/20">
        <FileDown className="w-5 h-5" /> START WGET
      </Button>
      <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
         <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
         <p className="text-[10px] text-indigo-300/60 leading-normal">Wget is ideal for direct file links that require specific headers or referer URLs.</p>
      </div>
    </div>
  );
}
