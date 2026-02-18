import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { VideoQuality, MediaMetadata, DownloadOptions } from "../../types/downloader";
import { Folder, Loader2, Link as LinkIcon, CheckCircle2, List, PlayCircle, Check } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { analyzeLinkType } from "../../utils/linkAnalyzer";

interface SmartAddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (url: string) => Promise<any>; 
  onAdd: (url: string, service: any, options: DownloadOptions, title: string, thumbnail?: string) => void;
  onAddBulk: (items: { url: string, service: any, options: DownloadOptions, title: string, thumbnail?: string }[]) => void;
  defaultPath: string;
  onSelectPath: () => Promise<string | undefined>;
}

export function SmartAddDialog({ isOpen, onClose, onAnalyze, onAdd, onAddBulk, defaultPath, onSelectPath }: SmartAddDialogProps) {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [quality, setQuality] = useState<VideoQuality>("best");
  const [customPath, setCustomPath] = useState<string>("");
  const [wgetReferer, setWgetReferer] = useState("");
  const [wgetFilename, setWgetFilename] = useState("");
  const [playlistItems, setPlaylistItems] = useState("");
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isPlaylistView, setIsPlaylistView] = useState(false);

  // Helper to convert selection Set to yt-dlp string (e.g. 1,2,5-10)
  const getRangeString = (indices: Set<number>) => {
    if (indices.size === 0) return "";
    const sorted = Array.from(indices).sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i <= sorted.length; i++) {
        if (i < sorted.length && sorted[i] === end + 1) {
            end = sorted[i];
        } else {
            if (start === end) ranges.push(`${start}`);
            else ranges.push(`${start}-${end}`);
            if (i < sorted.length) {
                start = sorted[i];
                end = sorted[i];
            }
        }
    }
    return ranges.join(",");
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setMetadata(null);
  };

  const startAnalysis = async () => {
    if (!url) return;
    setIsAnalyzing(true);
    try {
      const result = await onAnalyze(url);
      if (result) {
        if (result.metadata) {
          setMetadata(result.metadata);
          if (result.metadata.isPlaylist) {
            const requestedIndex = result.metadata.requestedIndex;
            const requestedVideoId = result.metadata.requestedVideoId;
            
            if (requestedVideoId || requestedIndex) {
              // Only select the targeted video
              const selection = new Set<number>();
              if (requestedIndex) {
                selection.add(requestedIndex);
              } else if (result.metadata.entries) {
                const found = result.metadata.entries.find((e: any) => e.id === requestedVideoId);
                if (found) selection.add(found.index);
              }
              
              setSelectedIndices(selection);
              setPlaylistItems(getRangeString(selection));
              setIsPlaylistView(false); // Focus on single video quality
            } else {
              // Pure playlist link - select all
              const all = new Set<number>();
              result.metadata.entries?.forEach((e: any) => all.add(e.index));
              setSelectedIndices(all);
              setPlaylistItems(getRangeString(all));
              setIsPlaylistView(true);
            }
          }
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
    
    if (metadata?.isPlaylist && isPlaylistView && selectedIndices.size > 0) {
        // Multi-select Individual mode
        const items = metadata.entries
            ?.filter(e => selectedIndices.has(e.index))
            .map(entry => ({
                url,
                service: typeInfo.service,
                options: {
                    quality,
                    downloadPath: customPath || defaultPath,
                    playlistItems: `${entry.index}`
                },
                title: entry.title,
                thumbnail: entry.thumbnail
            })) || [];
        
        if (items.length > 0) {
            onAddBulk(items);
        }
    } else {
        // Single Task mode (could be one video OR a whole playlist as one task)
        const options: DownloadOptions = {
            quality,
            downloadPath: customPath || defaultPath,
            wgetReferer: wgetReferer || undefined,
            wgetFilename: wgetFilename || undefined,
            playlistItems: isPlaylistView ? (playlistItems || undefined) : undefined
        };
        const title = metadata?.title || wgetFilename || url.split('/').pop() || "Download Task";
        onAdd(url, typeInfo.service, options, title, metadata?.thumbnail);
    }

    onClose();
    setUrl("");
    setMetadata(null);
    setSelectedIndices(new Set());
    setPlaylistItems("");
    setIsPlaylistView(false);
  };

  const handlePickFolder = async () => {
    const picked = await onSelectPath();
    if (picked) setCustomPath(picked);
  };

  const toggleItem = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedIndices(next);
    setPlaylistItems(getRangeString(next));
  };

  const selectAll = () => {
    if (!metadata?.entries) return;
    const all = new Set<number>();
    metadata.entries.forEach(e => all.add(e.index));
    setSelectedIndices(all);
    setPlaylistItems(getRangeString(all));
  };

  const selectNone = () => {
    setSelectedIndices(new Set());
    setPlaylistItems("");
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
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-4 items-center">
                    <div className="w-24 h-16 rounded overflow-hidden bg-black shrink-0 relative">
                        <img src={metadata.thumbnail} className="w-full h-full object-cover" alt="" />
                        <div className="absolute inset-0 bg-blue-600/20 mix-blend-overlay" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <h4 className="text-sm font-bold truncate">{metadata.title}</h4>
                        <div className="flex flex-col">
                            <p className="text-[10px] uppercase font-black text-blue-400 tracking-wider">
                                {metadata.isPlaylist ? `${metadata.entries?.length} Videos Found` : 'Ready to Download'}
                            </p>
                            {metadata.isPlaylist && (
                                <div className="flex items-center gap-2 mt-1">
                                    <Button 
                                        size="sm" 
                                        variant={isPlaylistView ? "default" : "ghost"}
                                        onClick={() => setIsPlaylistView(true)}
                                        className={cn("h-6 text-[8px] uppercase font-bold", isPlaylistView && "bg-blue-600")}
                                    >
                                        <List className="w-3 h-3 mr-1" /> Playlist View
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant={!isPlaylistView ? "default" : "ghost"}
                                        onClick={() => setIsPlaylistView(false)}
                                        className={cn("h-6 text-[8px] uppercase font-bold", !isPlaylistView && "bg-blue-600")}
                                    >
                                        <PlayCircle className="w-3 h-3 mr-1" /> Single Video
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                    {!metadata.isPlaylist && <CheckCircle2 className="text-green-500 w-5 h-5 shrink-0" />}
                </div>

                {metadata.isPlaylist && isPlaylistView && (
                    <div className="space-y-3 p-1 rounded-xl bg-black/20 border border-white/5 overflow-hidden">
                        <div className="flex justify-between items-center px-3 py-2 border-b border-white/5">
                            <label className="text-[10px] font-black uppercase text-white/40 tracking-widest">Select Videos</label>
                            <div className="flex gap-2">
                                <Button onClick={selectAll} variant="ghost" className="h-6 text-[8px] font-black uppercase text-blue-400 hover:text-blue-300 p-0">All</Button>
                                <Button onClick={selectNone} variant="ghost" className="h-6 text-[8px] font-black uppercase text-red-400 hover:text-red-300 p-0">None</Button>
                            </div>
                        </div>
                        <ScrollArea className="h-[200px] px-2 overflow-y-auto">
                            <div className="space-y-1 py-2">
                                {metadata.entries?.map((entry) => {
                                    const isSelected = selectedIndices.has(entry.index);
                                    const isRequested = entry.id === metadata.requestedVideoId;
                                    return (
                                        <div 
                                            key={entry.id}
                                            onClick={() => toggleItem(entry.index)}
                                            className={cn(
                                                "group flex items-center gap-3 p-1.5 rounded-lg cursor-pointer transition-all",
                                                isSelected ? "bg-white/5 border border-white/5" : "hover:bg-white/[0.02] border border-transparent",
                                                isRequested && "ring-1 ring-blue-500/50"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                                isSelected ? "bg-blue-600 border-blue-500" : "border-white/20 group-hover:border-white/40"
                                            )}>
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <div className="w-12 h-7 rounded overflow-hidden bg-black shrink-0">
                                                <img src={entry.thumbnail} className="w-full h-full object-cover" alt="" />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className={cn(
                                                    "text-[10px] font-bold truncate",
                                                    isSelected ? "text-white" : "text-white/60"
                                                )}>
                                                    {entry.index}. {entry.title}
                                                </p>
                                                {isRequested && <span className="text-[8px] font-black uppercase text-blue-400 tracking-tighter">Current Link Video</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                        <div className="px-3 py-2 border-t border-white/5 bg-white/[0.02] flex justify-between items-center">
                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Selection: {selectedIndices.size} items</span>
                            <span className="text-[9px] font-mono text-blue-500/70">{playlistItems}</span>
                        </div>
                    </div>
                )}
            </div>
          )}

          {metadata && (!metadata.isPlaylist || !isPlaylistView) && (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest">Select Quality</label>
                    {metadata.isPlaylist && <span className="text-[8px] font-bold text-blue-400/50 uppercase">For This Video</span>}
                </div>
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
