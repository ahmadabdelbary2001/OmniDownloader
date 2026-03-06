import { DownloadOptions } from '../types/downloader';

/**
 * Builds the array of arguments for the yt-dlp command based on the provided options.
 */
export function buildYtDlpArgs(url: string, options: DownloadOptions, downloadPath: string, ffmpegPath: string, client: string = 'web_embedded,mweb', browser: string = 'chrome'): string[] {
  const q = options.quality || 'best';
  const isSubtitleOnly = q === 'subtitles';
  
  let qualityArgs: string;
  let sortArgs: string | null = null;

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
      // Priority 1: Exact match height
      // Priority 2: Best under or equal height
      // Priority 3: Anything (fallback)
      qualityArgs = `(bestvideo[height=${h}]+bestaudio/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best)`;
      sortArgs = `res:${h},fps,vcodec:h264,aext:m4a,proto`;
    } else {
      qualityArgs = "bestvideo+bestaudio/best";
    }
  }

  // Phase 53: SABR Bypass, JS-Less (android_vr), and Solver Relaxation
  // android_vr is a JS-less client that often works when others fail with 403/n-challenge
  const finalClient = client === 'web_embedded,mweb' ? 'android_vr,web,web_embedded,mweb' : client;
  const extractorArgs = `youtube:player-client=${finalClient};fetch-pot=always;formats=missing_pot,incomplete;player_js_variant=actual;innertube_host=www.youtube.com`;

  const args = [
    "--js-runtimes", "node",
    "--ffmpeg-location", ffmpegPath,
    ...( (q !== 'subtitles' && q !== 'audio') ? ["--merge-output-format", "mp4"] : []),
    "--extractor-args", extractorArgs,
    ...(browser !== 'none' ? ["--cookies-from-browser", browser, "--no-cache-dir"] : []),
    "--newline",
    "--progress",
    "--no-colors",
    "-P", downloadPath,
    "-f", qualityArgs,
    ...(sortArgs ? ["-S", sortArgs] : []),
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "--no-check-certificate",
    "--prefer-free-formats",
    "--continue",
    "--no-overwrites"
  ];

  if (isSubtitleOnly) {
    args.push("--skip-download", "--ignore-errors");
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
  const q = options.quality || 'best';
  const isSubtitleOnly = q === 'subtitles';
  
  let qualityArgs: string;
  let sortArgs: string | null = null;

  if (q === 'audio') {
    qualityArgs = 'ba/b';
  } else if (isSubtitleOnly) {
    qualityArgs = 'ba';
  } else if (q === 'best') {
    qualityArgs = 'bv+ba/b';
  } else {
    const heightMatch = q.match(/(\d+)/);
    if (heightMatch) {
      const h = parseInt(heightMatch[1]);
      qualityArgs = `(bestvideo[height=${h}]+bestaudio/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best)`;
      sortArgs = `res:${h},fps,vcodec:h264,aext:m4a,proto`;
    } else {
      qualityArgs = 'bv+ba/b';
    }
  }

  const finalClient = client === 'web_embedded,mweb' ? 'android_vr,web,web_embedded,mweb' : client;
  const extractorArgs = `youtube:player-client=${finalClient};fetch-pot=always;formats=missing_pot,incomplete;player_js_variant=actual;innertube_host=www.youtube.com`;

  const args = [
    url,
    "--js-runtimes", "node",
    '--newline',
    '--progress',
    '--progress-template', '[download] %(progress._percent_str)s of %(progress._total_bytes_estimate_str)s at %(progress._speed_str)s ETA %(progress._eta_str)s',
    '-o', `${downloadPath}/%(title)s.%(ext)s`,
    '-f', qualityArgs,
    ...(sortArgs ? ["-S", sortArgs] : []),
    "--extractor-args", extractorArgs,
    "--no-check-certificate",
    ...(browser !== 'none' ? ['--cookies-from-browser', browser, '--no-cache-dir'] : []),
  ];

  if (options.playlistItems) {
    args.push('--playlist-items', options.playlistItems);
  }

  if (q === 'audio') {
    args.push('-x', '--audio-format', 'mp3');
  } else if (isSubtitleOnly) {
    args.push('--skip-download', '--ignore-errors');
  }

  if (options.subtitleLang && options.subtitleLang !== 'none') {
    args.push('--write-subs', '--write-auto-subs', '--sub-langs', options.subtitleLang, '--convert-subs', 'srt');
    if (options.embedSubtitles && q !== 'subtitles' && q !== 'audio') {
      args.push('--embed-subs');
    }
  }

  if (q !== 'audio' && q !== 'subtitles') {
    args.push('--merge-output-format', 'mp4');
  }

  return args;
}
