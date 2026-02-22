import { parseSizeToBytes } from './utils';

export const parseProgress = (line: string) => {
  // yt-dlp patterns: 
  // [download]  12.3% of 10.00MiB at  2.41MiB/s ETA 00:04
  // [download]  12.3% of ~10.00MiB at  2.41MiB/s ETA 00:04
  const percentMatch = line.match(/(\d+\.?\d*)%/);
  const sizeMatch = line.match(/of\s+(~?\d+\.?\d*[KMGT]iB)/);
  const speedMatch = line.match(/at\s+(\d+\.?\d*[KMGT]iB\/s)/);
  const etaMatch = line.match(/ETA\s+(\d+:\d+)/);

  const sizeStr = sizeMatch ? sizeMatch[1].replace('~', '') : undefined;
  const percent = percentMatch ? parseFloat(percentMatch[1]) : null;
  const totalBytes = parseSizeToBytes(sizeStr || '');
  const downloadedBytes = percent !== null ? (percent / 100) * totalBytes : 0;

  return {
    percent,
    size: sizeStr,
    speed: speedMatch ? speedMatch[1] : undefined,
    eta: etaMatch ? etaMatch[1] : undefined,
    totalBytes,
    downloadedBytes
  };
};

export const formatBytes = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const isWindows = () => navigator.userAgent.includes('Windows');
