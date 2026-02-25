import { useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Loader2, Folder, X, Download } from "lucide-react";
import { cn } from "../../lib/utils";
import { analyzeLinkType } from "../../lib/linkAnalyzer";

// Molecules
import { MediaPreview } from "../molecules/MediaPreview";
import { PlaylistSelector } from "../molecules/PlaylistSelector";
import { SubtitleSelector } from "../molecules/SubtitleSelector";
import { QualitySelector } from "../molecules/QualitySelector";
import { WgetTab } from "../molecules/WgetTab";

// Types
import type { VideoQuality, MediaMetadata, DownloadOptions } from "../../types/downloader";

interface SmartAddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (url: string) => Promise<any>;
  onAdd: (url: string, service: any, options: DownloadOptions, title: string, thumbnail?: string) => void;
  onAddBulk: (items: { url: string, service: any, options: DownloadOptions, title: string, thumbnail?: string }[]) => void;
  defaultPath: string;
  onSelectPath: () => Promise<string | undefined>;
}

export function SmartAddDialog({
  isOpen, onClose, onAnalyze, onAdd, onAddBulk, defaultPath, onSelectPath
}: SmartAddDialogProps) {
  const [url, setUrl]                         = useState("");
  const [isAnalyzing, setIsAnalyzing]         = useState(false);
  const [metadata, setMetadata]               = useState<MediaMetadata | null>(null);
  const [quality, setQuality]                 = useState<VideoQuality>("best");
  const [customPath, setCustomPath]           = useState<string>("");
  const [wgetReferer, setWgetReferer]         = useState("");
  const [wgetFilename, setWgetFilename]       = useState("");
  const [playlistItems, setPlaylistItems]     = useState("");
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isPlaylistView, setIsPlaylistView]   = useState(false);
  const [embedUrl, setEmbedUrl]               = useState<string | null>(null);
  const [previewUrl, setPreviewUrl]           = useState<string | null>(null);
  const [subtitleLang, setSubtitleLang]       = useState<string>("none");
  const [embedSubtitles, setEmbedSubtitles]   = useState(true);
  const [showAllTranslations, setShowAllTranslations] = useState(false);

  // Helper to convert selection Set to yt-dlp string (e.g. 1,2,5-10)
  const getRangeString = (indices: Set<number>) => {
    if (indices.size === 0) return "";
    const sorted = Array.from(indices).sort((a: number, b: number) => a - b);
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

  const isYouTubeUrl = (u: string) => u.includes("youtube.com") || u.includes("youtu.be");

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setMetadata(null);
    setEmbedUrl(null);
    setPreviewUrl(null);
    setQuality("best");
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
            const { requestedIndex, requestedVideoId, entries } = result.metadata;
            if (requestedVideoId || requestedIndex) {
              const selection = new Set<number>();
              if (requestedIndex) {
                selection.add(requestedIndex);
              } else if (entries) {
                const found = entries.find((e: any) => e.id === requestedVideoId);
                if (found) selection.add(found.index);
              }
              setSelectedIndices(selection);
              setPlaylistItems(getRangeString(selection));
              setIsPlaylistView(false);
            } else {
              const all = new Set<number>();
              entries?.forEach((e: any) => all.add(e.index));
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
    const selectedQ    = metadata?.availableQualities?.find(q => q.value === quality);
    const audioOnlySize = metadata?.availableQualities?.find(q => q.value === 'audio')?.size || 0;

    if (metadata?.isPlaylist && isPlaylistView && selectedIndices.size > 0) {
      const items = metadata.entries
        ?.filter(e => selectedIndices.has(e.index))
        .map(entry => ({
          url: entry.url, service: typeInfo.service,
          options: {
            quality, downloadPath: customPath || defaultPath,
            subtitleLang: subtitleLang !== 'none' ? subtitleLang : undefined,
            embedSubtitles: subtitleLang !== 'none' ? embedSubtitles : undefined,
            estimatedVideoSize: selectedQ ? (selectedQ.size || 0) - (quality === 'audio' ? 0 : audioOnlySize) : undefined,
            estimatedAudioSize: audioOnlySize || undefined
          },
          title: entry.title, thumbnail: entry.thumbnail
        })) || [];
      if (items.length > 0) onAddBulk(items);
    } else {
      const options: DownloadOptions = {
        quality, downloadPath: customPath || defaultPath,
        wgetReferer: wgetReferer || undefined,
        wgetFilename: wgetFilename || undefined,
        playlistItems: isPlaylistView ? (playlistItems || undefined) : undefined,
        subtitleLang: subtitleLang !== 'none' ? subtitleLang : undefined,
        embedSubtitles: subtitleLang !== 'none' ? embedSubtitles : undefined,
        estimatedVideoSize: selectedQ ? (selectedQ.size || 0) - (quality === 'audio' ? 0 : audioOnlySize) : undefined,
        estimatedAudioSize: audioOnlySize || undefined
      };
      const title = metadata?.title || wgetFilename || url.split('/').pop() || "Download Task";
      onAdd(url, typeInfo.service, options, title, metadata?.thumbnail);
    }
    reset();
    onClose();
  };

  const reset = () => {
    setUrl(""); setMetadata(null); setEmbedUrl(null); setPreviewUrl(null);
    setSelectedIndices(new Set()); setPlaylistItems("");
    setIsPlaylistView(false); setSubtitleLang("none"); setShowAllTranslations(false);
  };

  const handlePickFolder = async () => {
    const picked = await onSelectPath();
    if (picked) setCustomPath(picked);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0b0b12]/95 backdrop-blur-3xl border border-white/10 text-foreground max-w-2xl shadow-[0_0_80px_rgba(0,0,0,0.9)] p-0 overflow-hidden flex flex-col max-h-[95vh] rounded-[2rem] transition-all duration-700">
        
        {/* ── Aurora Glows ────────────────────────────────────────── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2rem]">
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-[0.15] blur-[80px]" style={{ background: 'var(--lav-400)' }} />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full opacity-[0.1] blur-[80px]" style={{ background: 'var(--acc-300)' }} />
        </div>


        {/* ── Inline Video Preview (top, conditionally shown) ───────── */}
        {previewUrl && (
          <div className="relative w-full aspect-video bg-black shrink-0 animate-in fade-in slide-in-from-top-4 duration-500">
            <iframe
              src={previewUrl}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; encrypted-media"
            />
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all z-10"
            >
              <X className="w-4 h-4" />
            </button>
            {metadata && (
              <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50 truncate">{metadata.title}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-0 shrink-0">
          <h2 className="text-[11px] font-black uppercase tracking-[3px] text-white/30 mb-4">Add New Download</h2>

          {/* URL bar */}
          <div className="flex gap-2 mb-4">
            <Input
              value={url}
              onChange={handleUrlChange}
              onKeyDown={e => e.key === 'Enter' && startAnalysis()}
              placeholder="Paste any link — YouTube, Twitter, direct file..."
              className="bg-white/5 border-white/10 h-12 text-sm placeholder:text-white/20 focus-visible:ring-primary/50 transition-all rounded-xl"
            />
            <Button
              onClick={startAnalysis}
              disabled={!url || isAnalyzing}
              className="h-12 px-6 font-black uppercase text-[10px] tracking-widest rounded-xl shrink-0 transition-all"
              style={{ background: isAnalyzing ? 'rgba(255,255,255,0.05)' : 'var(--grad-hero)' }}
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
            </Button>
          </div>
        </div>

        {/* ── Scrollable Body ─────────────────────────────────────── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 pb-6 space-y-4">

            {/* Save path */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-white/5 border border-white/5 rounded-xl text-[10px] text-white/30 font-mono truncate">
                <Folder className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                {customPath || defaultPath}
              </div>
              <Button onClick={handlePickFolder} variant="outline" size="icon"
                className="h-10 w-10 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:text-primary shrink-0">
                <Folder className="w-4 h-4" />
              </Button>
            </div>

            {/* ── Metadata ──────────────────────────────────────────── */}
            {metadata && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <MediaPreview
                  metadata={metadata}
                  url={url}
                  isPlaylist={metadata.isPlaylist}
                  onWatch={(watchUrl, _title) => setPreviewUrl(isYouTubeUrl(url) ? `https://www.youtube.com/embed/${watchUrl}?autoplay=1` : watchUrl)
                  }
                />

                {/* Playlist toggle */}
                {metadata.isPlaylist && (
                  <div className="flex bg-white/5 rounded-full p-1 border border-white/10 w-fit animate-in fade-in zoom-in-95 duration-500">
                    {(['Single Task', 'Playlist View'] as const).map((label) => {
                      const active = label === 'Playlist View' ? isPlaylistView : !isPlaylistView;
                      return (
                        <button
                          key={label}
                          onClick={() => setIsPlaylistView(label === 'Playlist View')}
                          className={cn(
                            "px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all duration-300",
                            active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "text-white/30 hover:text-white"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Playlist entries */}
                {metadata.isPlaylist && isPlaylistView && metadata.entries && (
                  <PlaylistSelector
                    entries={metadata.entries}
                    onSelectionChange={setPlaylistItems}
                    onIndicesChange={setSelectedIndices}
                    initialSelection={selectedIndices}
                    onPreview={(id, _title) => setPreviewUrl(isYouTubeUrl(url) ? `https://www.youtube.com/embed/${id}?autoplay=1` : id)}
                    requestedVideoId={metadata.requestedVideoId}
                    requestedIndex={metadata.requestedIndex}
                  />
                )}

                {/* Quality + Playlist range */}
                <div className="grid grid-cols-2 gap-4">
                  {isYouTubeUrl(url) && (!metadata.isPlaylist || !isPlaylistView) && (
                    <QualitySelector
                      qualities={metadata.availableQualities}
                      value={quality}
                      onValueChange={setQuality}
                    />
                  )}
                  {metadata.isPlaylist && isPlaylistView && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-white/30 tracking-widest px-1">Playlist Range</label>
                      <Input
                        value={playlistItems}
                        onChange={(e) => setPlaylistItems(e.target.value)}
                        placeholder="e.g. 1,2,5-10"
                        className="bg-white/5 border-white/10 h-11 rounded-xl text-[11px] font-mono focus-visible:ring-primary/50 transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Subtitles */}
                {metadata.availableSubtitles && metadata.availableSubtitles.length > 0 && quality !== 'audio' && (
                  <SubtitleSelector
                    subtitles={metadata.availableSubtitles}
                    value={subtitleLang}
                    onValueChange={setSubtitleLang}
                    showAllTranslations={showAllTranslations}
                    onToggleTranslations={setShowAllTranslations}
                    embedSubtitles={embedSubtitles}
                    onToggleEmbed={setEmbedSubtitles}
                  />
                )}
              </div>
            )}

            {/* Wget fallback tab */}
            {embedUrl && !metadata && (
              <WgetTab
                url={url} setUrl={setUrl}
                filename={wgetFilename} setFilename={setWgetFilename}
                referer={wgetReferer} setReferer={setWgetReferer}
                onDownload={(u, opts) => onAdd(u, 'wget', { wgetFilename: opts.wgetFilename, wgetReferer: opts.wgetReferer }, opts.wgetFilename || 'Wget Download')}
                onStop={() => {}}
                isStopDisabled={true}
                isLoading={isAnalyzing}
                customPath={customPath}
                onSelectPath={handlePickFolder}
              />
            )}
          </div>
        </ScrollArea>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="px-8 py-6 border-t border-white/5 bg-white/[0.02] flex gap-3 justify-end shrink-0 relative z-10">
          <Button
            variant="ghost"
            onClick={onClose}
            className="uppercase font-black text-[10px] tracking-[0.2em] text-white/30 hover:text-white hover:bg-white/5 px-8 transition-all h-12 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!url || isAnalyzing}
            className="font-black uppercase text-[10px] tracking-[0.2em] px-12 h-12 rounded-xl shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_40px_rgba(var(--primary-rgb),0.5)] transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'var(--grad-hero)' }}
          >
            <Download className="w-4 h-4 mr-2" />
            Add to Queue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
