import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseSizeToBytes(sizeStr: string): number {
  if (!sizeStr || sizeStr === 'Unknown') return 0;
  const units: {[key: string]: number} = {
    'B': 1,
    'K': 1024,
    'M': 1024**2,
    'G': 1024**3,
    'T': 1024**4,
    'KiB': 1024,
    'MiB': 1024**2,
    'GiB': 1024**3,
    'TiB': 1024**4,
    'KB': 1000,
    'MB': 1000**2,
    'GB': 1000**3,
    'TB': 1000**4
  };

  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2];

  if (!unit) return value;
  
  // Try exact match or first letter (K, M, G, T)
  const multiplier = units[unit] || units[unit.charAt(0).toUpperCase()] || 1;
  return value * multiplier;
}

export function formatBytes(bytes?: number) {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
