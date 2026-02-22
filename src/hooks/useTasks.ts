import { useState, useEffect, useCallback } from 'react';
import { DownloadTask, DownloadService, DownloadOptions } from '../types/downloader';

export function useTasks() {
  const [tasks, setTasks] = useState<DownloadTask[]>(() => {
    const saved = localStorage.getItem('omni_tasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Reset volatile statuses that don't survive restart
        return parsed.map((t: DownloadTask) => {
          if (t.status === 'downloading' || t.status === 'analyzing') {
            return { ...t, status: 'paused' };
          }
          return t;
        }).sort((a: any, b: any) => (a.queueOrder || 0) - (b.queueOrder || 0));
      } catch (e) {
        console.error("Failed to parse saved tasks", e);
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('omni_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const updateTask = useCallback((id: string, updates: Partial<DownloadTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const reorderTask = useCallback((id: string, direction: 'up' | 'down') => {
    setTasks(prev => {
        const task = prev.find(t => t.id === id);
        if (!task || !task.queueOrder) return prev;
        
        const currentOrder = task.queueOrder;
        const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
        
        if (targetOrder < 1 || targetOrder > prev.length) return prev;
        
        const neighbor = prev.find(t => t.queueOrder === targetOrder);
        if (!neighbor) return prev;
        
        const newTasks = prev.map(t => {
            if (t.id === id) return { ...t, queueOrder: targetOrder };
            if (t.id === neighbor.id) return { ...t, queueOrder: currentOrder };
            return t;
        });
        
        return newTasks.sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0));
    });
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearTasks = useCallback(() => {
    setTasks([]);
  }, []);

  const addTask = useCallback(async (url: string, service: DownloadService, options: DownloadOptions, title: string, thumbnail?: string): Promise<string> => {
    const id = Math.random().toString(36).substring(2, 11);
    
    setTasks(prev => {
      const maxOrder = prev.length > 0 ? Math.max(...prev.map(t => t.queueOrder || 0)) : 0;
      const newTask: DownloadTask = {
        id,
        url,
        title,
        status: 'waiting',
        progress: 0,
        totalBytes: (options.estimatedVideoSize || 0) + (options.estimatedAudioSize || 0),
        service,
        options,
        createdAt: Date.now(),
        thumbnail,
        queueOrder: maxOrder + 1
      };
      return [...prev, newTask].sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0));
    });
    
    return id;
  }, []);

  const addTasksBulk = useCallback(async (items: { url: string, service: DownloadService, options: DownloadOptions, title: string, thumbnail?: string }[]): Promise<string[]> => {
    const ids: string[] = [];
    
    setTasks(prev => {
      let currentMaxOrder = prev.length > 0 ? Math.max(...prev.map(t => t.queueOrder || 0)) : 0;
      const newTasksToAdd: DownloadTask[] = items.map(item => {
        const id = Math.random().toString(36).substring(2, 11);
        ids.push(id);
        currentMaxOrder++;
        return {
          id,
          url: item.url,
          title: item.title,
          status: 'waiting',
          progress: 0,
          totalBytes: (item.options.estimatedVideoSize || 0) + (item.options.estimatedAudioSize || 0),
          service: item.service,
          options: item.options,
          createdAt: Date.now(),
          thumbnail: item.thumbnail,
          queueOrder: currentMaxOrder
        };
      });
      
      return [...prev, ...newTasksToAdd].sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0));
    });
    
    return ids;
  }, []);

  return {
    tasks,
    setTasks,
    updateTask,
    reorderTask,
    removeTask,
    clearTasks,
    addTask,
    addTasksBulk
  };
}
