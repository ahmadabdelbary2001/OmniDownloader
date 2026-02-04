export interface SearchResult {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  webpage_url: string;
}

export type DownloadService = 'ytdlp' | 'wget';

export interface DownloadOptions {
  playlistItems?: string;
  wgetFilename?: string;
  wgetReferer?: string;
}
