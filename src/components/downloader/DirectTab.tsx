import { Download } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { VideoQuality, MediaMetadata } from '../../types/downloader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

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
  onDownload: (url: string, options: { playlistItems: string, quality: VideoQuality }) => void;
  isLoading: boolean;
}

export function DirectTab({ 
  url, setUrl, 
  playlistItems, setPlaylistItems, 
  quality, setQuality,
  isPlaylist, metadata,
  onAnalyze, onDownload, isLoading 
}: DirectTabProps) {
  return (
    <div className="flex flex-col h-full p-6 m-0 space-y-6 overflow-y-auto">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-blue-400 uppercase tracking-[2px]">Direct Media/Site URL</label>
          <div className="flex gap-2">
            <Input 
              placeholder="Paste link here (YouTube, Twitter, BTB, etc.)" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-slate-900/50 border-white/10 text-base py-6 flex-1"
            />
            <Button variant="secondary" onClick={() => onAnalyze(url)} disabled={isLoading || !url} className="h-12 px-6 font-bold border border-white/10">
              {isLoading ? <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" /> : "ANALYZE"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/60 italic">Supports smart detection for Telegram and special sites.</p>
        </div>

        {metadata && (
          <div className="flex gap-4 p-3 rounded-lg bg-white/5 border border-white/10 animate-in fade-in slide-in-from-top-2">
            <img src={metadata.thumbnail} className="w-24 aspect-video object-cover rounded border border-white/10" alt="thumb" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider mb-1">Detected Content</p>
              <h4 className="text-xs font-bold text-white truncate">{metadata.title}</h4>
              <p className="text-[10px] text-white/40 mt-1">{isPlaylist ? '📁 Playlist detected' : '🎬 Single video detected'}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[2px]">Video Quality</label>
            <Select value={quality} onValueChange={(v) => setQuality(v as VideoQuality)}>
              <SelectTrigger className="bg-slate-900/50 border-white/10">
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white">
                <SelectItem value="best">🚀 Best Available</SelectItem>
                <SelectItem value="1080p">💎 1080p Full HD</SelectItem>
                <SelectItem value="720p">✨ 720p HD</SelectItem>
                <SelectItem value="480p">📱 480p SD</SelectItem>
                <SelectItem value="audio">🎵 Audio Only (MP3)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isPlaylist && (
            <div className="space-y-2 animate-in zoom-in-95 duration-300">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-[2px]">Playlist Items</label>
              <Input 
                placeholder="e.g. 1,2,5-10" 
                value={playlistItems}
                onChange={(e) => setPlaylistItems(e.target.value)}
                className="bg-slate-900/50 border-white/20 border-2"
              />
            </div>
          )}
        </div>

        <Button onClick={() => onDownload(url, { playlistItems, quality })} disabled={isLoading || !url} className="h-12 w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold shadow-lg shadow-blue-600/20">
          <Download className="w-5 h-5" /> START DOWNLOAD
        </Button>
    </div>
  );
}
