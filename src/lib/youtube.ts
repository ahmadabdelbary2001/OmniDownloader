/** Extracts the 11-character video ID from any YouTube URL variant. */
export function getYouTubeId(url: string): string | null {
  const match = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/);
  return match && match[2].length === 11 ? match[2] : null;
}

/** Builds an embed URL for YouTube, or returns the URL as-is if it already contains "embed". */
export function resolveEmbedUrl(url: string): string | null {
  const id = getYouTubeId(url);
  const listMatch = url.match(/[?&]list=([^#&?]*)/);
  const listId = listMatch ? listMatch[1] : null;

  // If both exist, show video with playlist context
  if (id && listId) return `https://www.youtube.com/embed/${id}?list=${listId}&autoplay=1`;
  
  // Standalone video
  if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
  
  // Standalone playlist
  if (listId) return `https://www.youtube.com/embed/videoseries?list=${listId}&autoplay=1`;

  if (url.includes('embed')) return url;
  return null;
}
