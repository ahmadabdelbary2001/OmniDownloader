import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { resolveEmbedUrl } from '../../lib/youtube';

interface VideoPlayerProps {
  url: string;
  title: string;
  onClose: () => void;
}

const IFRAME_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

function PlayerShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col">
        {children}
        <div className="absolute top-4 right-4 z-10">
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/10">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function VideoPlayer({ url, title, onClose }: VideoPlayerProps) {
  const embedUrl = resolveEmbedUrl(url);
  if (!embedUrl) return null;

  const isEmbed = url.includes('embed');

  if (isEmbed) {
    return (
      <PlayerShell onClose={onClose}>
        <iframe src={url} className="w-full h-full" allow={IFRAME_ALLOW} allowFullScreen />
      </PlayerShell>
    );
  }

  return (
    <PlayerShell onClose={onClose}>
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5 backdrop-blur-md">
        <h3 className="text-[10px] font-black uppercase tracking-[2px] text-white/60 truncate mr-10">{title}</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 bg-white/5 hover:bg-white/10 text-white border border-white/10">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 bg-black">
        <iframe src={embedUrl} title={title} className="w-full h-full" allow={IFRAME_ALLOW} allowFullScreen />
      </div>
    </PlayerShell>
  );
}
