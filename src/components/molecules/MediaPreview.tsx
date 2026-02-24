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
    <div className="flex gap-4 p-3 shrink-0 rounded-lg bg-white/5 border border-white/10 animate-in fade-in slide-in-from-top-2 relative group/meta">
      <div className="relative shrink-0 w-24 aspect-video rounded overflow-hidden border border-white/10 group/thumb">
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

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-1">
          {isPlaylist && isTargeted ? 'Detected Video in Playlist' : 'Detected Content'}
        </p>
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white truncate flex-1">{displayTitle}</h4>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onWatch(displayUrl, displayTitle)}
            className="h-6 px-2 gap-1 text-[9px] font-black bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 transition-all opacity-0 group-meta:opacity-100"
          >
            <Youtube className="w-3 h-3" /> WATCH
          </Button>
        </div>
        <p className="text-[10px] text-white/40 mt-1">
          {isPlaylist ? `📁 Playlist (${metadata.entries?.length || 0} videos)` : '🎬 Single video detected'}
          {isPlaylist && isTargeted && ` • Targeted Video #${targetEntry.index}`}
        </p>
      </div>
    </div>
  );
}
