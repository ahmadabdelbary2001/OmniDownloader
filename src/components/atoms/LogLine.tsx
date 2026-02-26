import React from 'react';

/** Maps log-line prefix emojis to their colour classes. */
function logLineClass(log: string): string {
  if (log.startsWith('⚠️'))       return 'text-[var(--acc-300)] border-[var(--acc-300)]/30';
  if (log.startsWith('❌'))       return 'text-destructive border-destructive/30';
  if (log.startsWith('✅'))       return 'text-[var(--acc-400)] font-bold border-[var(--acc-300)]/30';
  if (log.startsWith('🚀'))       return 'text-primary font-bold border-primary/20';
  if (log.startsWith('[download]')) return 'text-[var(--lav-400)]/60 border-border/10';
  if (log.startsWith('📦'))       return 'text-primary font-black border-primary/20';
  if (log.startsWith('🔄'))       return 'text-[var(--acc-300)] font-bold border-[var(--acc-300)]/20';
  return 'text-muted-foreground/40 border-transparent hover:border-border/20';
}

interface LogLineProps {
  log: string;
}

export const LogLine = React.memo(({ log }: LogLineProps) => {
  return (
    <div className={`py-0.5 border-l-2 pl-3 transition-colors ${logLineClass(log)}`}>
      {log}
    </div>
  );
});

LogLine.displayName = 'LogLine';
