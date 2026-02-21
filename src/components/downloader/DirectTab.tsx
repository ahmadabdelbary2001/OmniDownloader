import { useState, useEffect } from 'react';
import { Download, Check, ListChecks, Hash, ArrowRight, Play, Youtube, Folder } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { VideoQuality, MediaMetadata, DownloadOptions } from '../../types/downloader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ScrollArea } from '../ui/scroll-area';
import { VideoPlayer } from './VideoPlayer';

interface DirectTabProps {
  url: string;
  setUrl: (url: string) => void;
  playlistItems: string;
  setPlaylistItems: (items: string) => void;
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
  playlistItems, setPlaylistItems, 
  quality, setQuality,
  isPlaylist, metadata,
  onAnalyze, onDownload, onStop, isStopDisabled, isLoading,
  customPath, onSelectPath
}: DirectTabProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [selectionMode, setSelectionMode] = useState<'checkbox' | 'range'>('checkbox');
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null);

  // Sync the playlistItems string whenever selection changes
  useEffect(() => {
    if (!isPlaylist) return;

    if (selectionMode === 'range') {
      if (rangeFrom || rangeTo) {
        setPlaylistItems(`${rangeFrom || 1}-${rangeTo || ''}`);
      } else {
        setPlaylistItems('');
      }
    } else {
      if (selectedIndices.size > 0) {
        setPlaylistItems(Array.from(selectedIndices).sort((a, b) => a - b).join(','));
      } else {
        setPlaylistItems('');
      }
    }
  }, [selectedIndices, rangeFrom, rangeTo, selectionMode, isPlaylist, setPlaylistItems]);

  // Auto-select requested video within playlist
  useEffect(() => {
    if (isPlaylist && metadata?.entries) {
      const next = new Set<number>();
      
      if (metadata.requestedVideoId) {
        const found = metadata.entries.find(e => e.id === metadata.requestedVideoId);
        if (found) {
          next.add(found.index);
        } else if (metadata.requestedIndex && metadata.requestedIndex <= metadata.entries.length) {
          next.add(metadata.requestedIndex);
        }
      } else if (metadata.requestedIndex && metadata.requestedIndex <= metadata.entries.length) {
        next.add(metadata.requestedIndex);
      }

      if (next.size > 0) {
        setSelectedIndices(next);
        setSelectionMode('checkbox');
      }
    } else {
      setSelectedIndices(new Set());
    }
  }, [metadata, isPlaylist]);

  const toggleIndex = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
    setSelectionMode('checkbox');
  };

  const selectAll = () => {
    if (!metadata?.entries) return;
    const all = new Set(metadata.entries.map(e => e.index));
    setSelectedIndices(all);
    setSelectionMode('checkbox');
  };

  const clearSelection = () => {
    setSelectedIndices(new Set());
    setRangeFrom('');
    setRangeTo('');
    setPlaylistItems('');
  };

  return (
    <div className="flex flex-col h-full p-6 m-0 space-y-6 overflow-hidden relative">
        <div className="space-y-2 shrink-0">
          <label className="text-[10px] font-black text-primary uppercase tracking-[2px]">Direct Media/Site URL</label>
          <div className="flex gap-2">
            <Input 
              placeholder="Paste link here (YouTube, Twitter, BTB, etc.)" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-card/50 border-border/40 text-base py-6 flex-1"
            />
            <Button variant="secondary" onClick={() => onAnalyze(url)} disabled={isLoading || !url} className="h-12 px-6 font-bold border border-white/10">
              {isLoading ? <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" /> : "ANALYZE"}
            </Button>
          </div>
        </div>

        {metadata && (
          <div className="flex gap-4 p-3 shrink-0 rounded-lg bg-white/5 border border-white/10 animate-in fade-in slide-in-from-top-2 relative group/meta">
            {(() => {
              const targetEntry = metadata.entries?.find(e => 
                (metadata.requestedVideoId && e.id === metadata.requestedVideoId) || 
                (!metadata.requestedVideoId && metadata.requestedIndex && e.index === metadata.requestedIndex)
              );
              const displayThumbnail = targetEntry?.thumbnail || metadata.thumbnail;
              const displayTitle = targetEntry?.title || metadata.title;
              const displayUrl = targetEntry?.url || url;
              const isTargeted = !!targetEntry;

              return (
                <>
                  <div className="relative shrink-0 w-24 aspect-video rounded overflow-hidden border border-white/10 group/thumb">
                      <img 
                        src={displayThumbnail} 
                        className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-500" 
                        alt="thumb" 
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" onClick={() => setPlayingVideo({ url: displayUrl, title: displayTitle })} className="rounded-full h-8 w-8 bg-primary/80 hover:bg-primary text-primary-foreground scale-75 group-hover/thumb:scale-100 transition-transform">
                            <Play className="w-3 h-3" />
                          </Button>
                      </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-1">
                      {isPlaylist && isTargeted ? 'Detected Video in Playlist' : 'Detected Content'}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-white truncate flex-1">
                          {displayTitle}
                        </h4>
                        <Button size="sm" variant="ghost" onClick={() => setPlayingVideo({ url: displayUrl, title: displayTitle })} className="h-6 px-2 gap-1 text-[9px] font-black bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 transition-all opacity-0 group-meta:opacity-100">
                          <Youtube className="w-3 h-3" /> WATCH
                        </Button>
                    </div>
                    <p className="text-[10px] text-white/40 mt-1">
                      {isPlaylist ? `📁 Playlist (${metadata.entries?.length || 0} videos)` : '🎬 Single video detected'}
                      {isPlaylist && isTargeted && ` • Targeted Video #${targetEntry.index}`}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 shrink-0">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[2px]">Video Quality</label>
            <Select value={quality} onValueChange={(v) => setQuality(v as VideoQuality)}>
              <SelectTrigger className="bg-card/50 border-border/40">
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                {metadata?.availableQualities && metadata.availableQualities.length > 0 ? (
                  metadata.availableQualities.map((q) => (
                    <SelectItem key={q.value} value={q.value}>
                      {q.label}
                    </SelectItem>
                  ))
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
               <Input 
                  value={playlistItems}
                  readOnly
                  placeholder="Auto-generated"
                   className="bg-card/40 border-border/10 text-[10px] font-mono text-primary opacity-60"
               />
            </div>
          )}
        </div>

        {isPlaylist && metadata?.entries && metadata.entries.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 border border-white/5 rounded-xl bg-black/20 overflow-hidden animate-in zoom-in-95 duration-300">
             {(() => {
               const entries = metadata.entries;
               const totalEntries = entries.length;
               return (
                 <>
                   <div className="p-3 border-b border-white/5 bg-white/5 flex items-center justify-between shrink-0">
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setSelectionMode('checkbox')}
                          className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${selectionMode === 'checkbox' ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                        >
                          <ListChecks className="w-3 h-3" /> Select Videos
                        </button>
                        <button 
                          onClick={() => setSelectionMode('range')}
                          className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${selectionMode === 'range' ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                        >
                          <ListChecks className="w-3 h-3" /> Range (From-To)
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={selectAll} className="text-[9px] font-bold text-white/30 hover:text-white uppercase transition-colors">Select All</button>
                        <button onClick={clearSelection} className="text-[9px] font-bold text-white/30 hover:text-white uppercase transition-colors">Clear</button>
                      </div>
                   </div>

                   <div className="flex-1 overflow-hidden relative">
                      {selectionMode === 'checkbox' ? (
                        <ScrollArea className="h-full">
                          <div className="p-2 space-y-1">
                            {entries.map((entry) => (
                              <div 
                                key={entry.id} 
                                onClick={() => toggleIndex(entry.index)}
                                className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200 ${selectedIndices.has(entry.index) ? 'bg-primary/10 border-primary/20' : 'hover:bg-muted/30 border-transparent'} border`}
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedIndices.has(entry.index) ? 'bg-primary border-primary' : 'border-border/30 group-hover:border-border/60'}`}>
                                  {selectedIndices.has(entry.index) && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                </div>
                                <span className="text-[10px] font-bold text-white/30 w-4 shrink-0">{entry.index}</span>
                                <span className={`text-xs truncate flex-1 ${selectedIndices.has(entry.index) ? 'text-primary font-bold' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                  {entry.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center p-8 space-y-6">
                          <div className="flex flex-col items-center gap-2 mb-2">
                              <Hash className="w-8 h-8 text-primary/40" />
                             <h3 className="text-[10px] font-black uppercase tracking-[3px] text-white/40">Range Selection</h3>
                          </div>
                          <div className="flex items-center gap-4 bg-white/5 p-6 rounded-2xl border border-white/10 shadow-2xl">
                             <div className="space-y-2">
                                <label className="text-[9px] font-bold text-white/20 uppercase block ml-1">From Index</label>
                                <Input 
                                  type="number" 
                                  min={1}
                                  max={totalEntries}
                                  placeholder="1" 
                                  value={rangeFrom}
                                  onChange={(e) => { 
                                    const val = Math.max(1, Math.min(Number(e.target.value) || 1, totalEntries));
                                    setRangeFrom(val.toString()); 
                                    setSelectionMode('range'); 
                                  }}
                                   className="bg-card/50 border-border/40 w-24 text-center h-12 text-lg font-black"
                                />
                             </div>
                             <ArrowRight className="w-4 h-4 text-white/20 mt-6" />
                             <div className="space-y-2">
                                <label className="text-[9px] font-bold text-white/20 uppercase block ml-1">To Index</label>
                                <Input 
                                  type="number" 
                                  min={1}
                                  max={totalEntries}
                                  placeholder={totalEntries.toString()}
                                  value={rangeTo}
                                  onChange={(e) => { 
                                    const val = Math.max(1, Math.min(Number(e.target.value) || totalEntries, totalEntries));
                                    setRangeTo(val.toString()); 
                                    setSelectionMode('range'); 
                                  }}
                                   className="bg-card/50 border-border/40 w-24 text-center h-12 text-lg font-black"
                                />
                             </div>
                          </div>
                          <p className="text-[10px] text-white/20 italic max-w-[200px] text-center">Enter the start and end positions. Leave "To" empty to download until the end.</p>
                        </div>
                      )}
                   </div>
                 </>
               );
             })()}
          </div>
        )}

        <div className="flex gap-2 shrink-0">
          <Button 
            onClick={onSelectPath}
            variant="outline"
            title={customPath || "Use default path"}
            className={`h-14 px-4 ${customPath ? 'text-primary bg-primary/5 border-primary/30' : 'text-muted-foreground border-border/40'}`}
          >
            <Folder className="w-5 h-5" />
          </Button>
          <Button 
            onClick={() => {
              const selectedQ = metadata?.availableQualities?.find(q => q.value === quality);
              const audioOnlySize = metadata?.availableQualities?.find(q => q.value === 'audio')?.size || 0;
              
              onDownload(url, { 
                playlistItems, 
                quality, 
                downloadPath: customPath || undefined,
                estimatedVideoSize: selectedQ ? (selectedQ.size || 0) - (quality === 'audio' ? 0 : audioOnlySize) : undefined,
                estimatedAudioSize: audioOnlySize || undefined
              });
            }} 
            disabled={isLoading || !url} 
            className="h-14 flex-1 gap-2 font-bold shadow-2xl text-base uppercase tracking-widest"
            style={{ background: 'var(--grad-hero)' }}
          >
            <Download className="w-5 h-5" /> {isLoading ? 'Processing...' : (playlistItems ? 'Resume / Start Download' : 'Start Processing')}
          </Button>
          
          {!isStopDisabled && (
            <Button 
              onClick={onStop} 
              variant="destructive"
              className="h-14 px-8 font-black uppercase tracking-tighter animate-in slide-in-from-right-4"
            >
              STOP
            </Button>
          )}
        </div>

        {playingVideo && (
            <VideoPlayer 
                url={playingVideo.url} 
                title={playingVideo.title} 
                onClose={() => setPlayingVideo(null)} 
            />
        )}
    </div>
  );
}
