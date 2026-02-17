import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { VideoQuality, MediaMetadata, DownloadOptions } from "../../types/downloader";
import { Folder, Loader2, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import { analyzeLinkType } from "../../utils/linkAnalyzer";

interface SmartAddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (url: string) => Promise<any>; 
  onAdd: (url: string, service: any, options: DownloadOptions, title: string, thumbnail?: string) => void;
  defaultPath: string;
  onSelectPath: () => Promise<string | undefined>;
}

export function SmartAddDialog({ isOpen, onClose, onAnalyze, onAdd, defaultPath, onSelectPath }: SmartAddDialogProps) {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [quality, setQuality] = useState<VideoQuality>("best");
  const [customPath, setCustomPath] = useState<string>("");
  const [detectedType, setDetectedType] = useState<string>("");
  const [wgetReferer, setWgetReferer] = useState("");
  const [wgetFilename, setWgetFilename] = useState("");

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setMetadata(null);
  };

  const startAnalysis = async () => {
    if (!url) return;
    setIsAnalyzing(true);
    try {
      const typeInfo = analyzeLinkType(url);
      setDetectedType(typeInfo.type);
      
      const result = await onAnalyze(url);
      if (result) {
        if (result.metadata) {
          setMetadata(result.metadata);
        }
        if (result.embedUrl) {
          setWgetReferer(result.embedUrl);
          setWgetFilename("video.mp4");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAdd = () => {
    const typeInfo = analyzeLinkType(url);
    const options: DownloadOptions = {
        quality,
        downloadPath: customPath || defaultPath,
        wgetReferer: wgetReferer || undefined,
        wgetFilename: wgetFilename || undefined
    };

    const title = metadata?.title || wgetFilename || url.split('/').pop() || "Download Task";
    onAdd(url, typeInfo.service, options, title, metadata?.thumbnail);
    onClose();
    setUrl("");
    setMetadata(null);
  };

  const handlePickFolder = async () => {
    const picked = await onSelectPath();
    if (picked) setCustomPath(picked);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 border-white/10 text-white max-w-lg shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
            <LinkIcon className="text-blue-500 w-6 h-6" /> 
            Add New Download
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-white/30 tracking-widest">URL / Address</label>
            <div className="flex gap-2">
                <Input 
                    value={url}
                    onChange={handleUrlChange}
                    placeholder="Paste link here..."
                    className="bg-black/40 border-white/10 h-11"
                />
                <Button onClick={startAnalysis} disabled={!url || isAnalyzing} variant="secondary" className="h-11 px-6 font-bold uppercase text-xs">
                    {isAnalyzing ? <Loader2 className="animate-spin" /> : "Analyze"}
                </Button>
            </div>
          </div>

          {metadata && (
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-4 items-center">
                <div className="w-24 h-16 rounded overflow-hidden bg-black shrink-0 relative">
                    <img src={metadata.thumbnail} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-blue-600/20 mix-blend-overlay" />
                </div>
                <div className="flex-1 overflow-hidden">
                    <h4 className="text-sm font-bold truncate">{metadata.title}</h4>
                    <p className="text-[10px] uppercase font-black text-blue-400 tracking-wider">
                        {detectedType === 'playlist' ? `${metadata.entries?.length} Videos Found` : 'Ready to Download'}
                    </p>
                </div>
                <CheckCircle2 className="text-green-500 w-5 h-5 shrink-0" />
            </div>
          )}

          {metadata && !metadata.isPlaylist && (
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-white/30 tracking-widest">Select Quality</label>
                <Select value={quality} onValueChange={(v: any) => setQuality(v)}>
                    <SelectTrigger className="bg-black/40 border-white/10 h-10">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                        <SelectItem value="best">Best Available (Auto)</SelectItem>
                        <SelectItem value="1080p">High Definition (1080p)</SelectItem>
                        <SelectItem value="720p">Standard HD (720p)</SelectItem>
                        <SelectItem value="480p">Medium (480p)</SelectItem>
                        <SelectItem value="audio">Audio Only (MP3)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-white/30 tracking-widest">Save Location</label>
            <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-md text-[11px] font-medium text-white/60 truncate italic">
                    {customPath || defaultPath}
                </div>
                <Button onClick={handlePickFolder} variant="outline" size="icon" className="border-white/10 hover:text-blue-400">
                    <Folder className="w-4 h-4" />
                </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="uppercase font-bold text-xs">Cancel</Button>
          <Button onClick={handleAdd} disabled={!url || isAnalyzing} className="bg-blue-600 hover:bg-blue-500 font-bold uppercase text-xs px-8">
            Add to Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
