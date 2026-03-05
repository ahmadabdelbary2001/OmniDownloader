// extension/config.js — Shared constants for OmniDownloader Extension v2.4

const OMNI_CONFIG = {
  version:    '2.4',
  appName:    'OmniDownloader',
  serverBase: 'http://127.0.0.1:7433',
  endpoints: {
    status:  'http://127.0.0.1:7433/status',
    add:     'http://127.0.0.1:7433/add',
    analyze: 'http://127.0.0.1:7433/analyze',
    defaults: 'http://127.0.0.1:7433/defaults',
    setDefaults: 'http://127.0.0.1:7433/set-defaults',
  },
  // MV3 chrome.alarms minimum is 1 minute — background polls on this cadence
  pollInterval: 10_000,
  // Storage keys
  storageKey: 'omni_app_status',
  optionsKey: 'omni_download_options',
  // Default values for dropdowns
  defaults: {
    quality: 'best',
    subtitle: 'ar',
    path: '',
  }
};

export default OMNI_CONFIG;
