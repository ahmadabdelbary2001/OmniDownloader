import { Download, Globe, Play, Youtube } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import type { SearchResult } from '../../types/downloader';

interface SearchResultCardProps {
  result: SearchResult;
  onDownload: (url: string) => void;
  onWatch: (url: string, title: string) => void;
}

export function SearchResultCard({ result, onDownload, onWatch }: SearchResultCardProps) {
  return (
    <Card className="overflow-hidden bg-card/50 border-border/20 hover:border-accent/50 transition-all duration-300 group cursor-default shadow-sm hover:shadow-accent/5">
      <div className="flex flex-col sm:flex-row h-full">
        {/* Thumbnail */}
        <div className="relative shrink-0 w-full sm:w-44 aspect-video overflow-hidden group/thumb">
          <img src={result.thumbnail} alt={result.title} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" />
          <div className="absolute inset-0 bg-card/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
            <Button
              size="icon" variant="ghost"
              onClick={() => onWatch(result.webpage_url, result.title)}
              className="rounded-full bg-accent/80 hover:bg-accent text-white scale-90 group-hover/thumb:scale-100 transition-transform shadow-lg shadow-accent/20"
            >
              <Play className="w-4 h-4 fill-current" />
            </Button>
          </div>
          <div className="absolute px-1.5 py-0.5 text-[10px] font-black rounded bg-card/90 bottom-1.5 right-1.5 text-foreground border border-border/30 shadow-lg">
            {result.duration}
          </div>
        </div>

        {/* Info + actions */}
        <CardContent className="flex flex-col justify-between p-3 flex-1 overflow-hidden">
          <h3 className="font-bold text-xs line-clamp-2 text-foreground/90 group-hover:text-primary transition-colors tracking-tight uppercase leading-relaxed">
            {result.title}
          </h3>
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" onClick={() => onDownload(result.webpage_url)} className="h-7 gap-1.5 text-[10px] font-bold bg-accent/20 hover:bg-accent text-accent hover:text-white border border-accent/30 shadow-sm shadow-accent/5">
              <Download className="w-3 h-3" /> DOWNLOAD
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onWatch(result.webpage_url, result.title)} className="h-7 gap-1.5 text-[10px] font-bold text-accent hover:bg-accent/10">
              <Youtube className="w-3 h-3" /> WATCH
            </Button>
            <a href={result.webpage_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground">
                <Globe className="w-3 h-3" /> URL
              </Button>
            </a>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
