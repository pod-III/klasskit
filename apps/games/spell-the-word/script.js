/* ============================================
   SPELL IT - Phonics Spelling Engine
   KlassKit 1.9.1 Modular Script
   ============================================ */

(function () {
    'use strict';

    var THEME_KEY = 'theme_spell-the-word';
    var REACH_KEY = 'spellingReachMode';
    var WORDS_KEY = 'spellingWordList';
    var PREFS_KEY = 'kk_spell_prefs_v2';
    var DEFAULT_WORDS = ['ENGLISH', 'KLASSKIT', 'CODING'];

    var IS_PLAYER_WINDOW = new URLSearchParams(window.location ? window.location.search : '').has('player');

    var state = {
        wordList: DEFAULT_WORDS.slice(),
        currentWordIndex: 0,
        targetWord: '',
        letterTiles: [],
        placedLetters: [],
        wrongMask: [],
        wrongTimer: null,
        wrongPulse: false,
        isReachMode: false,
        sfxEnabled: true,
        streak: 0,
        pendingFeedbackAction: 'close',
        pendingConfirmFn: null,
        syncTimeout: null,
        toastTimer: null,
        bcThrottleTimer: null,
        bcLastSent: 0,
        playerRetryInterval: null,
        audioCache: new Map(),
        sm: {
            activeId: null,
            activeName: null,
            db: null,
            setsCache: []
        }
    };

    var bc = typeof window.BroadcastChannel === 'function'
        ? new window.BroadcastChannel('spell-the-word-sync')
        : null;

    // --- Safe Helpers ---
    function $(id) {
        return document.getElementById(id);
    }

    function escapeHTML(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function setSlotIcon(slotId, iconName, iconClass) {
        var slot = $(slotId);
        if (!slot) return;
        slot.innerHTML = '<i data-lucide="' + escapeHTML(iconName) + '" class="' + escapeHTML(iconClass || 'w-4 h-4') + '"></i>';
        refreshIcons();
    }

    function showToast(message, iconName) {
        var banner = $('toastBanner');
        var textEl = $('toastText');
        if (!banner || !textEl) return;

        textEl.textContent = message;
        setSlotIcon('toastIconSlot', iconName || 'info', 'w-4 h-4 text-blue');

        banner.classList.add('open');
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(function () {
            banner.classList.remove('open');
        }, 2400);
    }

    // --- Web Audio Feedback ---
    var Sfx = {
        ctx: null,
        play: function (kind) {
            if (!state.sfxEnabled || IS_PLAYER_WINDOW) return;
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            try {
                if (!this.ctx) this.ctx = new AudioCtx();
                if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
                    this.ctx.resume().catch(function () {});
                }
                var now = this.ctx.currentTime;
                var osc = this.ctx.createOscillator();
                var gain = this.ctx.createGain();

                if (kind === 'win') {
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(523.25, now);
                    osc.frequency.setValueAtTime(659.25, now + 0.08);
                    osc.frequency.setValueAtTime(783.99, now + 0.16);
                    gain.gain.setValueAtTime(0.14, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.35);
                } else if (kind === 'error') {
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(220, now);
                    osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.24);
                } else {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(kind === 'remove' ? 380 : 520, now);
                    osc.frequency.exponentialRampToValueAtTime(kind === 'remove' ? 280 : 680, now + 0.08);
                    gain.gain.setValueAtTime(0.09, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.1);
                }
            } catch (e) {}
        }
    };

    // --- Pronunciation Audio (Dictionary API + TTS Fallback) ---
    function speakWithTTS(word) {
        if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
            showToast('Audio unavailable on this browser', 'volume-x');
            return;
        }
        try {
            window.speechSynthesis.cancel();
            var utter = new window.SpeechSynthesisUtterance(word);
            utter.lang = 'en-US';
            utter.rate = 0.88;
            window.speechSynthesis.speak(utter);
        } catch (e) {
            showToast('Audio unavailable on this browser', 'volume-x');
        }
    }

    async function playTargetWordAudio() {
        var word = String(state.targetWord || '').trim();
        if (!word) return;
        var key = word.toLowerCase();

        if (state.audioCache.has(key)) {
            var cachedUrl = state.audioCache.get(key);
            if (cachedUrl && typeof window.Audio === 'function') {
                try {
                    await new window.Audio(cachedUrl).play();
                    return;
                } catch (e) {}
            }
            speakWithTTS(word);
            return;
        }

        try {
            var res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(key));
            if (res && res.ok) {
                var data = await res.json();
                var audioUrl = '';
                if (Array.isArray(data) && data[0] && Array.isArray(data[0].phonetics)) {
                    for (var i = 0; i < data[0].phonetics.length; i++) {
                        if (data[0].phonetics[i] && data[0].phonetics[i].audio) {
                            audioUrl = data[0].phonetics[i].audio;
                            break;
                        }
                    }
                }
                state.audioCache.set(key, audioUrl);
                if (audioUrl && typeof window.Audio === 'function') {
                    await new window.Audio(audioUrl).play();
                    return;
                }
            } else {
                state.audioCache.set(key, '');
            }
        } catch (e) {
            state.audioCache.set(key, '');
        }

        speakWithTTS(word);
    }

    // --- Persistence & Theme ---
    function saveToCloud() {
        if (IS_PLAYER_WINDOW) return;
        try {
            localStorage.setItem(WORDS_KEY, JSON.stringify(state.wordList));
            localStorage.setItem(REACH_KEY, String(state.isReachMode));
            localStorage.setItem(THEME_KEY, document.documentElement.classList.contains('dark') ? 'dark' : 'light');
            localStorage.setItem(PREFS_KEY, JSON.stringify({ sfxEnabled: state.sfxEnabled }));
        } catch (e) {}

        if (state.syncTimeout) clearTimeout(state.syncTimeout);
        state.syncTimeout = setTimeout(function () {
            if (typeof window.saveProgress === 'function') {
                window.saveProgress('spell_word', {
                    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                    reachMode: state.isReachMode,
                    wordList: state.wordList
                });
            }
        }, 1000);
    }

    function syncThemeIcon() {
        var isDark = document.documentElement.classList.contains('dark');
        setSlotIcon('themeToggleIconSlot', isDark ? 'sun' : 'moon', 'w-4 h-4');
    }

    function toggleDarkMode() {
        var isDark = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', isDark);
        syncThemeIcon();
        saveToCloud();
        broadcastState({ immediate: true });
    }

    function applyReachMode() {
        var wrapper = $('mainWrapper');
        if (wrapper) {
            wrapper.classList.toggle('reach-active', state.isReachMode);
        }
        setSlotIcon('reachIconSlot', state.isReachMode ? 'arrow-up' : 'arrow-down', 'w-4 h-4');
    }

    function toggleReachMode() {
        state.isReachMode = !state.isReachMode;
        applyReachMode();
        saveToCloud();
        broadcastState({ immediate: true });
    }

    function syncSfxUI() {
        setSlotIcon('sfxIconSlot', state.sfxEnabled ? 'volume-2' : 'volume-x', state.sfxEnabled ? 'w-4 h-4 text-green' : 'w-4 h-4 text-slate-400');
    }

    function toggleSfx() {
        state.sfxEnabled = !state.sfxEnabled;
        syncSfxUI();
        saveToCloud();
    }

    function updateStreakUI() {
        if ($('streakCount')) $('streakCount').textContent = String(state.streak);
    }

    // --- Word & Tile Arena ---
    function loadCurrentWord() {
        if (!Array.isArray(state.wordList) || state.wordList.length === 0) {
            state.wordList = DEFAULT_WORDS.slice();
        }
        if (state.currentWordIndex < 0 || state.currentWordIndex >= state.wordList.length) {
            state.currentWordIndex = 0;
        }

        state.targetWord = String(state.wordList[state.currentWordIndex]).toUpperCase();
        var progressText = 'Word ' + (state.currentWordIndex + 1) + ' of ' + state.wordList.length;
        if ($('progressBadge')) $('progressBadge').textContent = progressText;
        if ($('mobileProgressBadge')) {
            $('mobileProgressBadge').textContent = (state.currentWordIndex + 1) + ' / ' + state.wordList.length;
        }

        var chars = buildScrambledChars(state.targetWord);
        state.letterTiles = chars.map(function (ch, idx) {
            return { id: 'tile-' + idx, char: ch, isPlaced: false };
        });
        state.placedLetters = new Array(state.targetWord.length).fill(null);
        state.wrongMask = [];
        clearTimeout(state.wrongTimer);

        renderBoard(null);
    }

    function buildScrambledChars(word) {
        var chars = word.split('');
        var uniqueCount = new Set(chars).size;
        for (var attempt = 0; attempt < 6; attempt++) {
            for (var i = chars.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var tmp = chars[i];
                chars[i] = chars[j];
                chars[j] = tmp;
            }
            if (uniqueCount <= 1 || chars.join('') !== word) break;
        }
        return chars;
    }

    function createTileElement(tile, inSlot, shouldAnimate, isCompact, slotIdx, isWrong) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'letter-tile ' + (inSlot ? 'in-slot' : 'in-pool') +
            (isCompact ? ' is-compact' : '') +
            (shouldAnimate ? ' is-popping' : '') +
            (isWrong ? ' is-wrong-tile' : '');
        btn.textContent = tile.char;
        btn.setAttribute('aria-label', (inSlot ? 'Remove letter ' : 'Place letter ') + tile.char);
        if (inSlot) {
            btn.onclick = function () { handleSlotClick(slotIdx); };
        } else {
            btn.onclick = function () { handleLetterClick(tile.id); };
        }
        return btn;
    }

    function renderBoard(animateTileId) {
        var slotsContainer = $('slotsContainer');
        var lettersContainer = $('lettersContainer');
        if (!slotsContainer || !lettersContainer) return;

        var isCompact = state.targetWord.length >= 9;

        slotsContainer.innerHTML = '';
        state.placedLetters.forEach(function (tileId, index) {
            var slotDiv = document.createElement('div');
            slotDiv.className = 'letter-slot' + (tileId ? ' is-filled' : '') + (isCompact ? ' is-compact' : '');

            if (tileId) {
                var tile = state.letterTiles.find(function (t) { return t.id === tileId; });
                if (tile) {
                    var isWrong = Boolean(state.wrongMask[index]);
                    slotDiv.appendChild(createTileElement(tile, true, tileId === animateTileId, isCompact, index, isWrong));
                }
            }
            slotsContainer.appendChild(slotDiv);
        });

        lettersContainer.innerHTML = '';
        state.letterTiles.forEach(function (tile) {
            if (!tile.isPlaced) {
                lettersContainer.appendChild(createTileElement(tile, false, tile.id === animateTileId, isCompact, -1, false));
            }
        });

        setTimeout(function () { broadcastState(); }, 0);
    }

    function handleLetterClick(tileId) {
        if (IS_PLAYER_WINDOW) return;
        var emptyIdx = state.placedLetters.indexOf(null);
        if (emptyIdx === -1) return;

        var tile = state.letterTiles.find(function (t) { return t.id === tileId; });
        if (!tile || tile.isPlaced) return;

        state.wrongMask = [];
        clearTimeout(state.wrongTimer);
        state.placedLetters[emptyIdx] = tileId;
        tile.isPlaced = true;
        Sfx.play('place');
        renderBoard(tileId);
        checkWin();
    }

    function handleSlotClick(slotIdx) {
        if (IS_PLAYER_WINDOW) return;
        var tileId = state.placedLetters[slotIdx];
        if (!tileId) return;

        state.wrongMask = [];
        clearTimeout(state.wrongTimer);
        state.placedLetters[slotIdx] = null;
        var tile = state.letterTiles.find(function (t) { return t.id === tileId; });
        if (tile) tile.isPlaced = false;
        Sfx.play('remove');
        renderBoard(tileId);
    }

    function clearSlots() {
        if (IS_PLAYER_WINDOW) return;
        state.wrongMask = [];
        clearTimeout(state.wrongTimer);
        state.placedLetters = new Array(state.targetWord.length).fill(null);
        state.letterTiles.forEach(function (t) { t.isPlaced = false; });
        renderBoard(null);
    }

    function shufflePool() {
        if (IS_PLAYER_WINDOW) return;
        var unplaced = state.letterTiles.filter(function (t) { return !t.isPlaced; });
        for (var i = unplaced.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = unplaced[i];
            unplaced[i] = unplaced[j];
            unplaced[j] = tmp;
        }
        var placed = state.letterTiles.filter(function (t) { return t.isPlaced; });
        state.letterTiles = placed.concat(unplaced);
        renderBoard(null);
    }

    function useHint() {
        if (IS_PLAYER_WINDOW) return;
        // Find first slot that is empty OR holds the wrong letter
        var slotIdx = -1;
        for (var i = 0; i < state.targetWord.length; i++) {
            var curTileId = state.placedLetters[i];
            var curTile = curTileId ? state.letterTiles.find(function (t) { return t.id === curTileId; }) : null;
            if (!curTile || curTile.char !== state.targetWord[i]) {
                slotIdx = i;
                break;
            }
        }
        if (slotIdx === -1) return;

        var neededChar = state.targetWord[slotIdx];
        // If current slot has a wrong tile, return it to pool first
        if (state.placedLetters[slotIdx]) {
            var wrongTile = state.letterTiles.find(function (t) { return t.id === state.placedLetters[slotIdx]; });
            if (wrongTile) wrongTile.isPlaced = false;
            state.placedLetters[slotIdx] = null;
        }

        // Find matching tile in pool, or pull from a later wrong slot
        var candidate = state.letterTiles.find(function (t) { return !t.isPlaced && t.char === neededChar; });
        if (!candidate) {
            for (var k = slotIdx + 1; k < state.placedLetters.length; k++) {
                var tid = state.placedLetters[k];
                var t = tid ? state.letterTiles.find(function (x) { return x.id === tid; }) : null;
                if (t && t.char === neededChar && t.char !== state.targetWord[k]) {
                    state.placedLetters[k] = null;
                    t.isPlaced = false;
                    candidate = t;
                    break;
                }
            }
        }
        if (!candidate) return;

        state.placedLetters[slotIdx] = candidate.id;
        candidate.isPlaced = true;
        Sfx.play('place');
        renderBoard(candidate.id);
        checkWin();
    }

    function prevWord() {
        if (IS_PLAYER_WINDOW || state.wordList.length === 0) return;
        state.currentWordIndex = (state.currentWordIndex - 1 + state.wordList.length) % state.wordList.length;
        loadCurrentWord();
    }

    function nextWord() {
        if (IS_PLAYER_WINDOW || state.wordList.length === 0) return;
        state.currentWordIndex = (state.currentWordIndex + 1) % state.wordList.length;
        loadCurrentWord();
    }

    function checkWin() {
        if (state.placedLetters.indexOf(null) !== -1) return;

        var spelledWord = state.placedLetters.map(function (id) {
            var tile = state.letterTiles.find(function (t) { return t.id === id; });
            return tile ? tile.char : '';
        }).join('');

        if (spelledWord === state.targetWord) {
            state.streak += 1;
            updateStreakUI();
            Sfx.play('win');

            if (state.currentWordIndex < state.wordList.length - 1) {
                openFeedbackModal('Awesome!', 'You spelled "' + state.targetWord + '" right!', true, 'next');
            } else {
                openFeedbackModal('Level Complete!', 'You spelled all ' + state.wordList.length + ' words perfectly!', true, 'finish');
            }
        } else {
            state.streak = 0;
            updateStreakUI();
            Sfx.play('error');

            state.wrongMask = state.placedLetters.map(function (id, idx) {
                var tile = state.letterTiles.find(function (t) { return t.id === id; });
                return !tile || tile.char !== state.targetWord[idx];
            });
            state.wrongPulse = true;

            var board = $('gameBoard');
            if (board) {
                board.classList.remove('board-shake');
                void board.offsetWidth;
                board.classList.add('board-shake');
                setTimeout(function () {
                    board.classList.remove('board-shake');
                }, 420);
            }

            renderBoard(null);
            broadcastState({ immediate: true });
            showToast('Almost! Tap any highlighted tile to swap it.', 'triangle-alert');

            clearTimeout(state.wrongTimer);
            state.wrongTimer = setTimeout(function () {
                state.wrongMask = [];
                renderBoard(null);
            }, 1100);
        }
    }

    // --- Feedback & Confirm Modals ---
    function openFeedbackModal(title, message, isSuccess, actionType) {
        state.pendingFeedbackAction = actionType || 'close';
        if ($('feedbackTitle')) $('feedbackTitle').textContent = title;
        if ($('feedbackMessage')) $('feedbackMessage').textContent = message;

        var badge = $('feedbackBadge');
        var btn = $('feedbackActionBtn');
        var iconSlot = $('feedbackIconSlot');

        if (isSuccess) {
            if (iconSlot) {
                iconSlot.className = 'w-16 h-16 rounded-2xl bg-green text-white border-3 border-dark dark:border-slate-500 shadow-hard-md mx-auto flex items-center justify-center mb-3';
                setSlotIcon('feedbackIconSlot', 'circle-check', 'w-8 h-8');
            }
            if (badge) {
                badge.textContent = actionType === 'finish' ? 'Set Complete' : 'Streak x' + state.streak;
                badge.className = 'sticker -rotate-2 bg-orange text-white px-3 py-1 rounded-full text-xs uppercase mb-2';
            }
            if (btn) {
                btn.className = 'btn-chunky bg-green text-white rounded-xl px-6 py-3 text-base w-full';
                btn.textContent = actionType === 'finish' ? 'Play Again' : 'Next Word';
            }
        } else {
            if (iconSlot) {
                iconSlot.className = 'w-16 h-16 rounded-2xl bg-pink text-white border-3 border-dark dark:border-slate-500 shadow-hard-md mx-auto flex items-center justify-center mb-3';
                setSlotIcon('feedbackIconSlot', 'triangle-alert', 'w-8 h-8');
            }
            if (badge) {
                badge.textContent = 'Try Again';
                badge.className = 'sticker rotate-2 bg-pink text-white px-3 py-1 rounded-full text-xs uppercase mb-2';
            }
            if (btn) {
                btn.className = 'btn-chunky bg-blue text-white rounded-xl px-6 py-3 text-base w-full';
                btn.textContent = 'Keep Trying';
            }
        }

        if ($('feedbackModal')) $('feedbackModal').classList.add('open');
    }

    function handleFeedbackAction() {
        var action = state.pendingFeedbackAction;
        if ($('feedbackModal')) $('feedbackModal').classList.remove('open');

        if (action === 'next') {
            state.currentWordIndex += 1;
            loadCurrentWord();
        } else if (action === 'finish') {
            state.currentWordIndex = 0;
            loadCurrentWord();
        }
    }

    function openConfirmModal(title, message, onConfirm) {
        state.pendingConfirmFn = typeof onConfirm === 'function' ? onConfirm : null;
        if ($('confirmTitle')) $('confirmTitle').textContent = title || 'Confirm';
        if ($('confirmMessage')) $('confirmMessage').textContent = message || 'Are you sure?';
        if ($('confirmModal')) $('confirmModal').classList.add('open');
    }

    function cancelConfirm() {
        state.pendingConfirmFn = null;
        if ($('confirmModal')) $('confirmModal').classList.remove('open');
    }

    function executeConfirm() {
        var fn = state.pendingConfirmFn;
        cancelConfirm();
        if (typeof fn === 'function') fn();
    }

    // --- IndexedDB Word Sets Manager ---
    function openSettings() {
        if ($('wordsInput')) $('wordsInput').value = state.wordList.join(', ');
        if ($('smSetName')) $('smSetName').value = state.sm.activeId ? (state.sm.activeName || '') : '';
        smUpdateActiveLabel();
        smRenderLibrary();
        if ($('settingsModal')) $('settingsModal').classList.add('open');
    }

    function closeSettings() {
        if ($('settingsModal')) $('settingsModal').classList.remove('open');
    }

    function smOpenDB() {
        if (state.sm.db) return Promise.resolve(state.sm.db);
        return new Promise(function (resolve, reject) {
            if (typeof window.indexedDB === 'undefined') {
                reject(new Error('IndexedDB unavailable'));
                return;
            }
            var req = window.indexedDB.open('spell_sets_db', 1);
            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains('sets')) {
                    db.createObjectStore('sets', { keyPath: 'id', autoIncrement: true });
                }
            };
            req.onsuccess = function (e) {
                state.sm.db = e.target.result;
                resolve(state.sm.db);
            };
            req.onerror = function (e) {
                reject(e);
            };
        });
    }

    async function smGetAll() {
        var db = await smOpenDB();
        return new Promise(function (resolve, reject) {
            var tx = db.transaction('sets', 'readonly');
            var req = tx.objectStore('sets').getAll();
            req.onsuccess = function () { resolve(req.result || []); };
            req.onerror = function (e) { reject(e); };
        });
    }

    async function smPut(setObj) {
        var db = await smOpenDB();
        return new Promise(function (resolve, reject) {
            var tx = db.transaction('sets', 'readwrite');
            var req = tx.objectStore('sets').put(setObj);
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function (e) { reject(e); };
        });
    }

    async function smDelete(id) {
        var db = await smOpenDB();
        return new Promise(function (resolve, reject) {
            var tx = db.transaction('sets', 'readwrite');
            var req = tx.objectStore('sets').delete(id);
            req.onsuccess = function () { resolve(); };
            req.onerror = function (e) { reject(e); };
        });
    }

    function smParseWords() {
        var raw = ($('wordsInput') && $('wordsInput').value) || '';
        return raw.split(/[,\n]+/)
            .map(function (w) { return w.trim().toUpperCase().replace(/[^A-Z]/g, ''); })
            .filter(function (w) { return w.length > 0; });
    }

    function smUpdateActiveLabel() {
        var el = $('smActiveLabel');
        if (el) {
            el.textContent = state.sm.activeId ? 'Editing: ' + state.sm.activeName : 'No saved set loaded';
        }
    }

    async function smSaveAsNew() {
        var nameInput = $('smSetName');
        var name = (nameInput && nameInput.value.trim()) || 'Untitled Set';
        var words = smParseWords();
        if (words.length === 0) {
            showToast('Enter at least one A–Z word first', 'triangle-alert');
            return;
        }
        var now = Date.now();
        var rawText = ($('wordsInput') && $('wordsInput').value) || '';
        var id = await smPut({ name: name, text: rawText, createdAt: now, lastUsed: now, usageCount: 0 });
        state.sm.activeId = id;
        state.sm.activeName = name;
        smUpdateActiveLabel();
        await smRenderLibrary();
        showToast('Saved "' + name + '"', 'circle-check');
    }

    async function smSaveCurrent() {
        var words = smParseWords();
        if (words.length === 0) {
            showToast('Enter at least one A–Z word first', 'triangle-alert');
            return;
        }
        if (!state.sm.activeId) {
            await smSaveAsNew();
            return;
        }
        var existing = state.sm.setsCache.find(function (s) { return s.id === state.sm.activeId; });
        var nameInput = $('smSetName');
        var name = (nameInput && nameInput.value.trim()) || state.sm.activeName || 'Untitled Set';
        var rawText = ($('wordsInput') && $('wordsInput').value) || '';
        await smPut({
            id: state.sm.activeId,
            name: name,
            text: rawText,
            createdAt: existing && existing.createdAt ? existing.createdAt : Date.now(),
            lastUsed: Date.now(),
            usageCount: existing && typeof existing.usageCount === 'number' ? existing.usageCount : 0
        });
        state.sm.activeName = name;
        smUpdateActiveLabel();
        await smRenderLibrary();
        showToast('Updated "' + name + '"', 'circle-check');
    }

    function smPlayCurrent() {
        var words = smParseWords();
        if (words.length === 0) {
            showToast('Enter at least one word first', 'triangle-alert');
            return;
        }
        state.wordList = words;
        state.currentWordIndex = 0;
        saveToCloud();
        closeSettings();
        loadCurrentWord();
        broadcastState({ immediate: true });
        showToast('Loaded ' + words.length + ' words!', 'play');
    }

    async function smLoadSet(id) {
        var set = state.sm.setsCache.find(function (s) { return s.id === id; });
        if (!set) return;

        state.sm.activeId = set.id;
        state.sm.activeName = set.name;
        if ($('wordsInput')) $('wordsInput').value = set.text || '';
        if ($('smSetName')) $('smSetName').value = set.name || '';
        smUpdateActiveLabel();

        set.usageCount = (set.usageCount || 0) + 1;
        set.lastUsed = Date.now();
        await smPut(set);
        await smRenderLibrary();
    }

    async function smLoadAndPlaySet(id) {
        await smLoadSet(id);
        smPlayCurrent();
    }

    function smPromptDeleteSet(id) {
        var set = state.sm.setsCache.find(function (s) { return s.id === id; });
        if (!set) return;
        openConfirmModal(
            'Delete Word Set?',
            'Permanently remove "' + set.name + '" from saved word sets?',
            async function () {
                await smDelete(set.id);
                if (state.sm.activeId === set.id) {
                    state.sm.activeId = null;
                    state.sm.activeName = null;
                    smUpdateActiveLabel();
                }
                await smRenderLibrary();
                showToast('Deleted "' + set.name + '"', 'trash-2');
            }
        );
    }

    async function smRenderLibrary() {
        var container = $('smLibrary');
        if (!container) return;

        var sets = [];
        try {
            sets = await smGetAll();
        } catch (e) {
            container.innerHTML = '<p class="text-center text-xs font-bold text-slate-400 py-6">IndexedDB unavailable in this context.</p>';
            return;
        }

        var sortVal = ($('smSort') && $('smSort').value) || 'recent';
        if (sortVal === 'recent') sets.sort(function (a, b) { return (b.lastUsed || 0) - (a.lastUsed || 0); });
        else if (sortVal === 'alpha') sets.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
        else if (sortVal === 'popular') sets.sort(function (a, b) { return (b.usageCount || 0) - (a.usageCount || 0); });

        state.sm.setsCache = sets;

        if (sets.length === 0) {
            container.innerHTML = '<div class="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-xs font-bold text-slate-400">No saved sets yet. Save your current word list above!</div>';
            return;
        }

        container.innerHTML = '';
        sets.forEach(function (s) {
            var isActive = s.id === state.sm.activeId;
            var wordCount = String(s.text || '').split(/[,\n]+/).map(function (w) { return w.trim(); }).filter(Boolean).length;

            var row = document.createElement('div');
            row.className = 'flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-colors ' +
                (isActive ? 'border-blue bg-blue/10' : 'border-dark dark:border-slate-500 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700');
            row.onclick = function (e) {
                if (e && e.target && e.target.closest && e.target.closest('.sm-del-btn')) return;
                smLoadSet(s.id);
            };

            row.innerHTML =
                '<div class="flex-1 min-w-0">' +
                    '<p class="font-heading font-bold text-sm sm:text-base flex items-center gap-2 ' + (isActive ? 'text-blue' : 'text-dark dark:text-white') + '">' +
                        '<span class="truncate">' + escapeHTML(s.name) + '</span>' +
                        (isActive ? '<span class="text-[10px] bg-blue text-white px-2 py-0.5 rounded-full uppercase">Active</span>' : '') +
                    '</p>' +
                    '<p class="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">' + wordCount + ' word' + (wordCount !== 1 ? 's' : '') + ' · Used ' + (s.usageCount || 0) + 'x</p>' +
                '</div>' +
                '<div class="flex items-center gap-1.5 flex-shrink-0">' +
                    '<button type="button" onclick="event.stopPropagation(); App.smLoadAndPlaySet(' + Number(s.id) + ')" aria-label="Play set ' + escapeHTML(s.name) + '" ' +
                        'class="sm-play-btn btn-chunky bg-green text-white rounded-xl px-2.5 h-8 text-xs flex items-center gap-1">' +
                        '<i data-lucide="play" class="w-3.5 h-3.5"></i><span>Play</span>' +
                    '</button>' +
                    '<button type="button" onclick="event.stopPropagation(); App.smPromptDeleteSet(' + Number(s.id) + ')" aria-label="Delete set ' + escapeHTML(s.name) + '" ' +
                        'class="sm-del-btn btn-chunky bg-pink text-white rounded-xl w-8 h-8 p-0 flex-shrink-0">' +
                        '<i data-lucide="trash-2" class="w-4 h-4"></i>' +
                    '</button>' +
                '</div>';

            container.appendChild(row);
        });
        refreshIcons();
    }

    // --- Dual-Window Broadcast Sync ---
    function broadcastState(options) {
        if (!bc || IS_PLAYER_WINDOW) return;
        var now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        var minInterval = options && options.immediate ? 0 : 75;
        if (state.bcThrottleTimer) clearTimeout(state.bcThrottleTimer);

        var dispatch = function () {
            state.bcLastSent = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
            var pulse = Boolean(state.wrongPulse);
            state.wrongPulse = false;
            bc.postMessage({
                type: 'state-update',
                slotsHTML: ($('slotsContainer') && $('slotsContainer').innerHTML) || '',
                lettersHTML: ($('lettersContainer') && $('lettersContainer').innerHTML) || '',
                progressText: ($('progressBadge') && $('progressBadge').textContent) || '',
                targetWord: state.targetWord,
                currentWordIndex: state.currentWordIndex,
                totalWords: state.wordList.length,
                streak: state.streak,
                wrongPulse: pulse,
                isDark: document.documentElement.classList.contains('dark'),
                isReachMode: state.isReachMode
            });
        };

        if (now - state.bcLastSent >= minInterval) {
            dispatch();
        } else {
            state.bcThrottleTimer = setTimeout(dispatch, minInterval - (now - state.bcLastSent));
        }
    }

    function openStudentView() {
        var path = window.location ? window.location.pathname : '';
        window.open(path + '?player=1', 'spell-student', 'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no');
    }

    function initStudentView() {
        document.title = 'Student View | Spell It';
        ['btnOpenPlayer', 'settingsBtn', 'poolControls', 'prevWordBtn', 'nextWordBtn', 'keyboardHintLine'].forEach(function (id) {
            var el = $(id);
            if (el) el.classList.add('is-hidden');
        });
        if ($('playerToolbar')) $('playerToolbar').classList.remove('is-hidden');
        refreshIcons();

        if (bc) {
            bc.onmessage = function (evt) {
                var data = evt && evt.data;
                if (!data || data.type !== 'state-update') return;

                if (state.playerRetryInterval) {
                    clearInterval(state.playerRetryInterval);
                    state.playerRetryInterval = null;
                }
                if ($('playerConnStatus')) $('playerConnStatus').classList.add('is-hidden');

                if (typeof data.isDark === 'boolean') {
                    document.documentElement.classList.toggle('dark', data.isDark);
                    syncThemeIcon();
                }
                if (typeof data.isReachMode === 'boolean') {
                    state.isReachMode = data.isReachMode;
                    applyReachMode();
                }

                var sc = $('slotsContainer');
                if (sc) {
                    sc.innerHTML = data.slotsHTML || '';
                    sc.querySelectorAll('button, div').forEach(function (el) {
                        el.onclick = null;
                        el.style.pointerEvents = 'none';
                    });
                }

                var lc = $('lettersContainer');
                if (lc) {
                    lc.innerHTML = data.lettersHTML || '';
                    lc.querySelectorAll('button').forEach(function (el) {
                        el.onclick = null;
                        el.disabled = true;
                        el.style.opacity = '0.82';
                    });
                }

                if (typeof data.targetWord === 'string') {
                    state.targetWord = data.targetWord;
                }
                if (typeof data.streak === 'number') {
                    state.streak = data.streak;
                    updateStreakUI();
                }
                if (data.wrongPulse && $('gameBoard')) {
                    var b = $('gameBoard');
                    b.classList.remove('board-shake');
                    void b.offsetWidth;
                    b.classList.add('board-shake');
                    setTimeout(function () { b.classList.remove('board-shake'); }, 420);
                }

                if ($('progressBadge') && data.progressText) $('progressBadge').textContent = data.progressText;
                if ($('mobileProgressBadge')) {
                    $('mobileProgressBadge').textContent = data.totalWords > 0
                        ? (data.currentWordIndex + 1) + ' / ' + data.totalWords
                        : '0 / 0';
                }
                if ($('studentWordDisplay')) {
                    $('studentWordDisplay').textContent = data.totalWords > 0
                        ? (data.currentWordIndex + 1) + ' / ' + data.totalWords
                        : '0 / 0';
                }
            };

            var ping = function () { bc.postMessage({ type: 'player-ready' }); };
            ping();
            state.playerRetryInterval = setInterval(ping, 2000);
        }
    }

    // --- Keyboard Support & Boot ---
    function bindGlobalEvents() {
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                if ($('confirmModal') && $('confirmModal').classList.contains('open')) {
                    cancelConfirm();
                    return;
                }
                if ($('feedbackModal') && $('feedbackModal').classList.contains('open')) {
                    handleFeedbackAction();
                    return;
                }
                if ($('settingsModal') && $('settingsModal').classList.contains('open')) {
                    closeSettings();
                }
                return;
            }

            if (e.key === 'Enter' && $('feedbackModal') && $('feedbackModal').classList.contains('open')) {
                e.preventDefault();
                handleFeedbackAction();
                return;
            }

            if (IS_PLAYER_WINDOW) return;
            if ($('settingsModal') && $('settingsModal').classList.contains('open')) return;
            if ($('confirmModal') && $('confirmModal').classList.contains('open')) return;
            if ($('feedbackModal') && $('feedbackModal').classList.contains('open')) return;

            var activeEl = document.activeElement;
            var tag = activeEl && activeEl.tagName ? activeEl.tagName.toUpperCase() : '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            var upper = String(e.key || '').toUpperCase();
            if (upper === 'BACKSPACE') {
                e.preventDefault();
                for (var i = state.placedLetters.length - 1; i >= 0; i--) {
                    if (state.placedLetters[i] !== null) {
                        handleSlotClick(i);
                        break;
                    }
                }
                return;
            }

            if (/^[A-Z]$/.test(upper)) {
                var tile = state.letterTiles.find(function (t) { return !t.isPlaced && t.char === upper; });
                if (tile) handleLetterClick(tile.id);
            }
        });
    }

    async function init() {
        syncThemeIcon();
        bindGlobalEvents();

        if (IS_PLAYER_WINDOW) {
            initStudentView();
            return;
        }

        if (bc) {
            bc.onmessage = function (evt) {
                if (evt && evt.data && evt.data.type === 'player-ready') {
                    broadcastState({ immediate: true });
                }
            };
        }

        try {
            var prefsRaw = localStorage.getItem(PREFS_KEY);
            if (prefsRaw) {
                var prefs = JSON.parse(prefsRaw);
                if (prefs && typeof prefs.sfxEnabled === 'boolean') state.sfxEnabled = prefs.sfxEnabled;
            }
        } catch (e) {}

        if (typeof window.requireAuth === 'function') {
            await window.requireAuth();
        }

        var cloudData = null;
        if (typeof window.loadProgress === 'function') {
            try {
                cloudData = await window.loadProgress('spell_word');
            } catch (e) {
                cloudData = null;
            }
        }

        if (cloudData) {
            if (cloudData.theme) {
                var hasLocalTheme = false;
                try {
                    hasLocalTheme = Boolean(localStorage.getItem(THEME_KEY) || localStorage.getItem('theme_hub'));
                } catch (e) {}
                if (!hasLocalTheme) {
                    var isDark = cloudData.theme === 'dark';
                    document.documentElement.classList.toggle('dark', isDark);
                }
            }
            state.isReachMode = Boolean(cloudData.reachMode);
            if (Array.isArray(cloudData.wordList) && cloudData.wordList.length > 0) {
                state.wordList = cloudData.wordList.map(function (w) { return String(w).toUpperCase(); });
            }
        } else {
            try {
                var savedReach = localStorage.getItem(REACH_KEY);
                if (savedReach !== null) state.isReachMode = savedReach === 'true';

                var savedWords = localStorage.getItem(WORDS_KEY);
                if (savedWords) {
                    var parsed = JSON.parse(savedWords);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        state.wordList = parsed.map(function (w) { return String(w).toUpperCase(); });
                    }
                }
            } catch (e) {}
            saveToCloud();
        }

        syncThemeIcon();
        syncSfxUI();
        applyReachMode();
        updateStreakUI();
        state.currentWordIndex = 0;
        loadCurrentWord();
        refreshIcons();
    }

    window.App = {
        init: init,
        toggleDarkMode: toggleDarkMode,
        toggleReachMode: toggleReachMode,
        toggleSfx: toggleSfx,
        openStudentView: openStudentView,
        playTargetWordAudio: playTargetWordAudio,
        prevWord: prevWord,
        nextWord: nextWord,
        useHint: useHint,
        shufflePool: shufflePool,
        clearSlots: clearSlots,
        handleLetterClick: handleLetterClick,
        handleSlotClick: handleSlotClick,
        openSettings: openSettings,
        closeSettings: closeSettings,
        smSaveAsNew: smSaveAsNew,
        smSaveCurrent: smSaveCurrent,
        smPlayCurrent: smPlayCurrent,
        smLoadAndPlaySet: smLoadAndPlaySet,
        smPromptDeleteSet: smPromptDeleteSet,
        smRenderLibrary: smRenderLibrary,
        handleFeedbackAction: handleFeedbackAction,
        cancelConfirm: cancelConfirm,
        executeConfirm: executeConfirm,
        _getState: function () { return state; }
    };

    document.addEventListener('DOMContentLoaded', function () {
        init();
    });
})();
