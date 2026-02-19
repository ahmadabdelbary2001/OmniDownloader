import { Terminal } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface LogViewerProps {
  logs: string[];
  progress: number;
  onClear: () => void;
  onStop: () => void;
  isStopDisabled: boolean;
  endRef: React.RefObject<HTMLDivElement | null>;
}

export function LogViewer({ logs, progress, onClear, onStop, isStopDisabled, endRef }: LogViewerProps) {
  return (
    <div className="flex flex-col h-full bg-card/60 border-border/10 backdrop-blur-3xl shadow-2xl overflow-hidden rounded-xl">
      <div className="py-3 px-4 border-b border-border/10 bg-muted/20 flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground">Console Output</span>
        </div>
        <button onClick={onClear} className="h-6 text-[9px] font-black text-muted-foreground/40 hover:text-foreground uppercase tracking-wider">Clear</button>
      </div>
      
      <div className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4 font-mono text-[10px] leading-relaxed">
          <div className="space-y-1">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/20">
                <Terminal className="w-10 h-10 mb-2 opacity-10" />
                <p className="font-bold tracking-tighter italic">WAITING FOR COMMAND...</p>
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`py-0.5 border-l-2 pl-3 transition-colors ${
                  log.startsWith('⚠️') ? 'text-[var(--acc-300)] border-[var(--acc-300)]/30' : 
                  log.startsWith('❌') ? 'text-destructive border-destructive/30' : 
                  log.startsWith('✅') ? 'text-[var(--acc-400)] font-bold border-[var(--acc-300)]/30' : 
                  log.startsWith('🚀') ? 'text-primary font-bold border-primary/20' :
                  log.startsWith('[download]') ? 'text-[var(--lav-400)]/60 border-border/10' :
                  log.startsWith('📦') ? 'text-primary font-black border-primary/20' :
                  log.startsWith('🔄') ? 'text-[var(--acc-300)] font-bold border-[var(--acc-300)]/20' :
                  'text-muted-foreground/40 border-transparent hover:border-border/20'
                }`}>
                  {log}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t border-border/10 bg-card/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[2px]">Download Status</span>
              <span
                className="text-xs font-black"
                style={{ color: progress === 100 ? 'var(--acc-400)' : 'var(--lav-400)' }}
              >{Math.round(progress)}%</span>
            </div>
            {!isStopDisabled && (
              <button 
                onClick={onStop} 
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-[10px] font-black px-4 py-2 rounded-lg transition-colors uppercase tracking-widest shadow-lg"
              >
                STOP ANYWAY
              </button>
            )}
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: progress === 100
                  ? 'linear-gradient(90deg, var(--acc-300) 0%, var(--acc-400) 100%)'
                  : 'linear-gradient(90deg, var(--lav-400) 0%, var(--acc-300) 100%)',
                boxShadow: progress === 100
                  ? '0 0 10px rgba(126,202,196,0.5)'
                  : '0 0 10px rgba(123,104,160,0.4)',
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
