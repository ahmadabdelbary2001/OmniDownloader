import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { QualityOption, VideoQuality } from '../../types/downloader';

interface QualitySelectorProps {
  qualities?: QualityOption[];
  value: VideoQuality;
  onValueChange: (value: VideoQuality) => void;
}

const DEFAULT_QUALITIES: { value: VideoQuality; label: string }[] = [
  { value: 'best',  label: '🚀 Best Available' },
  { value: '1080p', label: '💎 1080p Full HD' },
  { value: '720p',  label: '✨ 720p HD' },
  { value: '480p',  label: '📱 480p SD' },
  { value: 'audio', label: '🎵 Audio Only (MP3)' },
];

export function QualitySelector({
  qualities,
  value,
  onValueChange
}: QualitySelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">
        Quality
        {qualities && (
          <span className="ml-1 text-primary/70 normal-case font-normal">
            ({qualities.length - 1} available)
          </span>
        )}
      </label>
      <Select value={value} onValueChange={(v: any) => onValueChange(v)}>
        <SelectTrigger className="bg-muted/40 border-border h-11 rounded-xl focus:ring-primary/50 transition-all">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card border-border text-foreground rounded-xl">
          {qualities && qualities.length > 0 ? (
            qualities.map((q) => (
              <SelectItem key={q.value} value={q.value}>
                {q.label}
              </SelectItem>
            ))
          ) : (
            DEFAULT_QUALITIES.map((q) => (
              <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
