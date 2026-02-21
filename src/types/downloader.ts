export interface SearchResult {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  webpage_url: string;
}

export type DownloadService = 'ytdlp' | 'wget';

export type VideoQuality = string; // dynamic: 'best' | '1080p' | '720p' | '480p' | 'audio' | ...

export interface DownloadOptions {
  playlistItems?: string;
  wgetFilename?: string;
  wgetReferer?: string;
  quality?: VideoQuality;
  downloadPath?: string;
  subtitleLang?: string;
  embedSubtitles?: boolean;
}

export type TaskStatus = 'analyzing' | 'waiting' | 'downloading' | 'paused' | 'completed' | 'failed';

export interface DownloadTask {
  id: string;
  url: string;
  title: string;
  status: TaskStatus;
  progress: number;
  speed?: string;
  size?: string;
  downloaded?: string;
  eta?: string;
  service: DownloadService;
  options: DownloadOptions;
  createdAt: number;
  thumbnail?: string;
  queueOrder?: number;
}

export interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  index: number;
}

export interface SubtitleTrack {
  lang: string;
  name: string;
  type: 'manual' | 'auto' | 'translated';
  isOriginal?: boolean;
}

export interface QualityOption {
  value: string; // '1080p', '720p', etc.
  label: string; // '1080p (~150 MB)'
  size?: number; // bytes
}

export interface MediaMetadata {
  id?: string;
  title: string;
  thumbnail: string;
  isPlaylist: boolean;
  entries?: PlaylistEntry[];
  formats?: any[];
  availableQualities?: QualityOption[]; 
  availableSubtitles?: SubtitleTrack[];
  requestedVideoId?: string;
  requestedIndex?: number;
}

