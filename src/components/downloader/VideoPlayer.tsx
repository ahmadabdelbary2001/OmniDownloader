import { X } from 'lucide-react';
import { Button } from '../ui/button';

interface VideoPlayerProps {
  url: string;
  title: string;
  onClose: () => void;
}

export function VideoPlayer({ url, title, onClose }: VideoPlayerProps) {
  // Extract YouTube ID
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = getYouTubeId(url);
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;

  if (!embedUrl) {
    // If not YouTube, try to use as direct link if it's an embed already or fallback to external
    if (url.includes('embed')) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                    <div className="absolute top-4 right-4 z-10">
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/10">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                    <iframe 
                        src={url}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
            </div>
        );
    }

    return null; // Don't show if we can't embed (should handle this better in parent)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5 backdrop-blur-md">
            <h3 className="text-[10px] font-black uppercase tracking-[2px] text-white/60 truncate mr-10">{title}</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 bg-white/5 hover:bg-white/10 text-white border border-white/10">
                <X className="w-4 h-4" />
            </Button>
        </div>
        <div className="flex-1 min-h-0 bg-black">
            <iframe 
                src={embedUrl}
                title={title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            ></iframe>
        </div>
      </div>
    </div>
  );
}
