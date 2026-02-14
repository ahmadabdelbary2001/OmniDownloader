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
    <div className="flex flex-col h-full bg-black/60 border-white/10 backdrop-blur-3xl shadow-2xl overflow-hidden rounded-xl">
      <div className="py-3 px-4 border-b border-white/5 bg-white/5 flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-[2px] text-white/60">Console Output</span>
        </div>
        <button onClick={onClear} className="h-6 text-[9px] font-black text-white/30 hover:text-white uppercase tracking-wider">Clear</button>
      </div>
      
      <div className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4 font-mono text-[10px] leading-relaxed">
          <div className="space-y-1">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/10">
                <Terminal className="w-10 h-10 mb-2 opacity-10" />
                <p className="font-bold tracking-tighter italic">WAITING FOR COMMAND...</p>
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`py-0.5 border-l-2 pl-3 transition-colors ${
                  log.startsWith('⚠️') ? 'text-yellow-500/80 border-yellow-500/20' : 
                  log.startsWith('❌') ? 'text-red-500/80 border-red-500/20' : 
                  log.startsWith('✅') ? 'text-green-500/80 border-green-500/20' : 
                  log.startsWith('🚀') ? 'text-blue-400 font-bold border-blue-400/20' :
                  log.startsWith('[download]') ? 'text-blue-300/60 border-white/5' :
                  log.startsWith('📦') ? 'text-purple-400 font-black border-purple-400/20' :
                  log.startsWith('🔄') ? 'text-cyan-400 font-bold border-cyan-400/20' :
                  'text-white/40 border-transparent hover:border-white/10'
                }`}>
                  {log}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t border-white/5 bg-black/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Download Status</span>
              <span className={`text-xs font-black ${progress === 100 ? 'text-green-400' : 'text-blue-400'}`}>{Math.round(progress)}%</span>
            </div>
            {!isStopDisabled && (
              <button 
                onClick={onStop} 
                className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-black px-4 py-2 rounded-lg transition-colors uppercase tracking-widest shadow-lg shadow-red-600/20"
              >
                STOP ANYWAY
              </button>
            )}
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
