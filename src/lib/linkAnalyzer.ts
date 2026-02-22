import { DownloadService } from "../types/downloader";

export interface AnalysisResult {
  service: DownloadService;
  isPlaylist: boolean;
  suggestedName?: string;
  type: 'video' | 'audio' | 'file' | 'playlist' | 'telegram';
}

export function analyzeLinkType(url: string): AnalysisResult {
  const normalized = url.toLowerCase();

  // Telegram
  if (normalized.includes('t.me/')) {
    return { service: 'ytdlp', isPlaylist: false, type: 'telegram' };
  }

  // YouTube / Common Video Sites
  if (normalized.includes('youtube.com') || normalized.includes('youtu.be') || 
      normalized.includes('twitter.com') || normalized.includes('x.com') ||
      normalized.includes('facebook.com') || normalized.includes('instagram.com')) {
    const isPlaylist = normalized.includes('list=') || normalized.includes('/playlist');
    return { service: 'ytdlp', isPlaylist, type: isPlaylist ? 'playlist' : 'video' };
  }

  // Common Direct File Extensions
  const fileExts = ['.mp4', '.mkv', '.avi', '.mp3', '.zip', '.rar', '.exe', '.pdf', '.iso', '.dmg', '.pkg'];
  if (fileExts.some(ext => normalized.endsWith(ext) || normalized.includes(ext + '?'))) {
    const filename = url.split('/').pop()?.split('?')[0] || 'file';
    return { service: 'wget', isPlaylist: false, suggestedName: filename, type: 'file' };
  }

  // Fallback to ytdlp as it supports thousands of sites
  return { service: 'ytdlp', isPlaylist: false, type: 'video' };
}
