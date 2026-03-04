import { useState } from 'react';
import { Search, Play, Loader2, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { SearchResultCard } from '../molecules/SearchResultCard';
import { resolveEmbedUrl } from '../../lib/youtube';
import type { SearchResult } from '../../types/downloader';

interface SearchTabProps {
  onSearch: (query: string, type: string) => void;
  isSearching: boolean;
  searchResults: SearchResult[];
  onDownload: (url: string) => void;
}

export function SearchTab({ onSearch, isSearching, searchResults, onDownload }: SearchTabProps) {
  const [query, setQuery]               = useState('');
  const [searchType, setSearchType]     = useState<'video' | 'videoShort' | 'playlist' | ''>('video');
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string; embedUrl: string } | null>(null);

  const doSearch = () => onSearch(query, searchType);

  const handleWatch = (url: string, title: string) => {
    const embedUrl = resolveEmbedUrl(url);
    if (embedUrl) setPlayingVideo({ url, title, embedUrl });
  };

  return (
    <div className="flex flex-col h-full p-4 m-0 overflow-hidden relative">
      {/* Search input */}
      <div className="flex flex-col gap-4 mb-4">
          {/* Type toggle */}
          <div className="flex gap-1">
            {([
              { label: '🎬 Videos',   value: 'video'      },
              { label: '⚡ Shorts',   value: 'videoShort' },
              { label: '📋 Playlists',value: 'playlist'  },
              { label: '🌐 All',      value: ''           },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setSearchType(opt.value)}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all ${
                  searchType === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card/40 text-muted-foreground border-border/40 hover:border-primary/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. funny cats, programming tutorials..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              className="bg-card/50 border-border/40 h-10 text-base focus-visible:ring-primary/50"
            />
            <Button onClick={doSearch} disabled={isSearching} variant="hero" className="h-10 min-w-32">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              SEARCH
            </Button>
          </div>
      </div>

      {/* Inline preview */}
      {playingVideo && (
        <div className="mb-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-card border border-border shadow-2xl group">
            <iframe 
              src={playingVideo.embedUrl} 
              className="w-full h-full" 
              allowFullScreen 
              allow="autoplay; encrypted-media" 
              sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
              title="Preview"
            />
            <Button
              variant="ghost" size="icon"
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

      {/* Results */}
      <ScrollArea className="flex-1 pr-3">
        <div className="grid gap-3">
          {searchResults.map(res => (
            <SearchResultCard key={res.id} result={res} onDownload={onDownload} onWatch={handleWatch} />
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
