import { useState, useCallback, useRef, useEffect } from 'react';

export function useLogs() {
  const [logs, setLogs] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, msg].slice(-1000));
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
