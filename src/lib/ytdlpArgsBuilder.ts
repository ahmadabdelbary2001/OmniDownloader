import { DownloadOptions } from '../types/downloader';

/**
 * Builds the array of arguments for the yt-dlp command based on the provided options.
 */
export function buildYtDlpArgs(url: string, options: DownloadOptions, downloadPath: string, ffmpegPath: string, client: string = 'web_embedded,mweb', browser: string = 'chrome'): string[] {
  const q = options.quality || 'best';
  const isSubtitleOnly = q === 'subtitles';
  
  let qualityArgs: string;
  if (q === 'audio') {
    qualityArgs = "bestaudio/best";
  } else if (isSubtitleOnly) {
    qualityArgs = "bestaudio/best"; 
  } else if (q === 'best') {
    qualityArgs = "bestvideo+bestaudio/best";
  } else {
    const heightMatch = q.match(/(\d+)/);
    if (heightMatch) {
      const h = parseInt(heightMatch[1]);
      qualityArgs = `bestvideo[height<=${h}][vcodec!*=av01]+bestaudio/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`;
    } else {
      qualityArgs = "bestvideo+bestaudio/best";
    }
  }

  const args = [
    "--js-runtimes", "node",
    "--ffmpeg-location", ffmpegPath,
    ...( (q !== 'subtitles' && q !== 'audio') ? ["--merge-output-format", "mp4"] : []),
    "--extractor-args", `youtube:player-client=${client}`,
    ...(browser !== 'none' ? ["--cookies-from-browser", browser, "--no-cache-dir"] : []),
    "--newline",
    "--progress",
    "--no-colors",
    "-P", downloadPath,
    "-f", qualityArgs,
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "--no-check-certificate",
    "--prefer-free-formats",
    "--continue",
    "--no-overwrites"
  ];

  if (isSubtitleOnly) {
    args.push("--skip-download");
  }

  if (options.playlistItems) args.push("--playlist-items", options.playlistItems);

  if (options.subtitleLang && options.subtitleLang !== 'none' && q !== 'audio') {
    args.push(
      "--write-subs",
      "--write-auto-subs",
      "--sub-langs", options.subtitleLang,
      "--convert-subs", "srt"
    );
    if (options.embedSubtitles && !isSubtitleOnly) {
      args.push("--embed-subs");
    }
  }

  args.push(url);
  return args;
}

/**
 * Builds the array of arguments for a batch playlist download.
 */
export function buildBatchYtDlpArgs(url: string, options: DownloadOptions, downloadPath: string, client: string = 'web_embedded,mweb', browser: string = 'chrome'): string[] {
  const args = [
    url,
    "--js-runtimes", "node",
    '--newline',
    '--progress',
    '--progress-template', '[download] %(progress._percent_str)s of %(progress._total_bytes_estimate_str)s at %(progress._speed_str)s ETA %(progress._eta_str)s',
    '-o', `${downloadPath}/%(title)s.%(ext)s`,
    "--extractor-args", `youtube:player-client=${client}`,
    ...(browser !== 'none' ? ['--cookies-from-browser', browser, '--no-cache-dir'] : []),
  ];

  if (options.playlistItems) {
    args.push('--playlist-items', options.playlistItems);
  }

  // Rest of the flags are similar to single download
  if (options.quality === 'audio') {
    args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3');
  } else if (options.quality === 'subtitles') {
    args.push('--skip-download');
  } else if (options.quality === 'best') {
    args.push('-f', 'bv+ba/b');
  } else if (options.quality) {
    args.push('-f', `bv[height<=${options.quality}]+ba/b[height<=${options.quality}] / bv[height<=${options.quality}]+ba / b[height<=${options.quality}] / b`);
  }

  if (options.subtitleLang && options.subtitleLang !== 'none') {
    args.push('--write-subs', '--write-auto-subs', '--sub-langs', options.subtitleLang, '--convert-subs', 'srt');
    if (options.embedSubtitles && options.quality !== 'subtitles') {
      args.push('--embed-subs');
    }
  }

  if (options.quality !== 'audio' && options.quality !== 'subtitles') {
    args.push('--merge-output-format', 'mp4');
  }

  return args;
}
