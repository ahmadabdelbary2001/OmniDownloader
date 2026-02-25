import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { SubtitleTrack } from '../../types/downloader';

interface SubtitleSelectorProps {
  subtitles: SubtitleTrack[];
  value: string;
  onValueChange: (value: string) => void;
  showAllTranslations: boolean;
  onToggleTranslations: (show: boolean) => void;
  embedSubtitles: boolean;
  onToggleEmbed: (embed: boolean) => void;
}

export function SubtitleSelector({
  subtitles,
  value,
  onValueChange,
  showAllTranslations,
  onToggleTranslations,
  embedSubtitles,
  onToggleEmbed
}: SubtitleSelectorProps) {
  const manual = subtitles.filter(s => s.type === 'manual');
  const auto = subtitles.filter(s => s.type === 'auto');
  const translated = subtitles.filter(s => s.type === 'translated');

  return (
    <div className="space-y-4 animate-in slide-in-from-top-2">
      <div className="flex items-center justify-between px-1">
        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Subtitles Selection</label>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-translations"
            className="w-3 h-3 rounded border-border text-primary focus:ring-primary/50"
            checked={showAllTranslations}
            onChange={(e) => onToggleTranslations(e.target.checked)}
          />
          <label htmlFor="show-translations" className="text-[9px] font-bold uppercase text-muted-foreground cursor-pointer">Show All Translations</label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className="bg-muted/40 border-border h-11 rounded-xl focus:ring-primary/50 transition-all font-bold">
              <SelectValue placeholder="Select Subtitle" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground rounded-xl max-h-[300px]">
              <SelectItem value="none">❌ No Subtitles</SelectItem>
              
              {manual.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[9px] font-black text-primary/50 uppercase tracking-widest bg-primary/5 rounded mt-1 mb-1">Official / Manual</div>
                  {manual.map(s => <SelectItem key={s.lang} value={s.lang}>💠 {s.name}</SelectItem>)}
                </>
              )}

              {auto.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[9px] font-black text-amber-500/50 uppercase tracking-widest bg-amber-500/5 rounded mt-2 mb-1">Auto-generated (Original)</div>
                  {auto.map(s => <SelectItem key={s.lang} value={s.lang}>🎙️ {s.name}</SelectItem>)}
                </>
              )}

              {translated.length > 0 && showAllTranslations && (
                <>
                  <div className="px-2 py-1 text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest bg-muted/5 rounded mt-2 mb-1">Auto Translate</div>
                  {translated.map(s => <SelectItem key={s.lang} value={s.lang}>🌍 {s.name}</SelectItem>)}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {value !== 'none' && (
          <div className="flex items-center h-11 px-4 bg-muted/40 border border-border rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer w-full">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
                checked={embedSubtitles}
                onChange={(e) => onToggleEmbed(e.target.checked)}
              />
              <span className="text-[10px] font-bold uppercase tracking-widest">Embed into Video</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
