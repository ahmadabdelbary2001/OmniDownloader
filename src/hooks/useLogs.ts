import { useState, useCallback, useRef, useEffect } from 'react';

const MAX_LOGS = 500;

export function useLogs() {
  const [logs, setLogs] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (import.meta.env.DEV) {
      endRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [logs]);

  const addLog = useCallback((msg: string) => {
    // We still collect logs in production for background monitoring if needed,
    // but we keep the buffer small and the operation extremely cheap.
    setLogs(prev => {
      const newLogs = [...prev, msg];
      if (newLogs.length > MAX_LOGS) {
        return newLogs.slice(newLogs.length - MAX_LOGS);
      }
      return newLogs;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    logs,
    setLogs,
    addLog,
    clearLogs,
    endRef
  };
}
