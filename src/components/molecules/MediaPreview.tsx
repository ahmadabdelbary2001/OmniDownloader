import { Play, Youtube, Eye, User, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import type { MediaMetadata } from '../../types/downloader';
import { formatDuration } from '../../lib/utils';

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

  // Use duration from target entry if targeted, otherwise from metadata root
  const displayDuration = targetEntry?.duration || metadata.duration;

  // Formatting helpers
  const formatViews = (views?: number) => {
    if (!views) return null;
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-gradient-to-br from-primary/[0.05] to-secondary/[0.05] border border-primary/10 animate-in fade-in slide-in-from-top-4 duration-700 relative overflow-hidden group/meta">
      {/* Pulsing dot - Visual indicator of active metadata */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm z-10">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
        <span className="text-[8px] font-black text-primary uppercase tracking-widest">Metadata Active</span>
      </div>

      <div className="relative shrink-0 w-full sm:w-32 aspect-video rounded-xl overflow-hidden border border-white/10 group/thumb shadow-lg">
        <img
          src={displayThumbnail}
          className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-500"
          alt="thumb"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
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
        
        {displayDuration && (
          <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[9px] font-bold text-white backdrop-blur-sm">
            {formatDuration(displayDuration)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 pr-0 sm:pr-20">
        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 opacity-70">
          {isPlaylist && isTargeted ? 'Detected Video in Playlist' : 'Detected Content'}
        </p>
        <h4 className="text-sm font-black text-foreground truncate tracking-tight leading-tight uppercase mb-2">
          {displayTitle}
        </h4>
        
        <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
          <p className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-1.5">
            {isPlaylist ? `📁 PL (${metadata.entries?.length || 0})` : '🎬 Single video'}
            {isPlaylist && isTargeted && <span className="text-primary/60">• Targeted Video #{targetEntry.index}</span>}
          </p>

          {metadata.uploader && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground/60">
              <User className="w-3 h-3 text-primary/40" />
              <span className="truncate max-w-[120px]">{metadata.uploader}</span>
            </div>
          )}

          {metadata.viewCount && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground/60">
              <Eye className="w-3 h-3 text-primary/40" />
              <span>{formatViews(metadata.viewCount)}</span>
            </div>
          )}

          {metadata.uploadDate && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground/60">
              <Calendar className="w-3 h-3 text-primary/40" />
              <span>{formatDate(metadata.uploadDate)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-3">
            <Button
                size="sm"
                variant="ghost"
                onClick={() => onWatch(displayUrl, displayTitle)}
                className="h-7 px-3 gap-1.5 text-[9px] font-black bg-primary/5 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/10 transition-all"
            >
                <Youtube className="w-3 h-3" /> WATCH PREVIEW
            </Button>
        </div>
      </div>
    </div>
  );
}
