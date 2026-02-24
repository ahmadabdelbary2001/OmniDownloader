import { useState, useEffect } from 'react';
import { Download, Folder } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { MediaPreview } from '../molecules/MediaPreview';
import { PlaylistSelector } from '../molecules/PlaylistSelector';
import { VideoPlayer } from '../downloader/VideoPlayer';
import type { VideoQuality, MediaMetadata, DownloadOptions } from '../../types/downloader';

interface DirectTabProps {
  url: string;
  setUrl: (url: string) => void;
  quality: VideoQuality;
  setQuality: (quality: VideoQuality) => void;
  isPlaylist: boolean;
  metadata: MediaMetadata | null;
  onAnalyze: (url: string) => void;
  onDownload: (url: string, options: DownloadOptions) => void;
  onStop: () => void;
  isStopDisabled: boolean;
  isLoading: boolean;
  customPath: string;
  onSelectPath: () => void;
}

export function DirectTab({
  url, setUrl,
  quality, setQuality,
  isPlaylist, metadata,
  onAnalyze, onDownload, onStop, isStopDisabled, isLoading,
  customPath, onSelectPath,
}: DirectTabProps) {
  const [playlistItems, setPlaylistItems] = useState('');
  const [playingVideo, setPlayingVideo]   = useState<{ url: string; title: string } | null>(null);

  // Auto-select a targeted video when metadata loads
  useEffect(() => {
    if (!isPlaylist || !metadata?.entries) { setPlaylistItems(''); return; }

    const { requestedVideoId, requestedIndex, entries } = metadata;
    if (requestedVideoId) {
      const found = entries.find(e => e.id === requestedVideoId);
      if (found) { setPlaylistItems(found.index.toString()); return; }
    }
    if (requestedIndex && requestedIndex <= entries.length) {
      setPlaylistItems(requestedIndex.toString());
    }
  }, [metadata, isPlaylist]);

  const handleDownload = () => {
    const selectedQ    = metadata?.availableQualities?.find(q => q.value === quality);
    const audioOnlySize = metadata?.availableQualities?.find(q => q.value === 'audio')?.size || 0;
    onDownload(url, {
      playlistItems,
      quality,
      downloadPath: customPath || undefined,
      estimatedVideoSize: selectedQ ? (selectedQ.size || 0) - (quality === 'audio' ? 0 : audioOnlySize) : undefined,
      estimatedAudioSize: audioOnlySize || undefined,
    });
  };

  return (
    <div className="flex flex-col h-full p-6 m-0 space-y-6 overflow-hidden relative">
      {/* URL input */}
      <div className="space-y-2 shrink-0">
        <label className="text-[10px] font-black text-primary uppercase tracking-[2px]">Direct Media/Site URL</label>
        <div className="flex gap-2">
          <Input
            placeholder="Paste link here (YouTube, Twitter, BTB, etc.)"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="bg-card/50 border-border/40 text-base py-6 flex-1"
          />
          <Button variant="secondary" onClick={() => onAnalyze(url)} disabled={isLoading || !url} className="h-12 px-6 font-bold border border-white/10">
            {isLoading ? <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" /> : 'ANALYZE'}
          </Button>
        </div>
      </div>

      {/* Metadata preview */}
      {metadata && (
        <MediaPreview
          metadata={metadata}
          url={url}
          isPlaylist={isPlaylist}
          onWatch={(u, t) => setPlayingVideo({ url: u, title: t })}
        />
      )}

      {/* Quality + selection code */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-white/40 uppercase tracking-[2px]">Video Quality</label>
          <Select value={quality} onValueChange={v => setQuality(v as VideoQuality)}>
            <SelectTrigger className="bg-card/50 border-border/40">
              <SelectValue placeholder="Select quality" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              {metadata?.availableQualities?.length ? (
                metadata.availableQualities.map(q => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)
              ) : (
                <>
                  <SelectItem value="best">🚀 Best Available</SelectItem>
                  <SelectItem value="1080p">💎 1080p Full HD</SelectItem>
                  <SelectItem value="720p">✨ 720p HD</SelectItem>
                  <SelectItem value="480p">📱 480p SD</SelectItem>
                  <SelectItem value="audio">🎵 Audio Only (MP3)</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {isPlaylist && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[2px]">Final Selection Code</label>
            <Input value={playlistItems} readOnly placeholder="Auto-generated" className="bg-card/40 border-border/10 text-[10px] font-mono text-primary opacity-60" />
          </div>
        )}
      </div>

      {/* Playlist picker */}
      {isPlaylist && metadata?.entries && metadata.entries.length > 0 && (
        <PlaylistSelector entries={metadata.entries} onSelectionChange={setPlaylistItems} />
      )}

      {/* Action bar */}
      <div className="flex gap-2 shrink-0">
        <Button
          onClick={onSelectPath}
          variant="outline"
          title={customPath || 'Use default path'}
          className={`h-14 px-4 ${customPath ? 'text-primary bg-primary/5 border-primary/30' : 'text-muted-foreground border-border/40'}`}
        >
          <Folder className="w-5 h-5" />
        </Button>
        <Button
          onClick={handleDownload}
          disabled={isLoading || !url}
          className="h-14 flex-1 gap-2 font-bold shadow-2xl text-base uppercase tracking-widest"
          style={{ background: 'var(--grad-hero)' }}
        >
          <Download className="w-5 h-5" />
          {isLoading ? 'Processing...' : playlistItems ? 'Resume / Start Download' : 'Start Processing'}
        </Button>
        {!isStopDisabled && (
          <Button onClick={onStop} variant="destructive" className="h-14 px-8 font-black uppercase tracking-tighter animate-in slide-in-from-right-4">
            STOP
          </Button>
        )}
      </div>

      {playingVideo && (
        <VideoPlayer url={playingVideo.url} title={playingVideo.title} onClose={() => setPlayingVideo(null)} />
      )}
    </div>
  );
}
