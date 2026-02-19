import { useState } from 'react';
import { Search, Download, Globe, Play, Youtube, Loader2, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent } from '../ui/card';
import { SearchResult } from '../../types/downloader';

interface SearchTabProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
  searchResults: SearchResult[];
  onDownload: (url: string) => void;
}

export function SearchTab({ onSearch, isSearching, searchResults, onDownload }: SearchTabProps) {
  const [query, setQuery] = useState('');
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string, embedUrl: string | null } | null>(null);

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleWatch = (url: string, title: string) => {
    const videoId = getYouTubeId(url);
    const embed = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : (url.includes('embed') ? url : null);
    setPlayingVideo({ url, title, embedUrl: embed });
  };

  return (
    <div className="flex flex-col h-full p-4 m-0 overflow-hidden relative">
      <div className="flex flex-col gap-4 mb-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-accent uppercase tracking-[2px]">Enter Search Term</label>
          <div className="flex gap-2">
            <Input 
              placeholder="e.g. funny cats, programming tutorials..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch(query)}
              className="bg-card/50 border-border/40 h-10 text-base focus-visible:ring-primary/50"
            />
            <Button onClick={() => onSearch(query)} disabled={isSearching} variant="accent" className="h-10 min-w-32 font-black uppercase text-[10px] tracking-widest">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              SEARCH
            </Button>
          </div>
        </div>
      </div>

      {/* Integrated Preview Player */}
      {playingVideo && playingVideo.embedUrl && (
        <div className="mb-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-card border border-border shadow-2xl group">
                <iframe 
                    src={playingVideo.embedUrl}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                />
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setPlayingVideo(null)} 
                    className="absolute top-2 right-2 rounded-full bg-card/60 hover:bg-destructive hover:text-destructive-foreground text-foreground border border-border/40 opacity-0 group-hover:opacity-100 transition-all duration-300"
                >
                    <X className="w-4 h-4" />
                </Button>
                <div className="absolute top-2 left-2 px-3 py-1.5 bg-card/70 backdrop-blur-md rounded-lg border border-border/30 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <p className="text-[9px] font-black uppercase text-foreground/80 tracking-widest truncate max-w-[200px]">{playingVideo.title}</p>
                </div>
            </div>
        </div>
      )}
      
      <ScrollArea className="flex-1 pr-3">
        <div className="grid gap-3">
          {searchResults.map((res) => (
            <Card key={res.id} className="overflow-hidden bg-card/50 border-border/20 hover:border-accent/50 transition-all duration-300 group cursor-default shadow-sm hover:shadow-accent/5">
              <div className="flex flex-col sm:flex-row h-full">
                <div className="relative shrink-0 w-full sm:w-44 aspect-video overflow-hidden group/thumb">
                  <img src={res.thumbnail} alt={res.title} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-card/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" onClick={() => handleWatch(res.webpage_url, res.title)} className="rounded-full bg-accent/80 hover:bg-accent text-white scale-90 group-hover/thumb:scale-100 transition-transform shadow-lg shadow-accent/20">
                        <Play className="w-4 h-4 fill-current" />
                      </Button>
                  </div>
                  <div className="absolute px-1.5 py-0.5 text-[10px] font-black rounded bg-card/90 bottom-1.5 right-1.5 text-foreground border border-border/30 shadow-lg">
                    {res.duration}
                  </div>
                </div>
                <CardContent className="flex flex-col justify-between p-3 flex-1 overflow-hidden">
                  <h3 className="font-bold text-xs line-clamp-2 text-foreground/90 group-hover:text-primary transition-colors tracking-tight uppercase leading-relaxed">{res.title}</h3>
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" onClick={() => onDownload(res.webpage_url)} className="h-7 gap-1.5 text-[10px] font-bold bg-accent/20 hover:bg-accent text-accent hover:text-white border border-accent/30 shadow-sm shadow-accent/5">
                      <Download className="w-3 h-3" /> DOWNLOAD
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleWatch(res.webpage_url, res.title)} className="h-7 gap-1.5 text-[10px] font-bold text-accent hover:bg-accent/10">
                      <Youtube className="w-3 h-3" /> WATCH
                    </Button>
                    <a href={res.webpage_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground">
                        <Globe className="w-3 h-3" /> URL
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
          {!isSearching && searchResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/30">
              <Play className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-sm font-medium">Search for videos to get started</p>
            </div>
          )}
        </div>
      </ScrollArea>

    </div>
  );
}
