import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { VideoQuality, MediaMetadata, DownloadOptions } from "../../types/downloader";
import { Folder, Loader2, Link as LinkIcon, CheckCircle2, List, PlayCircle, Check, X } from "lucide-react";
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
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    setEmbedUrl(null);
    setPreviewUrl(null);
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
              const selection = new Set<number>();
              if (requestedIndex) {
                selection.add(requestedIndex);
              } else if (result.metadata.entries) {
                const found = result.metadata.entries.find((e: any) => e.id === requestedVideoId);
                if (found) selection.add(found.index);
              }
              
              setSelectedIndices(selection);
              setPlaylistItems(getRangeString(selection));
              setIsPlaylistView(false);
            } else {
              const all = new Set<number>();
              result.metadata.entries?.forEach((e: any) => all.add(e.index));
              setSelectedIndices(all);
              setPlaylistItems(getRangeString(all));
              setIsPlaylistView(true);
            }
          }
        }
        if (result.embedUrl) {
          setEmbedUrl(result.embedUrl);
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
    setEmbedUrl(null);
    setPreviewUrl(null);
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

  const handlePreview = (entryId: string) => {
    const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
    if (isYoutube) {
        setPreviewUrl(`https://www.youtube.com/embed/${entryId}?autoplay=1`);
    } else {
        // Fallback or handle other services if needed
        setPreviewUrl(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background border-border text-foreground max-w-2xl shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-500">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
                <LinkIcon className="text-primary w-5 h-5" /> 
            </div>
            Add New Download
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
            <div className="space-y-6 py-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">URL / Address</label>
                <div className="flex gap-2">
                    <Input 
                        value={url}
                        onChange={handleUrlChange}
                        placeholder="Paste link here..."
                        className="bg-muted/40 border-border h-11 focus-visible:ring-primary/50 transition-all"
                    />
                    <Button onClick={startAnalysis} disabled={!url || isAnalyzing} variant="secondary" className="h-11 px-6 font-bold uppercase text-xs transition-all">
                        {isAnalyzing ? <Loader2 className="animate-spin" /> : "Analyze"}
                    </Button>
                </div>
              </div>

              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Save Location</label>
                <div className="flex gap-1.5">
                    <div className="flex-1 px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-[10px] font-bold text-muted-foreground truncate flex items-center transition-all">
                        <Folder className="w-3.5 h-3.5 mr-2 text-primary/60" />
                        {customPath || defaultPath}
                    </div>
                    <Button onClick={handlePickFolder} variant="outline" size="icon" className="h-11 w-11 rounded-xl border-border hover:text-primary hover:bg-muted transition-all shrink-0">
                        <Folder className="w-4 h-4" />
                    </Button>
                </div>
              </div>

              {metadata && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    {/* Video Player Section */}
                    {(embedUrl || previewUrl) && (
                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-border shadow-2xl relative group">
                            <iframe 
                                src={previewUrl || embedUrl || ""}
                                className="w-full h-full"
                                allowFullScreen
                                allow="autoplay; encrypted-media"
                            />
                            {(previewUrl && isPlaylistView) && (
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => setPreviewUrl(null)}
                                    className="absolute top-2 right-2 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/10"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                        </div>
                    )}

                    <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/[0.1] to-secondary/[0.1] border border-primary/10 flex gap-4 items-center transition-all">
                        {!embedUrl && (
                            <div className="w-24 h-16 rounded-lg overflow-hidden bg-black shrink-0 relative border border-border">
                                <img src={metadata.thumbnail} className="w-full h-full object-cover" alt="" />
                                <div className="absolute inset-0 bg-primary/10 mix-blend-overlay" />
                            </div>
                        )}
                        <div className="flex-1 overflow-hidden">
                            <h4 className="text-sm font-black text-foreground/90 truncate leading-tight">{metadata.title}</h4>
                            <div className="flex flex-col gap-1 mt-1">
                                <p className="text-[9px] uppercase font-black text-primary/80 tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    {metadata.isPlaylist ? `${metadata.entries?.length} Videos Found` : 'Media Ready'}
                                </p>
                                {metadata.isPlaylist && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <Button 
                                            size="sm" 
                                            variant={isPlaylistView ? "default" : "ghost"}
                                            onClick={() => setIsPlaylistView(true)}
                                            className={cn("h-7 text-[9px] uppercase font-black tracking-widest px-3 transition-all", isPlaylistView ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                                        >
                                            <List className="w-3 h-3 mr-1.5" /> Playlist
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant={!isPlaylistView ? "default" : "ghost"}
                                            onClick={() => setIsPlaylistView(false)}
                                            className={cn("h-7 text-[9px] uppercase font-black tracking-widest px-3 transition-all", !isPlaylistView ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                                        >
                                            <PlayCircle className="w-3 h-3 mr-1.5" /> Single
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                        {!metadata.isPlaylist && <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'var(--acc-400)' }} />}
                    </div>

                    {metadata.isPlaylist && isPlaylistView && (
                        <div className="space-y-3 rounded-2xl bg-muted/40 border border-border overflow-hidden shadow-inner transition-colors">
                            <div className="flex justify-between items-center px-4 py-2.5 border-b border-border bg-background/50">
                                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-[2px]">Select Videos</label>
                                <div className="flex gap-3">
                                    <button onClick={selectAll} className="text-[9px] font-black uppercase text-primary hover:text-primary/80 transition-colors">All</button>
                                    <div className="w-px h-3 bg-border" />
                                    <button onClick={selectNone} className="text-[9px] font-black uppercase text-destructive hover:text-destructive/80 transition-colors">None</button>
                                </div>
                            </div>
                            <ScrollArea className="h-[220px] px-3 overflow-y-auto">
                                <div className="space-y-1 py-3">
                                    {metadata.entries?.map((entry) => {
                                        const isSelected = selectedIndices.has(entry.index);
                                        const isRequested = entry.id === metadata.requestedVideoId;
                                        return (
                                            <div 
                                                key={entry.id}
                                                onClick={() => toggleItem(entry.index)}
                                                className={cn(
                                                    "group flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border",
                                                    isSelected ? "bg-primary/10 border-primary/20" : "hover:bg-muted border-transparent",
                                                    isRequested && "ring-1 ring-primary/50"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                                                    isSelected ? "bg-primary border-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]" : "border-border group-hover:border-primary/30"
                                                )}>
                                                    {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                                                </div>
                                                <div className="w-14 h-8 rounded-md overflow-hidden bg-black shrink-0 border border-border">
                                                    <img src={entry.thumbnail} className="w-full h-full object-cover" alt="" />
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <p className={cn(
                                                        "text-[10px] font-bold truncate",
                                                        isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                                                    )}>
                                                    {entry.index}. {entry.title}
                                                    </p>
                                                    {isRequested && <span className="text-[8px] font-black uppercase text-primary tracking-widest mt-0.5 block transition-colors">Original Link Task</span>}
                                                </div>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handlePreview(entry.id);
                                                    }}
                                                    className="w-8 h-8 rounded-full bg-muted/50 hover:bg-primary hover:text-primary-foreground transition-all border border-border shrink-0"
                                                >
                                                    <PlayCircle className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                            <div className="px-4 py-3 border-t border-border bg-background/50 flex justify-between items-center">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[2px]">{selectedIndices.size} Selected</span>
                                <div className="max-w-[150px] overflow-hidden">
                                    <span className="text-[9px] font-mono text-primary truncate block">{playlistItems || 'No items'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {!metadata.isPlaylist || !isPlaylistView ? (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Quality</label>
                                <Select value={quality} onValueChange={(v: any) => setQuality(v)}>
                                    <SelectTrigger className="bg-muted/40 border-border h-11 rounded-xl focus:ring-primary/50 transition-all">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground rounded-xl">
                                        <SelectItem value="best">Best Available</SelectItem>
                                        <SelectItem value="1080p">1080p Full HD</SelectItem>
                                        <SelectItem value="720p">720p HD</SelectItem>
                                        <SelectItem value="480p">480p Medium</SelectItem>
                                        <SelectItem value="audio">Audio (MP3)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Playlist Range</label>
                                <Input 
                                    value={playlistItems}
                                    onChange={(e) => setPlaylistItems(e.target.value)}
                                    placeholder="e.g. 1,2,5-10"
                                    className="bg-muted/40 border-border h-11 rounded-xl text-[11px] font-mono focus-visible:ring-primary/50 transition-all"
                                />
                            </div>
                        )}
                    </div>
                </div>
              )}
            </div>
        </ScrollArea>

        <DialogFooter className="p-6 pt-2 gap-2 border-t border-border bg-muted/20 transition-colors duration-500">
          <Button variant="ghost" onClick={onClose} className="uppercase font-black text-[10px] tracking-widest hover:bg-muted px-6 transition-all">Cancel</Button>
          <Button onClick={handleAdd} disabled={!url || isAnalyzing} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-10 rounded-xl h-11 shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all">
            Add to Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
