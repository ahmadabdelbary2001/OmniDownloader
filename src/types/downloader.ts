export interface SearchResult {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  webpage_url: string;
}

export type DownloadService = 'ytdlp' | 'wget';

export type VideoQuality = 'best' | '1080p' | '720p' | '480p' | 'audio';

export interface DownloadOptions {
  playlistItems?: string;
  wgetFilename?: string;
  wgetReferer?: string;
  quality?: VideoQuality;
  downloadPath?: string;
}

export interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  index: number;
}

export interface MediaMetadata {
  title: string;
  thumbnail: string;
  isPlaylist: boolean;
  entries?: PlaylistEntry[];
  formats?: any[];
  requestedVideoId?: string;
  requestedIndex?: number;
}
