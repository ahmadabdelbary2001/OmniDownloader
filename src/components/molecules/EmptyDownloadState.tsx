import { Plus } from 'lucide-react';
import Logo from '../../assets/logo.svg';

export function EmptyDownloadState() {
  return (
    <div className="flex flex-col items-center justify-center h-full relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.06]" style={{ background: 'var(--grad-aurora)' }} />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, var(--acc-300), transparent)' }} />
        <div className="absolute top-1/4 right-1/4 w-48 h-48 rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, var(--lav-400), transparent)' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-sm text-center p-8">
        <div className="w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl relative" style={{ background: 'var(--grad-hero)' }}>
          <div className="absolute inset-0 rounded-3xl opacity-40" style={{ background: 'radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.25) 0%, transparent 60%)' }} />
          <img src={Logo} alt="OmniDownloader" className="w-16 h-16 drop-shadow-xl relative z-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--acc-300)' }}>Ready to Download</h2>
          <p className="text-xs font-bold text-muted-foreground tracking-widest uppercase">No downloads in your list yet</p>
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed mt-2">
            Add a URL by clicking <strong className="text-accent">Add URL</strong> in the toolbar above
          </p>
        </div>

        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border"
          style={{ background: 'rgba(126,202,196,0.08)', borderColor: 'rgba(126,202,196,0.2)', color: 'var(--acc-400)' }}
        >
          <Plus className="w-3 h-3" /> Add URL to get started
        </div>
      </div>
    </div>
  );
}
