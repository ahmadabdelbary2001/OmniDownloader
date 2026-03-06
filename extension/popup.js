// extension/popup.js — Advanced Popup Controller for OmniDownloader Extension v2.4
import OMNI_CONFIG from './config.js';

// ── DOM refs ───────────────────────────────────────────────────────────────
const downloadBtn   = document.getElementById('downloadBtn');
const currentUrlEl  = document.getElementById('currentUrl');
const optionsContent = document.getElementById('optionsContent');

const qualitySelect = document.getElementById('qualitySelect');
const subtitleSelect = document.getElementById('subtitleSelect');
const subtitleField  = document.getElementById('subtitleField');
const pathInput      = document.getElementById('pathInput');

const previewArea  = document.getElementById('previewArea');
const previewThumb = document.getElementById('previewThumb');
const previewTitle = document.getElementById('previewTitle');
const previewMeta  = document.getElementById('previewMeta');

const playlistSection = document.getElementById('playlistSection');
const playlistArea    = document.getElementById('playlistArea');
const selectAllBtn     = document.getElementById('selectAllBtn');
const selectedCountEl  = document.getElementById('selectedCount');

// ── Initialization ─────────────────────────────────────────────────────────

// Load saved options + Sync App Defaults
chrome.storage.sync.get([OMNI_CONFIG.optionsKey], (data) => {
  const options = data[OMNI_CONFIG.optionsKey] || OMNI_CONFIG.defaults;
  // Note: We don't set quality/subtitle here yet because they are dynamicly populated
  pathInput.value = options.path || '';

  fetch(OMNI_CONFIG.endpoints.defaults)
    .then(res => res.json())
    .then(defaults => {
      if (defaults.base_download_path && !pathInput.value) {
        pathInput.placeholder = `Default: ${defaults.base_download_path}`;
      }
    }).catch(() => {
        pathInput.placeholder = "App not connected";
    });
});

// Show current tab URL + Trigger Analysis
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab?.url) {
    let raw = tab.url.replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (raw.length > 35) raw = raw.slice(0, 34) + '…';
    currentUrlEl.textContent = raw;
    analyzeUrl(tab.url);
  } else {
    currentUrlEl.textContent = "No active tab detected";
  }
});

let lastMetadata = null;

async function analyzeUrl(url) {
    previewArea.classList.add('active');
    previewArea.classList.add('shimmer');
    previewTitle.textContent = "Analyzing link...";
    previewThumb.style.opacity = '0';

    try {
        const res = await fetch(`${OMNI_CONFIG.endpoints.analyze}?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        
        lastMetadata = json; // Store for download payload
        previewArea.classList.remove('shimmer');
        if (json.error) {
            previewTitle.textContent = `Error: ${json.error}`;
            return;
        }

        // Auto-reveal options once metadata is ready
        optionsContent.classList.add('active');

        // ── 1. Update Preview ──
        previewTitle.textContent = json.title || "Unknown Title";
        updatePreviewMeta(json);
        if (json.thumbnail) {
            previewThumb.src = json.thumbnail;
            previewThumb.style.opacity = '1';
        }

        // ── 2. Handle Playlist ──
        if (json.entries && json.entries.length > 0) {
            playlistSection.classList.add('active');
            populatePlaylist(json, url);
        } else {
            playlistSection.classList.remove('active');
        }

        // ── 3. Populate Qualities ──
        populateQualities(json);

        // ── 4. Populate Subtitles ──
        if (json.entries && json.entries.length > 0) {
            // Playlist: always show subtitle selector with common languages
            // (entries from yt-dlp playlists are shallow — no subtitle data per entry)
            populatePlaylistSubtitles();
        } else {
            populateSubtitles(json);
        }

    } catch (err) {
        previewArea.classList.remove('shimmer');
        previewTitle.textContent = "Analysis failed (is the app running?)";
    }
}

function populateQualities(json) {
    const formats = json.formats || [];
    const heightMap = new Map();
    
    // Find best audio size
    const audioFormats = formats.filter(f => f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
    const bestAudio = audioFormats.sort((a, b) => (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0))[0];
    const audioSize = bestAudio ? (bestAudio.filesize || bestAudio.filesize_approx || 0) : 0;

    for (const f of formats) {
        if (f.height && f.height >= 144) {
            const currentSize = f.filesize || f.filesize_approx || 0;
            const existing = heightMap.get(f.height);
            if (!existing || currentSize > existing.size) {
                heightMap.set(f.height, { size: currentSize, note: f.format_note || '', fps: f.fps });
            }
        }
    }

    const sortedHeights = Array.from(heightMap.keys()).sort((a, b) => b - a);
    
    // Clear dynamic options (keep 'best')
    qualitySelect.innerHTML = '<option value="best">🚀 Best Available</option>';

    const isPlaylist = json.entries && json.entries.length > 0;

    // Phase 57: Fallback for Playlists (Generic High-Quality options)
    if (sortedHeights.length === 0 && isPlaylist) {
        const playlistDefaults = [
            { h: 2160, label: '4K 2160p' },
            { h: 1440, label: '2K 1440p' },
            { h: 1080, label: 'FHD 1080p' },
            { h: 720, label: 'HD 720p' },
            { h: 480, label: '480p' },
            { h: 360, label: '360p' }
        ];
        playlistDefaults.forEach(d => {
            const opt = document.createElement('option');
            opt.value = `${d.h}p`;
            opt.textContent = d.label;
            qualitySelect.appendChild(opt);
        });
        return;
    }

    sortedHeights.forEach(h => {
        const info = heightMap.get(h);
        const totalSize = info.size + audioSize;
        const sizeStr = (totalSize > 0 && !isPlaylist) ? ` (~${formatBytes(totalSize)})` : '';
        
        let label = `${h}p`;
        if (h >= 2160) label = `4K ${h}p`;
        else if (h >= 1440) label = `2K ${h}p`;
        else if (h >= 1080) label = `FHD ${h}p`;
        else if (h >= 720) label = `HD ${h}p`;

        const suffixes = [];
        if (info.fps > 30) suffixes.push(`${info.fps}fps`);
        if (info.note && info.note.toUpperCase().includes('HDR')) suffixes.push('HDR');
        
        const finalLabel = suffixes.length > 0 ? `${label} (${suffixes.join(' ')})` : label;
        
        const opt = document.createElement('option');
        opt.value = `${h}p`;
        opt.textContent = `${finalLabel}${sizeStr}`;
        opt.dataset.size = totalSize; 
        qualitySelect.appendChild(opt);
    });

    if (audioSize > 0) {
        const opt = document.createElement('option');
        opt.value = 'audio';
        opt.textContent = `🎵 Audio Only (MP3) (~${formatBytes(audioSize)})`;
        opt.dataset.size = audioSize;
        qualitySelect.appendChild(opt);
    }

    const hasSubs = (json.subtitles && Object.keys(json.subtitles).length > 0) || 
                    (json.automatic_captions && Object.keys(json.automatic_captions).length > 0);
    
    if (hasSubs) {
        const opt = document.createElement('option');
        opt.value = 'subtitles';
        opt.textContent = `📜 Subtitles Only (SRT)`;
        opt.dataset.size = 0;
        qualitySelect.appendChild(opt);
    }
}

function populateSubtitles(json) {
    const subs = [];
    const manualSubs = json.subtitles || {};
    const autoSubs = json.automatic_captions || {};
    const videoLang = json.language || 'en';

    for (const [lang, formats] of Object.entries(manualSubs)) {
        subs.push({ lang, name: formats[0]?.name || lang, type: 'manual' });
    }
    for (const [lang, formats] of Object.entries(autoSubs)) {
        if (subs.find(s => s.lang === lang)) continue;
        const isOriginal = lang.toLowerCase() === videoLang.toLowerCase();
        subs.push({ lang, name: `${formats[0]?.name || lang}${isOriginal ? ' (Original)' : ' (Auto)'}`, type: isOriginal ? 'auto' : 'translated', isOriginal });
    }

    if (subs.length > 0) {
        subtitleField.style.display = 'flex';
        subtitleSelect.innerHTML = '<option value="none">No Subtitles</option>';
        
        subs.sort((a,b) => (a.isOriginal ? -1 : 1)).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.lang;
            opt.textContent = s.name;
            if (s.isOriginal) opt.selected = true;
            subtitleSelect.appendChild(opt);
        });
    } else {
        subtitleField.style.display = 'none';
    }
}

function populatePlaylistSubtitles() {
    // For playlists, always show the selector with common languages.
    // Individual video subtitle data is only available when fetching each video separately.
    const commonLangs = [
        { code: 'en',    name: 'English' },
        { code: 'ar',    name: 'Arabic (العربية)' },
        { code: 'fr',    name: 'French (Français)' },
        { code: 'de',    name: 'German (Deutsch)' },
        { code: 'es',    name: 'Spanish (Español)' },
        { code: 'zh-Hans', name: 'Chinese Simplified' },
        { code: 'ja',    name: 'Japanese' },
    ];
    subtitleField.style.display = 'flex';
    subtitleSelect.innerHTML = '<option value="none">No Subtitles</option>';
    commonLangs.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.code;
        opt.textContent = l.name;
        subtitleSelect.appendChild(opt);
    });
}

function populatePlaylist(json, tabUrl) {
    playlistArea.innerHTML = '';
    const entries = json.entries || [];
    
    // Phase 57: "displayThumbnail" logic - Match targeted video from URL 🎯
    let targetIdx = 0;
    try {
        const urlParams = new URLSearchParams(new URL(tabUrl).search);
        const vId = urlParams.get('v');
        const pIdx = urlParams.get('index');
        
        if (vId) {
            const found = entries.findIndex(e => e.id === vId);
            if (found !== -1) targetIdx = found;
        } else if (pIdx) {
            const found = entries.findIndex(e => (e.index || e.playlist_index) == pIdx);
            if (found !== -1) targetIdx = found;
        }
    } catch (e) {}

    entries.forEach((entry, idx) => {
        const item = document.createElement('div');
        item.className = 'playlist-item selected'; // Fixed: Re-added missing classes! 🚀
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.dataset.index = idx;
        
        const isTarget = (idx === targetIdx);
        if (isTarget) {
            item.classList.add('active-preview');
            // Update top preview immediately for the targeted video
            previewTitle.textContent = entry.title || json.title;
            updatePreviewMeta(entry); // Pass entry to match app 👤👁️
            if (entry.subtitles || entry.automatic_captions) {
                populateSubtitles(entry);
            }
            if (entry.thumbnail || (entry.thumbnails?.[0]?.url)) {
                previewThumb.src = entry.thumbnail || entry.thumbnails[0].url;
                previewThumb.style.opacity = '1';
            }
        }

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'item-thumb';
        
        const img = document.createElement('img');
        img.src = entry.thumbnail || (entry.thumbnails?.[0]?.url) || '';
        img.onerror = () => img.style.display = 'none';
        thumbWrap.appendChild(img);
        
        const info = document.createElement('div');
        info.className = 'item-info';
        
        const title = document.createElement('div');
        title.className = 'item-title';
        title.textContent = `${entry.index || idx + 1}. ${entry.title || 'Unknown'}`;
        
        const meta = document.createElement('div');
        meta.className = 'item-meta';
        meta.textContent = entry.duration ? `${formatDuration(entry.duration)}` : 'Video';
        
        info.appendChild(title);
        info.appendChild(meta);
        
        item.appendChild(checkbox);
        item.appendChild(thumbWrap); // Injected Thumbnail 📸
        item.appendChild(info);
        
        // Toggle selection AND Update Preview on row click
        item.onclick = (e) => {
            // If user clicked the checkbox directly, don't double-toggle
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }
            
            // Sync selection state
            item.classList.toggle('selected', checkbox.checked);
            updateSelectedCount();

            // Update Main Preview 🎞️
            previewTitle.textContent = entry.title || "Unknown Title";
            updatePreviewMeta(entry);
            if (entry.subtitles || entry.automatic_captions) {
                populateSubtitles(entry);
            }
            if (entry.thumbnail || entry.thumbnails?.[0]?.url) {
                previewThumb.src = entry.thumbnail || entry.thumbnails[0].url;
                previewThumb.style.opacity = '1';
            }
            
            // Visual highlight (active preview)
            playlistArea.querySelectorAll('.playlist-item').forEach(p => p.classList.remove('active-preview'));
            item.classList.add('active-preview');
        };

        // Checkbox click needs to be synced but handled via row item.onclick
        // We let it propagate so item.onclick catches it, but we adjust the logic above.
        
        playlistArea.appendChild(item);
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const checkboxes = playlistArea.querySelectorAll('input[type="checkbox"]');
    const checked = Array.from(checkboxes).filter(c => c.checked).length;
    
    selectedCountEl.textContent = checked;
    
    if (checked === 0) {
        selectAllBtn.textContent = "Select All";
        selectAllBtn.dataset.nextState = 'select';
    } else if (checked === checkboxes.length) {
        selectAllBtn.textContent = "Deselect All";
        selectAllBtn.dataset.nextState = 'deselect';
    } else {
        selectAllBtn.textContent = "Deselect All"; // If some are selected, next step is often deselect or select? Desktop app usually has "Deselect" if any are selected.
        selectAllBtn.dataset.nextState = 'deselect';
    }
}

selectAllBtn.onclick = () => {
    const state = selectAllBtn.dataset.nextState || 'select';
    const target = (state === 'select');
    
    playlistArea.querySelectorAll('input[type="checkbox"]').forEach(c => {
        c.checked = target;
        c.closest('.playlist-item').classList.toggle('selected', target);
    });
    updateSelectedCount();
};

function formatDuration(sec) {
    if (!sec) return "";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function updatePreviewMeta(data) {
    previewMeta.innerHTML = '';
    const parts = [];
    
    if (data.uploader) parts.push(`<span>👤 ${data.uploader}</span>`);
    if (data.viewCount || data.view_count) {
        const views = data.viewCount || data.view_count;
        parts.push(`<span>👁️ ${formatViews(views)}</span>`);
    }
    if (data.duration) parts.push(`<span>⏱️ ${formatDuration(data.duration)}</span>`);
    if (data.uploadDate || data.upload_date) {
        const date = data.uploadDate || data.upload_date;
        parts.push(`<span>📅 ${formatDate(date)}</span>`);
    }

    previewMeta.innerHTML = parts.join('');
}

function formatViews(views) {
    if (!views) return '';
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
}

function formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr || '';
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
}

// ── Event Listeners ────────────────────────────────────────────────────────

[qualitySelect, subtitleSelect, pathInput].forEach(el => {
  el.addEventListener('change', saveOptions);
});

function saveOptions() {
  const options = {
    quality: qualitySelect.value,
    subtitle: subtitleSelect.value,
    path: pathInput.value
  };
  chrome.storage.sync.set({ [OMNI_CONFIG.optionsKey]: options });
}

// ── Download button ────────────────────────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    downloadBtn.disabled = true;

    const selectedOpt = qualitySelect.options[qualitySelect.selectedIndex];
    const estimatedSize = selectedOpt ? parseInt(selectedOpt.dataset.size || '0') : 0;

    const isPlaylist = lastMetadata && lastMetadata.entries && lastMetadata.entries.length > 0;
    let finalPath = pathInput.value;

    const payload = {
      action: 'sendToApp',
      url: tab.url,
      title: previewTitle.textContent,
      quality: qualitySelect.value,
      estimated_size: estimatedSize,
      subtitle_lang: subtitleSelect.value !== 'none' ? subtitleSelect.value : undefined,
      download_path: finalPath,
      thumbnail: previewThumb.src,
      metadata: lastMetadata, // Initial default
      instant: true
    };

    if (isPlaylist) {
        const selectedIndices = Array.from(playlistArea.querySelectorAll('input[type="checkbox"]:checked'))
            .map(c => parseInt(c.dataset.index));
        
        const selected = lastMetadata.entries.filter((_, idx) => selectedIndices.includes(idx));
        if (selected.length > 0) {
            payload.selected_entries = selected;
            payload.is_playlist = true;
            payload.playlist_title = lastMetadata.title || null; // 📂 Playlist name for sub-folder
            payload.metadata = null; // CRITICAL: Prevent duplication 🛑
        }
    }

    chrome.runtime.sendMessage(payload, (response) => {
      downloadBtn.disabled = false;
      if (response?.status === 'ok') {
        downloadBtn.classList.add('success');
        downloadBtn.innerHTML = iconCheck + ' Added to Queue';
        setTimeout(() => {
          downloadBtn.classList.remove('success');
          downloadBtn.innerHTML = iconPlus + ' Add to Queue';
        }, 3000);
      } else {
        downloadBtn.innerHTML = iconPlus + ' App not running!';
        setTimeout(() => {
          downloadBtn.innerHTML = iconPlus + ' Add to Queue';
        }, 2000);
      }
    });
  });
});

const iconPlus = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>`;
const iconCheck = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
