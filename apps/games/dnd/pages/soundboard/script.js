/* ===================================================================
   Arcane Soundboard Script
   =================================================================== */

'use strict';

// DOM Elements
const $ = id => document.getElementById(id);

// Pre-curated high-quality audio libraries (using stable MP3 files with open CORS on GitHub & Wikimedia)
const PRESET_AMBIENTS = [
    { name: "Epic Fantasy Theme", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { name: "Cozy Tavern Lute", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { name: "Crackling Campfire", url: "https://raw.githubusercontent.com/brarcher/baby-sleep-sounds/master/app/src/main/res/raw/campfire.mp3" },
    { name: "Gentle Rainpour", url: "https://raw.githubusercontent.com/brarcher/baby-sleep-sounds/master/app/src/main/res/raw/rain.mp3" },
    { name: "Raging Ocean Waves", url: "https://raw.githubusercontent.com/brarcher/baby-sleep-sounds/master/app/src/main/res/raw/ocean.mp3" },
    { name: "Winding Forest Stream", url: "https://raw.githubusercontent.com/brarcher/baby-sleep-sounds/master/app/src/main/res/raw/stream.mp3" },
    { name: "Rumble Train / Travel", url: "https://raw.githubusercontent.com/brarcher/baby-sleep-sounds/master/app/src/main/res/raw/train.mp3" }
];

const PRESET_SFX = [
    { name: "Sword Clash / Clang", url: "https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/china.mp3" },
    { name: "Explosion / Impact", url: "https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/crash.mp3" },
    { name: "Magic Zap / Spell", url: "https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/shot.mp3" },
    { name: "Glass Shatter", url: "https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/glass-shatter.mp3" },
    { name: "High Bell Ring", url: "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/bell.mp3" },
    { name: "Low UI Click", url: "https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/click-low.mp3" },
    { name: "High UI Click", url: "https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/click-high.mp3" },
    { name: "Beep Alert", url: "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/beep.mp3" },
    { name: "Ticking Clock", url: "https://raw.githubusercontent.com/brarcher/baby-sleep-sounds/master/app/src/main/res/raw/clock.mp3" },
    { name: "Thunder Strike", url: "https://upload.wikimedia.org/wikipedia/commons/1/15/Thunder_strike_1.mp3" },
    { name: "Alert Alert", url: "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/alert.mp3" },
    { name: "Success Chime", url: "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/success.mp3" },
    { name: "Thumping Heartbeat", url: "https://www.soundjay.com/human/heartbeat-01a.mp3" }
];

// Fallback Default Setup
const DEFAULT_AMBIENTS = [
    { id: "ch1", name: "Tavern Ambience", url: PRESET_AMBIENTS[1].url, volume: 0.6, playing: false },
    { id: "ch2", name: "Epic Theme", url: PRESET_AMBIENTS[0].url, volume: 0.5, playing: false },
    { id: "ch3", name: "Raging Storm", url: PRESET_AMBIENTS[3].url, volume: 0.4, playing: false },
    { id: "ch4", name: "Roaring Fireplace", url: PRESET_AMBIENTS[2].url, volume: 0.6, playing: false },
    { id: "ch5", name: "Winding Stream", url: PRESET_AMBIENTS[5].url, volume: 0.4, playing: false },
    { id: "ch6", name: "Ocean Waves", url: PRESET_AMBIENTS[4].url, volume: 0.3, playing: false }
];

const DEFAULT_SFX_PADS = [
    { id: "pad1", name: "Clash / Clang", url: PRESET_SFX[0].url, volume: 0.8, hotkey: "1" },
    { id: "pad2", name: "Magic Spell", url: PRESET_SFX[2].url, volume: 0.7, hotkey: "2" },
    { id: "pad3", name: "Explode", url: PRESET_SFX[1].url, volume: 0.6, hotkey: "3" },
    { id: "pad4", name: "Man Shout", url: PRESET_SFX[6].url, volume: 0.7, hotkey: "Q" },
    { id: "pad5", name: "Thunder Clap", url: PRESET_SFX[9].url, volume: 0.9, hotkey: "W" },
    { id: "pad6", name: "Monster Snarl", url: PRESET_SFX[8].url, volume: 0.7, hotkey: "E" },
    { id: "pad7", name: "Bell Ring", url: PRESET_SFX[4].url, volume: 0.6, hotkey: "A" },
    { id: "pad8", name: "Heartbeat", url: PRESET_SFX[12].url, volume: 0.8, hotkey: "S" },
    { id: "pad9", name: "Alert Beep", url: PRESET_SFX[10].url, volume: 0.6, hotkey: "D" },
    { id: "pad10", name: "Success Chime", url: PRESET_SFX[11].url, volume: 0.7, hotkey: "Z" },
    { id: "pad11", name: "Shatter", url: PRESET_SFX[3].url, volume: 0.6, hotkey: "X" },
    { id: "pad12", name: "Footsteps", url: PRESET_SFX[7].url, volume: 0.5, hotkey: "C" }
];

// STATE MANAGEMENT
const state = {
    user: null,
    isSandbox: false,
    masterVolume: 0.8,
    sfxMuted: false,
    hotkeysEnabled: true,
    channels: JSON.parse(JSON.stringify(DEFAULT_AMBIENTS)), // Deep copy
    sfxPads: JSON.parse(JSON.stringify(DEFAULT_SFX_PADS)),     // Deep copy
    savedScenes: [],
    selectedSceneId: null,
    
    // Audio engine nodes
    channelAudios: {}, // chId -> Audio element
    padAudios: {},     // padId -> Audio element
    
    // Active configuration modal slot
    editingSlotId: null, // "chX" or "padY"
    editingLocalFileUrl: null // temporary URL for files
};

// ==================== INITIALIZATION ====================

window.onload = async () => {
    // 1. Auth & Mode Check
    try {
        state.isSandbox = localStorage.getItem('kk_mode') === 'sandbox';
        if (typeof requireAuth === 'function') {
            state.user = await requireAuth();
        }
    } catch (e) {
        console.warn("Auth failed or sandbox active, proceeding as guest.");
        state.isSandbox = true;
    }

    // Initialize UI theme based on parent/local settings
    const theme = localStorage.getItem('theme_dnd') || 'dark';
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    }

    // Create Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Restore volume preferences from local storage if available
    const savedMasterVol = localStorage.getItem('dnd_sb_master_vol');
    if (savedMasterVol !== null) {
        state.masterVolume = parseFloat(savedMasterVol);
        $('master-volume').value = state.masterVolume;
        updateMasterVolLabel();
    }

    const savedSfxMute = localStorage.getItem('dnd_sb_sfx_mute');
    if (savedSfxMute === 'true') {
        state.sfxMuted = true;
        updateSfxMuteUI();
    }

    // 2. Initialize Audio Objects
    initAudioEngine();

    // 3. Render Slots & Panels
    renderAmbientChannels();
    renderSfxPads();

    // 4. Setup Global Event Listeners
    setupEventListeners();

    // 5. Load Scenes from Database
    await loadScenes();
};

// Create HTML5 Audio objects for each slot
function initAudioEngine() {
    // Ambient Channels
    state.channels.forEach(ch => {
        const audio = new Audio();
        audio.loop = true;
        audio.preload = "auto";
        audio.src = ch.url;
        audio.volume = ch.volume * state.masterVolume;
        
        // Listeners
        audio.addEventListener('error', (e) => {
            console.error(`Audio error on channel ${ch.id}:`, e);
            showChannelStatus(ch.id, 'error');
        });
        audio.addEventListener('waiting', () => showChannelStatus(ch.id, 'buffering'));
        audio.addEventListener('playing', () => showChannelStatus(ch.id, 'playing'));
        audio.addEventListener('pause', () => showChannelStatus(ch.id, 'paused'));

        state.channelAudios[ch.id] = audio;
    });

    // SFX Pads
    state.sfxPads.forEach(pad => {
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = pad.url;
        audio.volume = state.sfxMuted ? 0 : pad.volume * state.masterVolume;

        audio.addEventListener('error', (e) => {
            console.warn(`SFX Audio error on pad ${pad.id}:`, e);
        });

        state.padAudios[pad.id] = audio;
    });
}

// ==================== RENDERING FUNCTIONS ====================

// Build and insert ambient channels into the UI
function renderAmbientChannels() {
    const container = $('ambient-channels');
    container.innerHTML = '';

    state.channels.forEach(ch => {
        const isPlaying = ch.playing;
        const volumePercent = Math.round(ch.volume * 100);

        const card = document.createElement('div');
        card.id = `channel-card-${ch.id}`;
        card.className = `bg-stone-900 border-2 ${isPlaying ? 'border-amber-700 shadow-md' : 'border-stone-800'} rounded-xl p-4 flex flex-col gap-3 transition-all relative overflow-hidden group`;

        // Decorative background visual equalizer bar (animates when playing)
        const eqOverlay = document.createElement('div');
        eqOverlay.id = `channel-eq-${ch.id}`;
        eqOverlay.className = `absolute inset-y-0 left-0 bg-amber-500/[0.03] transition-all pointer-events-none ${isPlaying ? 'w-full animate-pulse-slow' : 'w-0'}`;
        card.appendChild(eqOverlay);

        card.innerHTML += `
            <div class="flex items-center justify-between z-10">
                <div class="flex items-center gap-2.5 truncate">
                    <button id="btn-play-ch-${ch.id}" onclick="toggleChannelPlay('${ch.id}')"
                        class="w-10 h-10 rounded-lg flex items-center justify-center border-2 border-stone-800 ${isPlaying ? 'bg-amber-600 border-amber-500 text-stone-950' : 'bg-stone-950 text-amber-500 hover:bg-stone-800'} transition-all active:translate-y-[2px]"
                        title="${isPlaying ? 'Pause' : 'Play'} loop">
                        <i data-lucide="${isPlaying ? 'pause' : 'play'}" class="w-4 h-4 fill-current"></i>
                    </button>
                    <div class="truncate">
                        <h4 class="font-cinzel font-bold text-xs text-amber-500/90 tracking-wide truncate" id="label-ch-name-${ch.id}">${ch.name}</h4>
                        <p class="text-[10px] text-stone-500 truncate" id="label-ch-source-${ch.id}" title="${ch.url}">${getFriendlySource(ch.url)}</p>
                    </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button onclick="openConfigModal('${ch.id}')" title="Configure audio slot"
                        class="p-1.5 bg-stone-950 border border-stone-800 text-stone-400 hover:text-amber-500 rounded hover:border-amber-900/50 transition-colors">
                        <i data-lucide="settings" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>

            <!-- Fader Slider Row -->
            <div class="flex items-center gap-3 z-10">
                <i data-lucide="${ch.volume === 0 ? 'volume-x' : 'volume-1'}" class="w-4 h-4 text-stone-500 shrink-0" id="icon-ch-vol-${ch.id}"></i>
                <input type="range" id="fader-ch-${ch.id}" min="0" max="1" step="0.01" value="${ch.volume}"
                    oninput="handleChannelFader('${ch.id}', this.value)"
                    class="flex-1 accent-amber-500 bg-stone-950 h-1 rounded-lg cursor-pointer">
                <span id="label-ch-vol-${ch.id}" class="text-[10px] font-bold font-cinzel text-stone-500 w-8 text-right shrink-0">${volumePercent}%</span>
            </div>
        `;

        container.appendChild(card);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Build and insert SFX pads into the UI grid
function renderSfxPads() {
    const container = $('sfx-pads-container');
    container.innerHTML = '';

    state.sfxPads.forEach(pad => {
        const btn = document.createElement('div');
        btn.id = `sfx-pad-btn-${pad.id}`;
        btn.className = "bg-stone-950 hover:bg-stone-900/60 border border-stone-800 hover:border-amber-900/40 rounded-xl p-3 flex flex-col items-center justify-between text-center transition-all cursor-pointer relative select-none hover:shadow-sm group h-24";
        btn.setAttribute('onclick', `triggerSfxPad('${pad.id}')`);

        // Right-click or long-press editing
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            openConfigModal(pad.id);
        });

        // Volume meter animation node
        const pulseBar = document.createElement('div');
        pulseBar.id = `sfx-pulse-${pad.id}`;
        pulseBar.className = "absolute inset-0 bg-amber-500/0 rounded-xl transition-all pointer-events-none duration-100 border border-transparent";
        btn.appendChild(pulseBar);

        btn.innerHTML += `
            <div class="w-full flex items-center justify-between text-stone-500 z-10">
                <!-- Mini cog overlay -->
                <button onclick="event.stopPropagation(); openConfigModal('${pad.id}')" 
                    class="p-1 hover:text-amber-500 bg-stone-900 rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Edit SFX">
                    <i data-lucide="settings" class="w-3 h-3"></i>
                </button>
                
                <!-- Hotkey indicator -->
                <span class="text-[9px] font-bold font-cinzel bg-stone-900 px-1 py-0.5 border border-stone-800 rounded tracking-wider ${state.hotkeysEnabled ? '' : 'hidden'}" id="hotkey-label-${pad.id}">
                    ${pad.hotkey ? pad.hotkey : 'NONE'}
                </span>
            </div>

            <div class="font-cinzel text-xs font-bold text-stone-400 group-hover:text-amber-500 leading-tight tracking-wide px-1 truncate w-full z-10" id="pad-name-label-${pad.id}" title="${pad.name}">
                ${pad.name}
            </div>

            <!-- Volume Slider Dot / Play Indicator -->
            <div class="text-[9px] font-cinzel text-stone-600 group-hover:text-stone-500 z-10 truncate w-full" id="pad-volume-indicator-${pad.id}">
                Vol: ${Math.round(pad.volume * 100)}%
            </div>
        `;

        container.appendChild(btn);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Get clean filename/friendly string from full URL
function getFriendlySource(url) {
    if (!url) return "Empty source";
    if (url.startsWith('blob:')) return "Local Audio File";
    try {
        const decoded = decodeURIComponent(url);
        const filename = decoded.substring(decoded.lastIndexOf('/') + 1).split('?')[0];
        if (filename.endsWith('.ogg') || filename.endsWith('.mp3') || filename.endsWith('.wav')) {
            return filename.replace(/_/g, ' ').replace(/\.[^/.]+$/, "");
        }
        return "Custom URL Stream";
    } catch (_) {
        return "Custom Link";
    }
}

// Show loading, playing, or error state visually on channel cards
function showChannelStatus(chId, status) {
    const card = $(`channel-card-${chId}`);
    const btn = $(`btn-play-ch-${chId}`);
    if (!card || !btn) return;

    if (status === 'playing') {
        card.classList.remove('opacity-60');
        btn.innerHTML = `<i data-lucide="pause" class="w-4 h-4 fill-current"></i>`;
    } else if (status === 'paused') {
        card.classList.remove('opacity-60');
        btn.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-current"></i>`;
    } else if (status === 'buffering') {
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-amber-500"></i>`;
    } else if (status === 'error') {
        card.classList.add('opacity-60');
        btn.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-red-500"></i>`;
        btn.classList.add('border-red-500');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==================== INTERACTION LOGIC ====================

// Toggle Play/Pause on an ambient channel
function toggleChannelPlay(chId) {
    const ch = state.channels.find(c => c.id === chId);
    const audio = state.channelAudios[chId];
    if (!ch || !audio) return;

    if (ch.playing) {
        // Pause loop
        audio.pause();
        ch.playing = false;
        $(`channel-eq-${chId}`).style.width = '0%';
        $(`channel-eq-${chId}`).classList.remove('animate-pulse-slow');
        $(`channel-card-${chId}`).classList.remove('border-amber-700');
        $(`channel-card-${chId}`).classList.add('border-stone-800');
    } else {
        // Start loop
        audio.src = ch.url; // Reload current src
        audio.volume = ch.volume * state.masterVolume;
        
        audio.play().then(() => {
            ch.playing = true;
            $(`channel-eq-${chId}`).style.width = '100%';
            $(`channel-eq-${chId}`).classList.add('animate-pulse-slow');
            $(`channel-card-${chId}`).classList.add('border-amber-700');
            $(`channel-card-${chId}`).classList.remove('border-stone-800');
        }).catch(err => {
            console.error("Audio playback failed:", err);
            showChannelStatus(chId, 'error');
        });
    }
}

// Handle slider changes on ambient channels
function handleChannelFader(chId, val) {
    const ch = state.channels.find(c => c.id === chId);
    const audio = state.channelAudios[chId];
    if (!ch || !audio) return;

    const volumeFloat = parseFloat(val);
    ch.volume = volumeFloat;
    audio.volume = volumeFloat * state.masterVolume;

    // Update label percentage
    $(`label-ch-vol-${chId}`).innerText = `${Math.round(volumeFloat * 100)}%`;

    // Dynamic icon toggle
    const volIcon = $(`icon-ch-vol-${chId}`);
    if (volIcon) {
        if (volumeFloat === 0) {
            volIcon.setAttribute('data-lucide', 'volume-x');
        } else if (volumeFloat < 0.5) {
            volIcon.setAttribute('data-lucide', 'volume-1');
        } else {
            volIcon.setAttribute('data-lucide', 'volume-2');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Trigger an SFX sound effect pad
function triggerSfxPad(padId) {
    const pad = state.sfxPads.find(p => p.id === padId);
    const audio = state.padAudios[padId];
    if (!pad || !audio) return;

    // Check if muted
    if (state.sfxMuted) return;

    // Playback SFX (cloned/reset so it restarts instantly on spam clicks)
    audio.pause();
    audio.currentTime = 0;
    audio.volume = pad.volume * state.masterVolume;

    // Visual trigger ripple effect on pad
    const pulseNode = $(`sfx-pulse-${padId}`);
    if (pulseNode) {
        pulseNode.classList.remove('bg-amber-500/0', 'border-transparent');
        pulseNode.classList.add('bg-amber-500/20', 'border-amber-500/50');
        
        setTimeout(() => {
            pulseNode.classList.remove('bg-amber-500/20', 'border-amber-500/50');
            pulseNode.classList.add('bg-amber-500/0', 'border-transparent');
        }, 150);
    }

    audio.play().catch(err => {
        console.warn("SFX play failed. Re-try or invalid URL:", err);
    });
}

// Master volume slider handler
function handleMasterVolume(val) {
    state.masterVolume = parseFloat(val);
    localStorage.setItem('dnd_sb_master_vol', state.masterVolume);
    updateMasterVolLabel();

    // Propagate to playing loop elements
    state.channels.forEach(ch => {
        const audio = state.channelAudios[ch.id];
        if (audio) {
            audio.volume = ch.volume * state.masterVolume;
        }
    });

    // Propagate to SFX audio elements
    state.sfxPads.forEach(pad => {
        const audio = state.padAudios[pad.id];
        if (audio) {
            audio.volume = state.sfxMuted ? 0 : pad.volume * state.masterVolume;
        }
    });
}

function updateMasterVolLabel() {
    $('master-vol-label').innerText = `${Math.round(state.masterVolume * 100)}%`;
}

// Panic: Stop All playing sounds
function handleStopAll() {
    // 1. Pause and reset ambient loops
    state.channels.forEach(ch => {
        if (ch.playing) {
            toggleChannelPlay(ch.id);
        }
    });

    // 2. Pause and reset SFX playbacks
    state.sfxPads.forEach(pad => {
        const audio = state.padAudios[pad.id];
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    });
}

// SFX mute toggle
function toggleSfxMute() {
    state.sfxMuted = !state.sfxMuted;
    localStorage.setItem('dnd_sb_sfx_mute', state.sfxMuted);
    updateSfxMuteUI();

    // Propagate SFX volumes
    state.sfxPads.forEach(pad => {
        const audio = state.padAudios[pad.id];
        if (audio) {
            audio.volume = state.sfxMuted ? 0 : pad.volume * state.masterVolume;
        }
    });
}

function updateSfxMuteUI() {
    const icon = $('sfx-mute-icon');
    const text = $('sfx-mute-text');
    const btn = $('btn-mute-sfx');

    if (state.sfxMuted) {
        icon.setAttribute('data-lucide', 'bell-off');
        text.innerText = "UNMUTE SFX";
        btn.classList.add('bg-red-950/40', 'border-red-900', 'text-red-400');
        btn.classList.remove('bg-stone-800', 'border-stone-700', 'text-stone-300');
    } else {
        icon.setAttribute('data-lucide', 'bell-ring');
        text.innerText = "MUTE SFX";
        btn.classList.remove('bg-red-950/40', 'border-red-900', 'text-red-400');
        btn.classList.add('bg-stone-800', 'border-stone-700', 'text-stone-300');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==================== CONFIGURATION MODAL (EDIT SLOTS) ====================

function openConfigModal(slotId) {
    state.editingSlotId = slotId;
    const isChannel = slotId.startsWith('ch');
    const modal = $('config-modal');
    const modalPanel = $('config-modal-panel');

    // Reset local upload URL
    state.editingLocalFileUrl = null;
    $('file-upload-label').innerText = "Choose File (max 10MB)";
    $('btn-clear-file').classList.add('hidden');
    $('upload-status-text').innerText = '';
    $('config-file').value = '';

    // Render presets list in modal dropdown
    const presetSelect = $('config-preset-select');
    presetSelect.innerHTML = '<option value="">-- Choose Preset or Keep Custom --</option>';
    const library = isChannel ? PRESET_AMBIENTS : PRESET_SFX;
    library.forEach((item, index) => {
        presetSelect.innerHTML += `<option value="${index}">${item.name}</option>`;
    });

    if (isChannel) {
        // Channel slot setup
        const ch = state.channels.find(c => c.id === slotId);
        $('modal-slot-desc').innerText = `Configure ambient channel loops (${slotId.toUpperCase()})`;
        $('config-name').value = ch.name;
        $('config-url').value = ch.url.startsWith('blob:') ? '' : ch.url;
        $('config-hotkey-container').classList.add('hidden');
    } else {
        // SFX pad setup
        const pad = state.sfxPads.find(p => p.id === slotId);
        $('modal-slot-desc').innerText = `Configure SFX button trigger (${slotId.toUpperCase()})`;
        $('config-name').value = pad.name;
        $('config-url').value = pad.url.startsWith('blob:') ? '' : pad.url;
        $('config-hotkey-container').classList.remove('hidden');
        $('config-hotkey').value = pad.hotkey || '';
    }

    // Modal Animations
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modalPanel.classList.remove('scale-95');
    modalPanel.classList.add('scale-100');
}

function closeConfigModal() {
    const modal = $('config-modal');
    const modalPanel = $('config-modal-panel');

    modal.classList.add('opacity-0', 'pointer-events-none');
    modalPanel.classList.remove('scale-100');
    modalPanel.classList.add('scale-95');

    state.editingSlotId = null;
}

// Preset selection handler inside modal
function handleModalPresetChange(e) {
    const isChannel = state.editingSlotId.startsWith('ch');
    const index = parseInt(e.target.value);
    if (isNaN(index)) return;

    const library = isChannel ? PRESET_AMBIENTS : PRESET_SFX;
    const selected = library[index];
    if (selected) {
        $('config-name').value = selected.name;
        $('config-url').value = selected.url;
    }
}

// Local File Upload Reader (Object URL load helper)
function handleLocalAudioFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Check size limit: 10MB
    const limit = 10 * 1024 * 1024;
    if (file.size > limit) {
        $('upload-status-text').innerHTML = `<span class="text-red-500">File is too large (${Math.round(file.size / (1024*1024))}MB). Maximum size is 10MB.</span>`;
        e.target.value = '';
        return;
    }

    // Success
    state.editingLocalFileUrl = URL.createObjectURL(file);
    $('file-upload-label').innerText = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    $('btn-clear-file').classList.remove('hidden');
    $('upload-status-text').innerHTML = `<span class="text-green-500">Local audio parsed successfully. Ready to apply!</span>`;

    // Overwrite fields
    $('config-name').value = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
    $('config-url').value = ''; // Wipe URL input when local file is loaded
}

function clearUploadedFile() {
    state.editingLocalFileUrl = null;
    $('file-upload-label').innerText = "Choose File (max 10MB)";
    $('btn-clear-file').classList.add('hidden');
    $('upload-status-text').innerText = '';
    $('config-file').value = '';
}

// Apply settings from configuration modal
function handleApplyConfig() {
    const slotId = state.editingSlotId;
    const name = $('config-name').value.trim() || `Untitled ${slotId.toUpperCase()}`;
    const hotkey = $('config-hotkey').value.trim().toUpperCase() || null;
    
    // Choose which URL to apply: local blob or raw input URL
    let url = state.editingLocalFileUrl || $('config-url').value.trim();

    if (!url) {
        // Fallback placeholder
        url = slotId.startsWith('ch') ? PRESET_AMBIENTS[0].url : PRESET_SFX[0].url;
    }

    if (slotId.startsWith('ch')) {
        // Apply to Ambient Channel
        const ch = state.channels.find(c => c.id === slotId);
        const audio = state.channelAudios[slotId];
        if (ch && audio) {
            const wasPlaying = ch.playing;
            if (wasPlaying) {
                audio.pause();
            }

            ch.name = name;
            ch.url = url;
            audio.src = url;

            if (wasPlaying) {
                audio.play().catch(e => {
                    console.error("Auto-resume failed:", e);
                    ch.playing = false;
                    showChannelStatus(slotId, 'error');
                });
            } else {
                showChannelStatus(slotId, 'paused');
            }

            // Update UI elements directly to avoid full rerender (which interrupts playing loops!)
            $(`label-ch-name-${slotId}`).innerText = name;
            $(`label-ch-source-${slotId}`).innerText = getFriendlySource(url);
            $(`label-ch-source-${slotId}`).title = url;
        }
    } else {
        // Apply to SFX Pad
        const pad = state.sfxPads.find(p => p.id === slotId);
        const audio = state.padAudios[slotId];
        if (pad && audio) {
            pad.name = name;
            pad.url = url;
            pad.hotkey = hotkey;
            audio.src = url;

            // Direct UI updates
            $(`pad-name-label-${slotId}`).innerText = name;
            $(`pad-name-label-${slotId}`).title = name;
            $(`hotkey-label-${slotId}`).innerText = hotkey ? hotkey : 'NONE';
        }
    }

    closeConfigModal();
}

// ==================== KEYBOARD HOTKEYS ====================

function handleKeyDown(e) {
    if (!state.hotkeysEnabled) return;

    // Skip if any text input / textarea is focused
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
        return;
    }

    const key = e.key.toUpperCase();
    const matchedPad = state.sfxPads.find(p => p.hotkey === key);
    if (matchedPad) {
        e.preventDefault();
        triggerSfxPad(matchedPad.id);
    }
}

// ==================== EVENT LISTENERS & BINDINGS ====================

function setupEventListeners() {
    // Top bar actions
    $('btn-stop-all').addEventListener('click', handleStopAll);
    $('btn-mute-sfx').addEventListener('click', toggleSfxMute);
    $('master-volume').addEventListener('input', (e) => handleMasterVolume(e.target.value));

    // Saved Scenes Buttons
    $('btn-save-scene').addEventListener('click', handleSaveScene);
    $('btn-delete-scene').addEventListener('click', handleDeleteScene);
    $('scene-select').addEventListener('change', handleSelectSceneChange);

    // Modal bindings
    $('modal-close').addEventListener('click', closeConfigModal);
    $('config-cancel').addEventListener('click', closeConfigModal);
    $('config-save').addEventListener('click', handleApplyConfig);
    $('config-preset-select').addEventListener('change', handleModalPresetChange);
    $('config-file').addEventListener('change', handleLocalAudioFile);
    $('btn-clear-file').addEventListener('click', clearUploadedFile);

    // Toggle hotkeys checkbox
    $('toggle-hotkeys').addEventListener('change', (e) => {
        state.hotkeysEnabled = e.target.checked;
        state.sfxPads.forEach(pad => {
            const label = $(`hotkey-label-${pad.id}`);
            if (label) {
                if (state.hotkeysEnabled) {
                    label.classList.remove('hidden');
                } else {
                    label.classList.add('hidden');
                }
            }
        });
    });

    // Keyboard global shortcuts
    window.addEventListener('keydown', handleKeyDown);
}

// ==================== SCENES DATABASE STORAGE (SUPABASE & LOCAL) ====================

// Load all saved scenes from Supabase (or localStorage in sandbox)
async function loadScenes() {
    setSyncStatus('loading', 'Loading saved scenes...');

    let scenes = [];
    if (state.isSandbox || !state.user) {
        // Load locally
        try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith('dnd_soundboard_local_'));
            scenes = keys.map(key => JSON.parse(localStorage.getItem(key)));
        } catch (e) {
            console.warn("Could not load local scenes", e);
        }
    } else {
        // Load from cloud database
        if (typeof loadDndSaves === 'function') {
            try {
                const rows = await loadDndSaves('soundboard');
                scenes = rows.map(r => ({
                    id: r.id,
                    name: r.name,
                    state_data: typeof r.state_data === 'string' ? JSON.parse(r.state_data) : r.state_data
                }));
            } catch (err) {
                console.error("Failed to load soundscapes from Supabase:", err);
                setSyncStatus('error', 'Sync failed. Local fallback active.');
                return;
            }
        }
    }

    state.savedScenes = scenes;
    updateSceneDropdown();

    // Setup visual status
    if (state.isSandbox || !state.user) {
        setSyncStatus('local', 'Offline Sandbox. Local storage active.');
    } else {
        setSyncStatus('success', 'Synced with Arcane Cloud');
    }
}

// Save current active config as a scene
async function handleSaveScene() {
    if (typeof inputModal === 'undefined') {
        // Fallback standard prompt if inputModal component not ready
        const name = prompt("Enter a name for this Soundscape Scene:");
        if (name) applySaveScene(name);
    } else {
        inputModal.show({
            title: "Save Soundscape Scene",
            description: "Save active volumes, loops, and hotkey pads. Pasted links sync, while local custom upload links remain local to this device.",
            placeholder: "e.g. Haunted Woods",
            confirmText: "SAVE SCENE",
            onConfirm: (name) => {
                if (name.trim()) applySaveScene(name.trim());
            }
        });
    }
}

async function applySaveScene(name) {
    setSyncStatus('saving', `Saving scene "${name}"...`);

    // Compile payload
    const activeSetup = {
        masterVolume: state.masterVolume,
        sfxMuted: state.sfxMuted,
        channels: state.channels.map(ch => ({
            id: ch.id,
            name: ch.name,
            url: ch.url.startsWith('blob:') ? '' : ch.url, // Don't persist temporary object URLs to cloud
            volume: ch.volume
        })),
        sfxPads: state.sfxPads.map(pad => ({
            id: pad.id,
            name: pad.name,
            url: pad.url.startsWith('blob:') ? '' : pad.url,
            volume: pad.volume,
            hotkey: pad.hotkey
        }))
    };

    let id = state.selectedSceneId;
    // If saving under a new name, force a new insert
    const isNewName = !state.savedScenes.some(s => s.id === id && s.name === name);
    if (isNewName) {
        id = null;
    }

    if (state.isSandbox || !state.user) {
        // Save to LocalStorage
        const localId = id || `local_${Date.now()}`;
        const sceneRecord = { id: localId, name, state_data: activeSetup };
        localStorage.setItem(`dnd_soundboard_local_${localId}`, JSON.stringify(sceneRecord));
        state.selectedSceneId = localId;
    } else {
        // Save to Supabase Cloud
        if (typeof saveDndSave === 'function') {
            const res = await saveDndSave('soundboard', name, activeSetup, id);
            if (res.error) {
                console.error("Cloud save failed:", res.error);
                setSyncStatus('error', 'Cloud save failed.');
                return;
            }
            state.selectedSceneId = res.id;
        }
    }

    // Reload scenes
    await loadScenes();
}

// Delete selected scene
async function handleDeleteScene() {
    const sceneId = state.selectedSceneId;
    if (!sceneId) return;

    if (!confirm("Are you sure you want to delete this soundscape scene?")) return;

    setSyncStatus('saving', 'Deleting scene...');

    if (state.isSandbox || !state.user) {
        localStorage.removeItem(`dnd_soundboard_local_${sceneId}`);
    } else {
        if (typeof deleteDndSave === 'function') {
            await deleteDndSave(sceneId);
        }
    }

    state.selectedSceneId = null;
    await loadScenes();
    
    // Wipe selector
    $('scene-select').value = '';
}

// Load chosen scene into mixer state
function handleSelectSceneChange(e) {
    const sceneId = e.target.value;
    state.selectedSceneId = sceneId ? sceneId : null;

    if (!sceneId) return;

    const record = state.savedScenes.find(s => s.id === sceneId);
    if (!record) return;

    const data = record.state_data;
    if (!data) return;

    // Halt all first
    handleStopAll();

    // Restore master volume
    if (data.masterVolume !== undefined) {
        state.masterVolume = data.masterVolume;
        $('master-volume').value = state.masterVolume;
        updateMasterVolLabel();
    }

    if (data.sfxMuted !== undefined) {
        state.sfxMuted = data.sfxMuted;
        updateSfxMuteUI();
    }

    // Restore channels
    if (Array.isArray(data.channels)) {
        data.channels.forEach(savedCh => {
            const ch = state.channels.find(c => c.id === savedCh.id);
            const audio = state.channelAudios[savedCh.id];
            if (ch && audio) {
                ch.name = savedCh.name;
                // If url saved is empty (i.e. was a local file), keep its previous url to avoid blanking
                if (savedCh.url) {
                    ch.url = savedCh.url;
                }
                ch.volume = savedCh.volume;
                
                audio.src = ch.url;
                audio.volume = ch.volume * state.masterVolume;
            }
        });
    }

    // Restore SFX pads
    if (Array.isArray(data.sfxPads)) {
        data.sfxPads.forEach(savedPad => {
            const pad = state.sfxPads.find(p => p.id === savedPad.id);
            const audio = state.padAudios[savedPad.id];
            if (pad && audio) {
                pad.name = savedPad.name;
                if (savedPad.url) {
                    pad.url = savedPad.url;
                }
                pad.volume = savedPad.volume;
                pad.hotkey = savedPad.hotkey;
                
                audio.src = pad.url;
                audio.volume = state.sfxMuted ? 0 : pad.volume * state.masterVolume;
            }
        });
    }

    // Rerender slots UI
    renderAmbientChannels();
    renderSfxPads();
}

// Update the list of scenes in the dropdown menu
function updateSceneDropdown() {
    const select = $('scene-select');
    select.innerHTML = '<option value="">-- Choose a Saved Scene --</option>';

    // Sort by name
    state.savedScenes.sort((a, b) => a.name.localeCompare(b.name));

    state.savedScenes.forEach(s => {
        const selectedAttr = s.id === state.selectedSceneId ? 'selected' : '';
        select.innerHTML += `<option value="${s.id}" ${selectedAttr}>${s.name}</option>`;
    });
}

// Helper to set cloud connection labels
function setSyncStatus(type, msg) {
    const textNode = $('sync-status-text');
    const icon = $('sync-cloud-icon');
    if (!textNode || !icon) return;

    textNode.innerText = msg;
    icon.setAttribute('class', "w-3.5 h-3.5 shrink-0");

    if (type === 'loading') {
        icon.classList.add('text-stone-500', 'animate-pulse');
        icon.setAttribute('data-lucide', 'cloud-lightning');
    } else if (type === 'saving') {
        icon.classList.add('text-amber-500', 'animate-spin');
        icon.setAttribute('data-lucide', 'refresh-cw');
    } else if (type === 'success') {
        icon.classList.add('text-green-500');
        icon.setAttribute('data-lucide', 'cloud');
    } else if (type === 'local') {
        icon.classList.add('text-stone-500');
        icon.setAttribute('data-lucide', 'database');
    } else {
        icon.classList.add('text-red-500');
        icon.setAttribute('data-lucide', 'cloud-off');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}
