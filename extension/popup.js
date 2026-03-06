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
        if (json.thumbnail) {
            previewThumb.src = json.thumbnail;
            previewThumb.style.opacity = '1';
        }

        // ── 2. Populate Qualities ──
        populateQualities(json);

        // ── 3. Populate Subtitles ──
        populateSubtitles(json);

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

    sortedHeights.forEach(h => {
        const info = heightMap.get(h);
        const totalSize = info.size + audioSize;
        const sizeStr = totalSize > 0 ? ` (~${formatBytes(totalSize)})` : '';
        
        let labelPrefix = `${h}p`;
        if (h >= 2160) labelPrefix = `4K ${h}p`;
        else if (h >= 1440) labelPrefix = `2K ${h}p`;
        else if (h >= 1080) labelPrefix = `FHD ${h}p`;
        else if (h >= 720) labelPrefix = `HD ${h}p`;

        const suffixes = [];
        if (info.fps > 30) suffixes.push(`${info.fps}fps`);
        if (info.note && info.note.toUpperCase().includes('HDR')) suffixes.push('HDR');
        
        const finalLabel = suffixes.length > 0 ? `${labelPrefix} (${suffixes.join(' ')})` : labelPrefix;
        
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

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

    const payload = {
      action: 'sendToApp',
      url: tab.url,
      title: previewTitle.textContent,
      quality: qualitySelect.value,
      estimated_size: estimatedSize,
      subtitle_lang: subtitleSelect.value !== 'none' ? subtitleSelect.value : undefined,
      download_path: pathInput.value,
      thumbnail: previewThumb.src,
      metadata: lastMetadata, // Phase 54: Pass raw metadata to skip analysis
      instant: true
    };

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
