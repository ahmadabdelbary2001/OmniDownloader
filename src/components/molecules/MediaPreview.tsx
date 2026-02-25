import { Play, Youtube } from 'lucide-react';
import { Button } from '../ui/button';
import type { MediaMetadata } from '../../types/downloader';

interface MediaPreviewProps {
  metadata: MediaMetadata;
  url: string;
  isPlaylist: boolean;
  onWatch: (url: string, title: string) => void;
}

export function MediaPreview({ metadata, url, isPlaylist, onWatch }: MediaPreviewProps) {
  const targetEntry = metadata.entries?.find(e =>
    (metadata.requestedVideoId && e.id === metadata.requestedVideoId) ||
    (!metadata.requestedVideoId && metadata.requestedIndex && e.index === metadata.requestedIndex)
  );

  const displayThumbnail = targetEntry?.thumbnail || metadata.thumbnail;
  const displayTitle     = targetEntry?.title     || metadata.title;
  const displayUrl       = targetEntry?.url       || url;
  const isTargeted       = !!targetEntry;

  return (
    <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-br from-primary/[0.1] to-secondary/[0.1] border border-primary/10 animate-in fade-in slide-in-from-top-4 duration-700 relative overflow-hidden group/meta">
      {/* Pulsing dot - Visual indicator of active metadata */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
        <span className="text-[8px] font-black text-primary uppercase tracking-widest">Metadata Active</span>
      </div>

      <div className="relative shrink-0 w-24 aspect-video rounded-xl overflow-hidden border border-white/10 group/thumb shadow-lg">
        <img
          src={displayThumbnail}
          className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-500"
          alt="thumb"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onWatch(displayUrl, displayTitle)}
            className="rounded-full h-8 w-8 bg-primary/80 hover:bg-primary text-primary-foreground scale-75 group-hover/thumb:scale-100 transition-transform"
          >
            <Play className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-w-0 pr-20">
        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 opacity-70">
          {isPlaylist && isTargeted ? 'Detected Video in Playlist' : 'Detected Content'}
        </p>
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-black text-foreground truncate flex-1 tracking-tight leading-tight uppercase">{displayTitle}</h4>
        </div>
        <div className="flex items-center gap-3 mt-2">
            <p className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5">
              {isPlaylist ? `📁 PL (${metadata.entries?.length || 0})` : '🎬 Single video'}
              {isPlaylist && isTargeted && <span className="text-primary/60">• Targeted Video #{targetEntry.index}</span>}
            </p>
            <Button
                size="sm"
                variant="ghost"
                onClick={() => onWatch(displayUrl, displayTitle)}
                className="h-6 px-2 gap-1.5 text-[9px] font-black bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 transition-all opacity-0 group-meta:opacity-100"
            >
                <Youtube className="w-3 h-3" /> WATCH PREVIEW
            </Button>
        </div>
      </div>
    </div>
  );
}
