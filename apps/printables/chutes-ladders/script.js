(function () {
    'use strict';

    // ============================
    // PRESETS, PALETTES & CONSTANTS
    // ============================
    const PRESETS = {
        past_simple: {
            title: 'Past Simple Slides & Ladders',
            subtitle: 'Roll the die, move your counter, and say the past simple form of the verb!',
            prompts: [
                'go | went', 'eat | ate', 'see | saw', 'buy | bought',
                'take | took', 'make | made', 'come | came', 'give | gave',
                'find | found', 'write | wrote', 'drink | drank', 'sleep | slept',
                'run | ran', 'read | read (/red/)', 'speak | spoke', 'have | had',
                'do | did', 'fly | flew', 'swim | swam', 'drive | drove',
                'sing | sang', 'think | thought', 'know | knew', 'wear | wore',
                'draw | drew', 'teach | taught', 'catch | caught', 'win | won',
                'begin | began', 'break | broke', 'bring | brought', 'build | built',
                'choose | chose', 'feel | felt', 'forget | forgot', 'get | got',
                'hear | heard', 'keep | kept', 'leave | left', 'meet | met',
                'pay | paid', 'put | put', 'ride | rode', 'send | sent',
                'sit | sat', 'stand | stood'
            ]
        },
        speaking: {
            title: 'Talk & Climb Board Game',
            subtitle: 'Land on a square and speak in full sentences to answer the prompt!',
            prompts: [
                'Name 3 animals', 'Favorite food?', 'What did you eat today?', 'Spell your name',
                'Name 3 colors', 'Describe your best friend', 'Favorite movie?', 'Count 10 to 1',
                'How is the weather?', 'Name 3 sports', 'Your dream job?', 'Ask a friend a question',
                'Weekend activity', 'Name 3 countries', 'What are you wearing?', 'Say a tongue twister',
                'Favorite subject?', 'Name 3 fruits', 'What makes you happy?', 'Act like an animal!',
                'Favorite season?', 'Name 3 jobs', 'Wake up time?', 'Describe your room',
                'Favorite superhero?', 'Name 3 drinks', 'Sing 1 line of a song', 'Yesterday evening?',
                'Favorite holiday?', 'Name 3 hobbies', 'Cats or dogs? Why?', 'Say 3 adjectives',
                'Favorite book?', 'Name 3 vehicles', 'What can you cook?', 'Tell a quick joke',
                'Beach or mountains?', 'Name 3 clothes', 'Favorite ice cream?', 'Say 3 action verbs',
                'Your lucky number?', 'Name 3 body parts', 'Pizza or burger?', 'Describe your teacher',
                'Morning or night?', 'Name 3 places in town'
            ]
        },
        opposites: {
            title: 'Opposites Slides & Ladders',
            subtitle: 'Say the opposite word when you land on a square!',
            prompts: [
                'hot | cold', 'big | small', 'fast | slow', 'happy | sad',
                'tall | short', 'old | young', 'heavy | light', 'loud | quiet',
                'clean | dirty', 'hard | soft', 'rich | poor', 'early | late',
                'open | closed', 'full | empty', 'day | night', 'bright | dark',
                'strong | weak', 'wet | dry', 'near | far', 'easy | difficult',
                'safe | dangerous', 'cheap | expensive', 'wide | narrow', 'deep | shallow',
                'brave | shy', 'polite | rude', 'sweet | sour', 'sharp | dull',
                'smooth | rough', 'thick | thin', 'tight | loose', 'wild | tame',
                'noisy | peaceful', 'active | lazy', 'ancient | modern', 'bitter | sweet',
                'clever | silly', 'fresh | stale', 'giant | tiny', 'honest | dishonest',
                'indoor | outdoor', 'kind | mean', 'major | minor', 'north | south',
                'push | pull', 'win | lose'
            ]
        },
        phonics: {
            title: 'Phonics Sound Race',
            subtitle: 'Blend the sounds and read each word aloud! Use it in a short sentence for bonus praise.',
            prompts: [
                'cat', 'dog', 'sun', 'hat',
                'pig', 'bed', 'cup', 'fox',
                'ship | sh-i-p', 'chat | ch-a-t', 'thin | th-i-n', 'frog | fr-o-g',
                'clap | cl-a-p', 'star | st-ar', 'tree | tr-ee', 'cake | a_e',
                'bike | i_e', 'home | o_e', 'cube | u_e', 'rain | ai',
                'boat | oa', 'moon | oo', 'book | short oo', 'bird | ir',
                'corn | or', 'car | ar', 'cloud | ou', 'cow | ow',
                'coin | oi', 'boy | oy', 'snow | ow', 'play | ay',
                'blue | ue', 'night | igh', 'duck | ck', 'ring | ng',
                'lamp | mp', 'tent | nt', 'gift | ft', 'desk | sk',
                'drum | dr', 'swim | sw', 'plum | pl', 'crab | cr',
                'skip | sk', 'smile | sm'
            ]
        },
        grammar_fix: {
            title: 'Grammar Fix-It Challenge',
            subtitle: 'Spot the mistake in the sentence and say it correctly!',
            prompts: [
                'She go to school. | She goes to school.',
                'I am have a dog. | I have a dog.',
                'Yesterday I eat pizza. | Yesterday I ate pizza.',
                'He do not like milk. | He does not like milk.',
                'They is playing. | They are playing.',
                'Look at those mouses! | Look at those mice!',
                'Do she live here? | Does she live here?',
                'I have two sister. | I have two sisters.',
                'We was very tired. | We were very tired.',
                'Can he swims fast? | Can he swim fast?',
                'This book is more good. | This book is better.',
                'She didn\'t went home. | She didn\'t go home.',
                'There is three cats. | There are three cats.',
                'He don\'t has a pen. | He doesn\'t have a pen.',
                'I like listen to music. | I like listening to music.',
                'My birthday is in Monday. | My birthday is on Monday.',
                'She is tall than me. | She is taller than me.',
                'I didn\'t saw him. | I didn\'t see him.',
                'We going to the park. | We are going to the park.',
                'He study English daily. | He studies English daily.',
                'I has three apples. | I have three apples.',
                'Why you are crying? | Why are you crying?',
                'They didn\'t played. | They didn\'t play.',
                'Give the ball to I. | Give the ball to me.',
                'The childs are happy. | The children are happy.',
                'She work at a bank. | She works at a bank.',
                'It rain yesterday. | It rained yesterday.',
                'Do you went there? | Did you go there?',
                'I am agree with you. | I agree with you.',
                'He is good in math. | He is good at math.'
            ]
        },
        classic: {
            title: 'Slides & Ladders',
            subtitle: 'Roll the die and race to the top! Climb ladders up and slide down slides.',
            prompts: []
        }
    };

    const PLAYER_COLORS = [
        { name: 'Team 1', color: '#ff4785', light: '#ffe4ed', label: 'P1' },
        { name: 'Team 2', color: '#1ea7fd', light: '#e0f2fe', label: 'P2' },
        { name: 'Team 3', color: '#00d063', light: '#dcfce7', label: 'P3' },
        { name: 'Team 4', color: '#ff7e33', light: '#ffedd5', label: 'P4' },
        { name: 'Team 5', color: '#7C4DFF', light: '#ede9fe', label: 'P5' },
        { name: 'Team 6', color: '#14b8a6', light: '#ccfbf1', label: 'P6' }
    ];

    const TILE_PALETTES = {
        vibrant: ['#fef08a', '#bae6fd', '#fbcfe8', '#bbf7d0', '#fed7aa', '#ddd6fe'],
        pastel: ['#fef9c3', '#e0f2fe', '#fce7f3', '#dcfce7', '#ffedd5', '#ede9fe'],
        jungle: ['#dcfce7', '#fef3c7', '#bbf7d0', '#fde68a', '#d9f99d', '#ecfccb'],
        ocean: ['#e0f2fe', '#cffafe', '#dbeafe', '#ccfbf1', '#ede9fe', '#f0f9ff'],
        bw: ['#ffffff', '#f1f5f9', '#ffffff', '#e2e8f0', '#ffffff', '#f1f5f9']
    };

    const BONUS_TYPES = {
        plus2: {
            code: '+2',
            tag: '[+2]',
            badge: '+2 BONUS',
            title: 'Boost Forward +2!',
            desc: 'Move ahead 2 extra squares!',
            bg: '#00d063',
            fg: '#1e293b'
        },
        back2: {
            code: '-2',
            tag: '[-2]',
            badge: 'BACK 2',
            title: 'Slip Back 2 Squares!',
            desc: 'Step back 2 squares!',
            bg: '#ff4785',
            fg: '#ffffff'
        },
        roll_again: {
            code: 'ROLL',
            tag: '[ROLL]',
            badge: 'ROLL AGAIN',
            title: 'Bonus Free Roll!',
            desc: 'Take an extra die roll!',
            bg: '#ff7e33',
            fg: '#1e293b'
        },
        skip: {
            code: 'SKIP',
            tag: '[SKIP]',
            badge: 'REST 1',
            title: 'Pause Next Turn',
            desc: 'Rest for 1 turn next round.',
            bg: '#1ea7fd',
            fg: '#ffffff'
        }
    };

    const WS_STORAGE_KEY = 'klasskit_chutes_ladders_v1';
    const SETS_STORAGE_KEY = 'klasskit_chutes_ladders_sets_v1';
    const CLOUD_TOOL_KEY = 'chutes-ladders';
    const THEME_KEY = 'theme_chutes-ladders';

    // ============================
    // APP STATE
    // ============================
    const state = {
        cols: 6,
        rows: 5,
        totalTiles: 30,
        slideStyle: 'chutes',      // 'chutes' | 'snakes' | 'mixed'
        colorTheme: 'vibrant',     // 'vibrant' | 'pastel' | 'jungle' | 'ocean' | 'bw'
        ladderCount: 4,
        chuteCount: 4,
        orient: 'portrait',
        title: PRESETS.past_simple.title,
        subtitle: PRESETS.past_simple.subtitle,
        prompts: [],               // [{ prompt, answer, special, raw }]
        links: [],                 // [{ from, to, type: 'ladder'|'chute', variant: 'chute'|'snake' }]
        bonusTiles: {},            // { [tileNum]: 'plus2' | 'back2' | 'roll_again' | 'skip' }
        showPathArrows: true,
        bonusTilesEnabled: false,
        printCutouts: true,
        fullBoardPrint: true,
        challengeMode: false,
        roll6ExtraTurn: true,
        exactFinish: false,
        showAnswers: false,
        editLinksMode: false,
        editLinkStart: null,
        focusMode: false,
        zoom: 1,
        soundOn: true,
        playerCount: 2,
        players: [],               // [{ id, name, color, light, label, pos, skipTurns }]
        currentTurn: 0,
        isRolling: false,
        winner: null,
        history: [],               // undo snapshots
        activeSetId: null,
        savedPlayerNames: null,
        savedSets: [],
        lastSelectedTile: 1,
        activeTab: 'prompts'
    };

    let cloudSaveTimer = null;
    let liveInputTimer = null;
    let hasSavedLinks = false;
    let hasSavedBonusTiles = false;
    let printingAsKey = false;
    let pendingChallenge = null; // { playerIdx, prevPos, landedTile, rolledSix, linkAfter, specialAfter }
    let modalEditingTile = null;
    let modalTimerInterval = null;
    let modalTimerRemaining = 15;
    let modalTimerRunning = false;

    function hydrateIcons(root) {
        if (typeof lucide === 'undefined' || typeof lucide.createIcons !== 'function') return;
        try {
            lucide.createIcons(root && root !== document ? { root } : undefined);
        } catch (e) {
            lucide.createIcons();
        }
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeXml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // ============================
    // SOUND ENGINE (Tone.js)
    // ============================
    let synth = null;
    function ensureAudio() {
        if (!state.soundOn || typeof Tone === 'undefined') return null;
        try {
            if (Tone.context && Tone.context.state !== 'running') {
                Tone.start();
            }
            if (!synth) {
                synth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: 'triangle' },
                    envelope: { attack: 0.01, decay: 0.12, sustain: 0.05, release: 0.2 }
                }).toDestination();
                synth.volume.value = -10;
            }
            return synth;
        } catch (e) {
            return null;
        }
    }

    function playSound(type) {
        const s = ensureAudio();
        if (!s) return;
        try {
            const now = Tone.now();
            if (type === 'pop') {
                s.triggerAttackRelease('C5', '32n', now);
            } else if (type === 'hop') {
                s.triggerAttackRelease('E5', '32n', now);
            } else if (type === 'tick') {
                s.triggerAttackRelease('A5', '64n', now);
            } else if (type === 'dice') {
                s.triggerAttackRelease('G4', '32n', now);
                s.triggerAttackRelease('B4', '32n', now + 0.07);
                s.triggerAttackRelease('D5', '32n', now + 0.14);
            } else if (type === 'ladder' || type === 'bonus') {
                ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => s.triggerAttackRelease(n, '16n', now + i * 0.075));
            } else if (type === 'chute' || type === 'wrong') {
                ['G5', 'E5', 'C5', 'G4'].forEach((n, i) => s.triggerAttackRelease(n, '16n', now + i * 0.075));
            } else if (type === 'win') {
                ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => s.triggerAttackRelease(n, '8n', now + i * 0.09));
            }
        } catch (e) {}
    }

    // ============================
    // TOAST & MODAL HELPERS
    // ============================
    function showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        while (container.children.length >= 3) {
            container.firstElementChild.remove();
        }
        const colors = {
            info: 'bg-blue text-white',
            success: 'bg-green text-dark',
            warning: 'bg-orange text-dark',
            error: 'bg-pink text-white'
        };
        const icons = {
            success: 'check-circle',
            error: 'alert-circle',
            info: 'info',
            warning: 'alert-triangle'
        };
        const el = document.createElement('div');
        el.className = `pointer-events-auto px-5 py-3 rounded-2xl border-[3px] border-dark shadow-hard font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 animate-pop-in ${colors[type] || colors.info}`;
        el.innerHTML = `<i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 shrink-0"></i><span></span>`;
        el.querySelector('span').textContent = msg;
        container.appendChild(el);
        hydrateIcons(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(10px)';
            el.style.transition = 'all 0.25s ease';
            setTimeout(() => el.remove(), 260);
        }, 2500);
    }

    function openModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('hidden');
        el.classList.add('flex');
    }

    function closeModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('hidden');
        el.classList.remove('flex');
    }

    let confirmCallback = null;
    function openConfirm(title, message, onYes) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        confirmCallback = onYes;
        openModal('confirmModal');
    }

    function closeConfirm() {
        closeModal('confirmModal');
        confirmCallback = null;
    }

    function updateSyncBadge(status) {
        const badge = document.getElementById('sync-status-badge');
        if (!badge) return;
        badge.classList.remove(
            'bg-green/20', 'text-green', 'border-green/40',
            'bg-orange/20', 'text-orange', 'border-orange/40'
        );
        if (status === 'saving') {
            badge.textContent = 'SAVING...';
            badge.classList.add('bg-orange/20', 'text-orange', 'border-orange/40');
        } else {
            badge.textContent = 'SAVED';
            badge.classList.add('bg-green/20', 'text-green', 'border-green/40');
        }
    }

    // ============================
    // BOARD GEOMETRY & PARSING
    // ============================
    function getBoardMetrics() {
        const cols = state.cols;
        const rows = state.rows;
        const cellW = state.orient === 'landscape' ? 148 : 140;
        const cellH = state.orient === 'landscape' ? 110 : 124;
        const padX = 16;
        const padY = 16;
        const boardW = cols * cellW;
        const boardH = rows * cellH;
        return {
            cols,
            rows,
            cellW,
            cellH,
            padX,
            padY,
            boardW,
            boardH,
            svgW: boardW + padX * 2,
            svgH: boardH + padY * 2
        };
    }

    function getTileCoords(tileNum, cols, rows) {
        const idx = tileNum - 1;
        const rowFromBottom = Math.floor(idx / cols);
        const rowFromTop = rows - 1 - rowFromBottom;
        const colInRow = idx % cols;
        const col = (rowFromBottom % 2 === 0) ? colInRow : (cols - 1 - colInRow);
        return { col, row: rowFromTop, rowFromBottom };
    }

    function getTileCenter(tileNum, cols, rows, cellW, cellH, padX, padY) {
        const { col, row } = getTileCoords(tileNum, cols, rows);
        return {
            x: padX + col * cellW + cellW / 2,
            y: padY + row * cellH + cellH / 2,
            col,
            row
        };
    }

    function getTokenOffset(idx, totalPlayers) {
        if (totalPlayers <= 2) {
            return [{ dx: -26, dy: 26 }, { dx: 26, dy: 26 }][idx] || { dx: 0, dy: 26 };
        }
        if (totalPlayers <= 4) {
            return [
                { dx: -26, dy: 26 },
                { dx: 26, dy: 26 },
                { dx: -26, dy: -22 },
                { dx: 26, dy: -22 }
            ][idx % 4];
        }
        return [
            { dx: -36, dy: 26 },
            { dx: 0, dy: 26 },
            { dx: 36, dy: 26 },
            { dx: -36, dy: -22 },
            { dx: 0, dy: -22 },
            { dx: 36, dy: -22 }
        ][idx % 6];
    }

    function parsePromptTag(text) {
        const str = String(text || '').trim();
        const match = str.match(/^\[(\+2|-2|ROLL|SKIP)\]\s*(.*)$/i);
        if (!match) return { cleanPrompt: str, special: null };
        const rawTag = match[1].toUpperCase();
        const map = {
            '+2': 'plus2',
            '-2': 'back2',
            'ROLL': 'roll_again',
            'SKIP': 'skip'
        };
        return {
            cleanPrompt: match[2].trim(),
            special: map[rawTag] || null
        };
    }

    function parsePromptsInput() {
        const inp = document.getElementById('prompt-input');
        const raw = inp ? inp.value.trim() : '';
        if (!raw) return [];
        const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        return lines.map(line => {
            const parts = line.split('|');
            const parsedTag = parsePromptTag(parts[0] || '');
            return {
                prompt: parsedTag.cleanPrompt,
                answer: parts.length > 1 ? parts.slice(1).join('|').trim() : '',
                special: parsedTag.special,
                raw: line
            };
        });
    }

    function shuffleArray(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function getEffectiveSpecial(num) {
        if (num <= 1 || num >= state.totalTiles) return null;
        if (state.prompts.length > 0) {
            const obj = state.prompts[(num - 2) % state.prompts.length];
            if (obj && obj.special) return obj.special;
        }
        return state.bonusTiles[num] || null;
    }

    // ============================
    // LINK & BONUS GENERATOR
    // ============================
    function segmentsIntersect(a, b, c, d) {
        const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
        return (ccw(a, c, d) !== ccw(b, c, d)) && (ccw(a, b, c) !== ccw(a, b, d));
    }

    function generateBalancedLinks() {
        const N = state.totalTiles;
        const cols = state.cols;
        const rows = state.rows;
        const used = new Set([1, N]);
        const links = [];

        const coordFor = (n) => {
            const c = getTileCoords(n, cols, rows);
            return { x: c.col + 0.5, y: c.row + 0.5, ...c };
        };

        const placeLinksOfType = (type, count) => {
            const maxRowSpan = Math.max(2, Math.floor(rows * 0.65));
            const maxColSpan = Math.max(2, Math.ceil(cols * 0.55));
            for (let idx = 0; idx < count; idx++) {
                let bestCandidate = null;
                let bestScore = Infinity;

                for (let attempt = 0; attempt < 90; attempt++) {
                    const a = 2 + Math.floor(Math.random() * (N - 3));
                    const b = 2 + Math.floor(Math.random() * (N - 3));
                    if (a === b) continue;
                    const lo = Math.min(a, b);
                    const hi = Math.max(a, b);
                    if (used.has(lo) || used.has(hi)) continue;

                    const cLo = coordFor(lo);
                    const cHi = coordFor(hi);
                    const rowDiff = cLo.row - cHi.row; // positive because cHi is higher (smaller rowFromTop)
                    const colDiff = Math.abs(cHi.col - cLo.col);
                    if (rowDiff < 1 || rowDiff > maxRowSpan || colDiff > maxColSpan) continue;

                    // Count intersections with existing links
                    let crossings = 0;
                    for (const existing of links) {
                        const eA = coordFor(existing.from);
                        const eB = coordFor(existing.to);
                        if (segmentsIntersect(cLo, cHi, eA, eB)) crossings++;
                    }
                    const score = crossings * 100 + Math.abs(rowDiff - 2) * 3 + Math.abs(colDiff - 1);
                    if (score < bestScore) {
                        bestScore = score;
                        bestCandidate = { lo, hi };
                        if (crossings === 0 && attempt > 15) break;
                    }
                }

                if (bestCandidate) {
                    const from = type === 'ladder' ? bestCandidate.lo : bestCandidate.hi;
                    const to = type === 'ladder' ? bestCandidate.hi : bestCandidate.lo;
                    let variant = 'ladder';
                    if (type === 'chute') {
                        if (state.slideStyle === 'snakes') variant = 'snake';
                        else if (state.slideStyle === 'mixed') variant = (idx % 2 === 0) ? 'chute' : 'snake';
                        else variant = 'chute';
                    }
                    used.add(bestCandidate.lo);
                    used.add(bestCandidate.hi);
                    links.push({ from, to, type, variant });
                }
            }
        };

        placeLinksOfType('ladder', state.ladderCount);
        placeLinksOfType('chute', state.chuteCount);
        state.links = links;
        if (state.bonusTilesEnabled) {
            generateBonusTiles();
        }
    }

    function applySlideStyleToExistingLinks() {
        let chuteIdx = 0;
        state.links.forEach(l => {
            if (l.type === 'chute') {
                if (state.slideStyle === 'chutes') l.variant = 'chute';
                else if (state.slideStyle === 'snakes') l.variant = 'snake';
                else l.variant = (chuteIdx % 2 === 0) ? 'chute' : 'snake';
                chuteIdx++;
            }
        });
    }

    function generateBonusTiles() {
        state.bonusTiles = {};
        if (!state.bonusTilesEnabled) return;

        const N = state.totalTiles;
        const occupied = new Set([1, N]);
        state.links.forEach(l => {
            occupied.add(l.from);
            occupied.add(l.to);
        });

        const available = [];
        for (let n = 3; n <= N - 2; n++) {
            if (!occupied.has(n)) available.push(n);
        }

        const typesPool = ['plus2', 'roll_again', 'back2', 'skip'];
        const targetCount = Math.min(available.length, N >= 42 ? 4 : (N >= 30 ? 3 : 2));
        const picked = shuffleArray(available).slice(0, targetCount);
        picked.forEach((tileNum, idx) => {
            state.bonusTiles[tileNum] = typesPool[idx % typesPool.length];
        });
    }

    // ============================
    // TEXT WRAPPING & BEZIER MATH
    // ============================
    function wrapTextLines(text, maxCharsPerLine) {
        const clean = String(text || '').trim();
        if (!clean) return [];
        const words = clean.split(/\s+/);
        const lines = [];
        let current = '';

        for (const w of words) {
            if (!current) {
                current = w;
            } else if ((current + ' ' + w).length <= maxCharsPerLine) {
                current += ' ' + w;
            } else {
                lines.push(current);
                current = w;
            }
        }
        if (current) lines.push(current);
        return lines;
    }

    function fitTileText(text, cols, cellW, maxLines) {
        const baseFont = cols >= 8 ? 13.5 : (cols >= 7 ? 14.5 : 15.5);
        const fontCandidates = [baseFont, +(baseFont - 2).toFixed(1), +(baseFont - 3.8).toFixed(1)];

        for (const fSize of fontCandidates) {
            const maxChars = Math.max(8, Math.floor((cellW - 20) / (fSize * 0.56)));
            const allLines = wrapTextLines(text, maxChars);
            if (allLines.length <= maxLines) {
                return { lines: allLines, fontSize: fSize };
            }
        }

        const smallestFont = fontCandidates[fontCandidates.length - 1];
        const maxChars = Math.max(8, Math.floor((cellW - 20) / (smallestFont * 0.56)));
        const allLines = wrapTextLines(text, maxChars);
        if (allLines.length > maxLines) {
            const clipped = allLines.slice(0, maxLines);
            const overflowTail = allLines.slice(maxLines - 1).join(' ');
            clipped[maxLines - 1] = overflowTail.slice(0, Math.max(4, maxChars - 1)) + '…';
            return { lines: clipped, fontSize: smallestFont };
        }
        return { lines: allLines, fontSize: smallestFont };
    }

    function getChuteGeometry(x1, y1, x2, y2, idx) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len < 10) return null;
        const ux = dx / len;
        const uy = dy / len;
        const px = -uy;
        const py = ux;

        const trim = 20;
        const p0 = { x: x1 + ux * trim, y: y1 + uy * trim };
        const p3 = { x: x2 - ux * trim, y: y2 - uy * trim };
        const sway = Math.min(48, len * 0.23) * (idx % 2 === 0 ? 1 : -1);
        const p1 = {
            x: p0.x + (p3.x - p0.x) * 0.33 + px * sway,
            y: p0.y + (p3.y - p0.y) * 0.33 + py * sway
        };
        const p2 = {
            x: p0.x + (p3.x - p0.x) * 0.66 - px * sway,
            y: p0.y + (p3.y - p0.y) * 0.66 - py * sway
        };
        return { p0, p1, p2, p3, len };
    }

    function cubicBezierPoint(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;
        return {
            x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
            y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y
        };
    }

    function cubicBezierTangent(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        return {
            x: 3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
            y: 3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y)
        };
    }

    // ============================
    // SVG BOARD RENDERER
    // ============================
    function buildLadderSVG(x1, y1, x2, y2, idx, isBW) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len < 10) return '';
        const ux = dx / len;
        const uy = dy / len;
        const px = -uy;
        const py = ux;

        const halfW = 13.5;
        const trim = 18;
        const sx = x1 + ux * trim;
        const sy = y1 + uy * trim;
        const ex = x2 - ux * trim;
        const ey = y2 - uy * trim;
        const effLen = Math.max(20, len - trim * 2);

        const l1x1 = sx + px * halfW, l1y1 = sy + py * halfW;
        const l1x2 = ex + px * halfW, l1y2 = ey + py * halfW;
        const l2x1 = sx - px * halfW, l2y1 = sy - py * halfW;
        const l2x2 = ex - px * halfW, l2y2 = ey - py * halfW;

        const rungsCount = Math.max(3, Math.floor(effLen / 24));
        let rungs = '';
        const fillRail = isBW ? '#ffffff' : '#00d063';
        const fillRung = isBW ? '#e2e8f0' : '#fef08a';

        for (let i = 1; i <= rungsCount; i++) {
            const t = i / (rungsCount + 1);
            const rx = sx + (ex - sx) * t;
            const ry = sy + (ey - sy) * t;
            const rx1 = rx + px * halfW, ry1 = ry + py * halfW;
            const rx2 = rx - px * halfW, ry2 = ry - py * halfW;
            rungs += `
                <line x1="${rx1.toFixed(1)}" y1="${ry1.toFixed(1)}" x2="${rx2.toFixed(1)}" y2="${ry2.toFixed(1)}" stroke="#1e293b" stroke-width="8.5" stroke-linecap="round"/>
                <line x1="${rx1.toFixed(1)}" y1="${ry1.toFixed(1)}" x2="${rx2.toFixed(1)}" y2="${ry2.toFixed(1)}" stroke="${fillRung}" stroke-width="4.2" stroke-linecap="round"/>
            `;
        }

        return `
            <g class="link-group" data-link-idx="${idx}" opacity="0.95">
                ${rungs}
                <line x1="${l1x1.toFixed(1)}" y1="${l1y1.toFixed(1)}" x2="${l1x2.toFixed(1)}" y2="${l1y2.toFixed(1)}" stroke="#1e293b" stroke-width="9.5" stroke-linecap="round"/>
                <line x1="${l1x1.toFixed(1)}" y1="${l1y1.toFixed(1)}" x2="${l1x2.toFixed(1)}" y2="${l1y2.toFixed(1)}" stroke="${fillRail}" stroke-width="4.8" stroke-linecap="round"/>
                <line x1="${l2x1.toFixed(1)}" y1="${l2y1.toFixed(1)}" x2="${l2x2.toFixed(1)}" y2="${l2y2.toFixed(1)}" stroke="#1e293b" stroke-width="9.5" stroke-linecap="round"/>
                <line x1="${l2x1.toFixed(1)}" y1="${l2y1.toFixed(1)}" x2="${l2x2.toFixed(1)}" y2="${l2y2.toFixed(1)}" stroke="${fillRail}" stroke-width="4.8" stroke-linecap="round"/>
            </g>
        `;
    }

    function buildChuteSVG(x1, y1, x2, y2, idx, variant, isBW) {
        const geom = getChuteGeometry(x1, y1, x2, y2, idx);
        if (!geom) return '';
        const { p0, p1, p2, p3 } = geom;
        const pathD = `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} C ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}, ${p3.x.toFixed(1)} ${p3.y.toFixed(1)}`;

        if (variant === 'snake') {
            const bodyColor = isBW ? '#cbd5e1' : (idx % 2 === 0 ? '#ff4785' : '#ff7e33');
            const spotColor = isBW ? '#ffffff' : '#fef08a';
            const headAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI - 90;

            // Tapered body ribbon from thick neck (t=0) to pointed tail (t=1)
            const steps = 20;
            const leftPts = [];
            const rightPts = [];
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const pt = cubicBezierPoint(p0, p1, p2, p3, t);
                const tan = cubicBezierTangent(p0, p1, p2, p3, t);
                const mag = Math.hypot(tan.x, tan.y) || 1;
                const nx = -tan.y / mag;
                const ny = tan.x / mag;
                const radius = 10 * (1 - t * 0.78);
                leftPts.push(`${(pt.x + nx * radius).toFixed(1)},${(pt.y + ny * radius).toFixed(1)}`);
                rightPts.unshift(`${(pt.x - nx * radius).toFixed(1)},${(pt.y - ny * radius).toFixed(1)}`);
            }
            const polyPoints = leftPts.concat(rightPts).join(' ');

            return `
                <g class="link-group" data-link-idx="${idx}" opacity="0.95">
                    <polygon points="${polyPoints}" fill="${bodyColor}" stroke="#1e293b" stroke-width="3.5" stroke-linejoin="round"/>
                    <path d="${pathD}" fill="none" stroke="${spotColor}" stroke-width="5" stroke-dasharray="1 16" stroke-linecap="round"/>
                    <g transform="translate(${p0.x.toFixed(1)} ${p0.y.toFixed(1)}) rotate(${headAngle.toFixed(1)})">
                        <path d="M 0,-12 L 0,-24 L -4.5,-29 M 0,-24 L 4.5,-29" fill="none" stroke="${isBW ? '#1e293b' : '#ff4785'}" stroke-width="2.5" stroke-linecap="round"/>
                        <ellipse cx="0" cy="0" rx="12.5" ry="14" fill="${bodyColor}" stroke="#1e293b" stroke-width="3.2"/>
                        <circle cx="-4.8" cy="-3.5" r="3.2" fill="#ffffff" stroke="#1e293b" stroke-width="1.5"/>
                        <circle cx="4.8" cy="-3.5" r="3.2" fill="#ffffff" stroke="#1e293b" stroke-width="1.5"/>
                        <circle cx="-4.8" cy="-4.5" r="1.4" fill="#1e293b"/>
                        <circle cx="4.8" cy="-4.5" r="1.4" fill="#1e293b"/>
                    </g>
                </g>
            `;
        }

        const slideColors = ['#ff4785', '#ff7e33', '#1ea7fd'];
        const outerColor = isBW ? '#cbd5e1' : slideColors[idx % slideColors.length];
        const innerColor = isBW ? '#ffffff' : '#fff7ed';

        return `
            <g class="link-group" data-link-idx="${idx}" opacity="0.93">
                <path d="${pathD}" fill="none" stroke="#1e293b" stroke-width="26" stroke-linecap="round"/>
                <path d="${pathD}" fill="none" stroke="${outerColor}" stroke-width="19.5" stroke-linecap="round"/>
                <path d="${pathD}" fill="none" stroke="${innerColor}" stroke-width="10" stroke-linecap="round"/>
                <path d="${pathD}" fill="none" stroke="${outerColor}" stroke-width="2.8" stroke-dasharray="7 11" stroke-linecap="round"/>
                <circle cx="${p0.x.toFixed(1)}" cy="${p0.y.toFixed(1)}" r="7.5" fill="${outerColor}" stroke="#1e293b" stroke-width="2.8"/>
                <circle cx="${p3.x.toFixed(1)}" cy="${p3.y.toFixed(1)}" r="5.5" fill="#ffffff" stroke="#1e293b" stroke-width="2.8"/>
            </g>
        `;
    }

    function buildPathArrowSVG(num, totalTiles, cols, rows, cellW, cellH, padX, padY) {
        if (num >= totalTiles) return '';
        const c1 = getTileCoords(num, cols, rows);
        const c2 = getTileCoords(num + 1, cols, rows);
        const bx = padX + c1.col * cellW;
        const by = padY + c1.row * cellH;
        const nx = padX + c2.col * cellW;
        const ny = padY + c2.row * cellH;
        const mx = (bx + nx) / 2 + cellW / 2;
        const my = (by + ny) / 2 + cellH / 2;

        let path = '';
        if (c2.row < c1.row) {
            // Turning upward to next row
            path = `M ${mx - 6},${my + 3} L ${mx},${my - 4} L ${mx + 6},${my + 3}`;
        } else if (c2.col > c1.col) {
            // Moving right
            path = `M ${mx - 3},${my - 5} L ${mx + 4},${my} L ${mx - 3},${my + 5}`;
        } else {
            // Moving left
            path = `M ${mx + 3},${my - 5} L ${mx - 4},${my} L ${mx + 3},${my + 5}`;
        }

        return `
            <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="8.5" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
            <path d="${path}" fill="none" stroke="#1e293b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        `;
    }

    function buildBoardSVG({ forPrint = false, showAnswers = false } = {}) {
        const m = getBoardMetrics();
        const { cols, rows, cellW, cellH, padX, padY, boardW, boardH, svgW, svgH } = m;
        const N = state.totalTiles;
        const isBW = state.colorTheme === 'bw';
        const palette = TILE_PALETTES[state.colorTheme] || TILE_PALETTES.vibrant;

        const linkFromMap = new Map();
        state.links.forEach(l => linkFromMap.set(l.from, l));

        let tilesSVG = '';
        let labelsSVG = '';
        let arrowsSVG = '';

        for (let num = 1; num <= N; num++) {
            const { col, row } = getTileCoords(num, cols, rows);
            const x = padX + col * cellW;
            const y = padY + row * cellH;

            let fill = palette[(num - 1) % palette.length];
            if (num === 1) fill = isBW ? '#e2e8f0' : '#00d063';
            if (num === N) fill = isBW ? '#e2e8f0' : '#ff7e33';

            const isSelectedStart = !forPrint && state.editLinksMode && state.editLinkStart === num;
            const strokeCol = isSelectedStart ? '#ff4785' : '#1e293b';
            const strokeW = isSelectedStart ? 5 : 3;

            let promptObj = null;
            if (num > 1 && num < N && state.prompts.length > 0) {
                promptObj = state.prompts[(num - 2) % state.prompts.length];
            }
            const specialType = getEffectiveSpecial(num);
            const specialMeta = specialType ? BONUS_TYPES[specialType] : null;
            const hasAnswerRow = Boolean(showAnswers && promptObj && promptObj.answer);

            const badgeBg = (num === 1 || num === N) ? '#1e293b' : '#ffffff';
            const badgeText = (num === 1 || num === N) ? '#ffffff' : '#1e293b';

            let contentSVG = '';
            if (num === 1) {
                contentSVG = `
                    <text x="${x + cellW / 2}" y="${y + 44}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="21" fill="#1e293b">START</text>
                    <text x="${x + cellW / 2}" y="${y + 59}" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="9.5" fill="#1e293b">ROLL TO BEGIN</text>
                `;
            } else if (num === N) {
                contentSVG = `
                    <polygon points="${x + cellW / 2},${y + 18} ${x + cellW / 2 + 5},${y + 29} ${x + cellW / 2 + 16},${y + 30} ${x + cellW / 2 + 8},${y + 38} ${x + cellW / 2 + 10},${y + 49} ${x + cellW / 2},${y + 43} ${x + cellW / 2 - 10},${y + 49} ${x + cellW / 2 - 8},${y + 38} ${x + cellW / 2 - 16},${y + 30} ${x + cellW / 2 - 5},${y + 29}" fill="#fef08a" stroke="#1e293b" stroke-width="2"/>
                    <text x="${x + cellW / 2}" y="${y + cellH / 2 + 15}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="22" fill="#1e293b">FINISH!</text>
                    <text x="${x + cellW / 2}" y="${y + cellH / 2 + 31}" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="10" fill="#1e293b">WINNER</text>
                `;
            } else if (promptObj && promptObj.prompt) {
                const maxLines = hasAnswerRow ? 2 : (specialMeta ? 2 : 3);
                const fitted = fitTileText(promptObj.prompt, cols, cellW, maxLines);
                const lineH = fitted.fontSize + 2.5;
                const centerShift = hasAnswerRow ? -8 : (specialMeta ? 6 : 6);
                const startY = y + cellH / 2 + centerShift - ((fitted.lines.length - 1) * lineH) / 2;

                contentSVG = fitted.lines.map((ln, idx) =>
                    `<text x="${x + cellW / 2}" y="${(startY + idx * lineH).toFixed(1)}" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="${fitted.fontSize}" fill="#1e293b" paint-order="stroke" stroke="rgba(255,255,255,0.92)" stroke-width="5" stroke-linejoin="round">${escapeXml(ln)}</text>`
                ).join('');

                if (hasAnswerRow) {
                    const ansMax = cols >= 8 ? 14 : 16;
                    const ansClip = promptObj.answer.length > ansMax ? promptObj.answer.slice(0, ansMax - 1) + '…' : promptObj.answer;
                    contentSVG += `
                        <rect x="${x + 10}" y="${y + cellH - 25}" width="${cellW - 20}" height="19" rx="5.5" fill="#1e293b"/>
                        <text x="${x + cellW / 2}" y="${y + cellH - 12}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="11" fill="#00d063">${escapeXml(ansClip)}</text>
                    `;
                }
            } else {
                contentSVG = `
                    <text x="${x + cellW / 2}" y="${y + cellH / 2 + 12}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="33" fill="#1e293b" opacity="0.22">${num}</text>
                `;
            }

            const link = linkFromMap.get(num);
            let topRightBadges = '';
            if (link) {
                const lBg = link.type === 'ladder' ? (isBW ? '#ffffff' : '#00d063') : (isBW ? '#e2e8f0' : '#ff4785');
                const lFg = link.type === 'ladder' ? '#1e293b' : (isBW ? '#1e293b' : '#ffffff');
                const arrow = link.type === 'ladder' ? '▲' : '▼';
                topRightBadges = `
                    <rect x="${x + cellW - 44}" y="${y + 7}" width="37" height="19" rx="5.5" fill="${lBg}" stroke="#1e293b" stroke-width="2"/>
                    <text x="${x + cellW - 25.5}" y="${y + 20}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="10.5" fill="${lFg}">${arrow}${link.to}</text>
                `;
            } else if (specialMeta) {
                const sBg = isBW ? '#e2e8f0' : specialMeta.bg;
                const sFg = isBW ? '#1e293b' : specialMeta.fg;
                const bwW = specialMeta.badge.length > 7 ? 68 : 58;
                topRightBadges = `
                    <rect x="${x + cellW - bwW - 7}" y="${y + 7}" width="${bwW}" height="19" rx="5.5" fill="${sBg}" stroke="#1e293b" stroke-width="2"/>
                    <text x="${x + cellW - bwW / 2 - 7}" y="${y + 20}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="9" fill="${sFg}">${escapeXml(specialMeta.badge)}</text>
                `;
            }

            tilesSVG += `
                <g class="board-tile" data-tile="${num}">
                    <rect class="tile-rect" x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${fill}" stroke="${strokeCol}" stroke-width="${strokeW}"/>
                    <rect x="${x + 7}" y="${y + 7}" width="29" height="21" rx="5.5" fill="${badgeBg}" stroke="#1e293b" stroke-width="2"/>
                    <text x="${x + 21.5}" y="${y + 21.5}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="12.5" fill="${badgeText}">${num}</text>
                    ${topRightBadges}
                </g>
            `;
            labelsSVG += `<g pointer-events="none">${contentSVG}</g>`;

            if (state.showPathArrows && num < N) {
                arrowsSVG += buildPathArrowSVG(num, N, cols, rows, cellW, cellH, padX, padY);
            }
        }

        let linksSVG = '';
        state.links.forEach((link, idx) => {
            const p1 = getTileCenter(link.from, cols, rows, cellW, cellH, padX, padY);
            const p2 = getTileCenter(link.to, cols, rows, cellW, cellH, padX, padY);
            if (link.type === 'ladder') {
                linksSVG += buildLadderSVG(p1.x, p1.y, p2.x, p2.y, idx, isBW);
            } else {
                linksSVG += buildChuteSVG(p1.x, p1.y, p2.x, p2.y, idx, link.variant, isBW);
            }
        });

        let pulseSVG = '';
        if (!forPrint && state.lastSelectedTile >= 1 && state.lastSelectedTile <= N && !state.editLinksMode) {
            const hc = getTileCoords(state.lastSelectedTile, cols, rows);
            const hx = padX + hc.col * cellW;
            const hy = padY + hc.row * cellH;
            pulseSVG = `<rect x="${hx + 3}" y="${hy + 3}" width="${cellW - 6}" height="${cellH - 6}" rx="6" fill="none" stroke="#1ea7fd" stroke-width="4" opacity="0.6" pointer-events="none"/>`;
        }

        let tokensSVG = '';
        if (!forPrint) {
            const pCount = state.players.length;
            state.players.forEach((p, idx) => {
                const center = getTileCenter(p.pos, cols, rows, cellW, cellH, padX, padY);
                const off = getTokenOffset(idx, pCount);
                const isTurn = idx === state.currentTurn && !state.winner;
                const tx = center.x + off.dx;
                const ty = center.y + off.dy;
                tokensSVG += `
                    <g class="token-group" data-player-id="${p.id}" transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)})">
                        ${isTurn ? `<circle class="turn-halo" cx="0" cy="0" r="21" fill="none" stroke="${p.color}" stroke-width="3.5" stroke-dasharray="5 4" opacity="0.9"/>` : ''}
                        <circle cx="2" cy="4" r="15" fill="rgba(30,41,59,0.35)"/>
                        <circle cx="0" cy="0" r="15" fill="${p.color}" stroke="#1e293b" stroke-width="3.2"/>
                        <text x="0" y="4.5" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="12" fill="#ffffff">${escapeXml(p.label)}</text>
                    </g>
                `;
            });
        }

        return `
            <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Slides and Ladders board with ${N} tiles" xmlns="http://www.w3.org/2000/svg" class="${state.editLinksMode && !forPrint ? 'edit-mode' : ''}">
                <rect x="${padX - 4}" y="${padY - 4}" width="${boardW + 8}" height="${boardH + 8}" rx="14" fill="#1e293b"/>
                <g id="tiles-layer">${tilesSVG}</g>
                <g id="arrows-layer" pointer-events="none" opacity="0.9">${arrowsSVG}</g>
                <g id="links-layer" opacity="0.82">${linksSVG}</g>
                <g id="labels-layer">${labelsSVG}</g>
                <g id="pulse-layer">${pulseSVG}</g>
                <g id="tokens-layer">${tokensSVG}</g>
            </svg>
        `;
    }

    function renderBoard() {
        const wrapper = document.getElementById('svg-wrapper');
        if (!wrapper) return;
        wrapper.innerHTML = buildBoardSVG({ forPrint: false, showAnswers: state.showAnswers });
        wrapper.style.transform = `scale(${state.zoom})`;
        const zoomReset = document.getElementById('zoom-reset');
        if (zoomReset) zoomReset.textContent = `${Math.round(state.zoom * 100)}%`;

        updateBoardStatsUI();

        wrapper.querySelectorAll('.board-tile').forEach(g => {
            g.addEventListener('click', () => {
                handleTileClick(Number(g.dataset.tile));
            });
        });

        wrapper.querySelectorAll('.link-group').forEach(g => {
            g.addEventListener('click', (e) => {
                if (!state.editLinksMode) return;
                e.stopPropagation();
                const idx = Number(g.dataset.linkIdx);
                const removed = state.links.splice(idx, 1)[0];
                if (removed) {
                    playSound('pop');
                    showToast(`Removed ${removed.type === 'ladder' ? 'Ladder' : 'Slide'} (${removed.from} to ${removed.to})`, 'warning');
                    renderBoard();
                    persistState();
                }
            });
        });
    }

    function updateBoardStatsUI() {
        const ladderCount = state.links.filter(l => l.type === 'ladder').length;
        const chuteCount = state.links.filter(l => l.type === 'chute').length;
        let bonusCount = 0;
        for (let n = 2; n < state.totalTiles; n++) {
            if (getEffectiveSpecial(n)) bonusCount++;
        }
        document.getElementById('stat-ladders').textContent = ladderCount;
        document.getElementById('stat-chutes').textContent = chuteCount;
        document.getElementById('stat-bonus').textContent = bonusCount;
        document.getElementById('tile-count-badge').textContent = `${state.totalTiles} tiles`;
    }

    function updateTokenPositionImmediate(playerIdx, x, y) {
        const p = state.players[playerIdx];
        if (!p) return;
        const g = document.querySelector(`#svg-wrapper svg .token-group[data-player-id="${p.id}"]`);
        if (g) {
            g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        }
    }

    function animateTokenAlong(playerIdx, pointAtT, durationMs) {
        return new Promise((resolve) => {
            const p = state.players[playerIdx];
            const g = p ? document.querySelector(`#svg-wrapper svg .token-group[data-player-id="${p.id}"]`) : null;
            if (!g) {
                resolve();
                return;
            }
            const start = performance.now();
            const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

            const frame = (now) => {
                const rawT = Math.min(1, (now - start) / Math.max(16, durationMs));
                const t = easeInOut(rawT);
                const pt = pointAtT(t, rawT);
                g.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
                if (rawT < 1) {
                    requestAnimationFrame(frame);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(frame);
        });
    }

    // ============================
    // TILE INTERACTION & LINK EDITING
    // ============================
    function handleTileClick(num) {
        if (state.isRolling) return;

        if (state.editLinksMode) {
            if (num === 1 || num === state.totalTiles) {
                showToast('Cannot attach a ladder or slide to START or FINISH.', 'warning');
                return;
            }
            if (state.editLinkStart === null) {
                const occupiedAsDest = state.links.some(l => l.to === num);
                if (occupiedAsDest) {
                    showToast(`Square #${num} is already a link landing spot. Pick another start square.`, 'warning');
                    return;
                }
                state.editLinkStart = num;
                playSound('pop');
                document.getElementById('edit-links-hint').textContent = `Start: #${num}. Now click destination square (different from #${num}).`;
                renderBoard();
            } else if (state.editLinkStart === num) {
                state.editLinkStart = null;
                document.getElementById('edit-links-hint').textContent = 'Click START square, then END square (low to high = Ladder, high to low = Slide).';
                renderBoard();
            } else {
                const from = state.editLinkStart;
                const to = num;
                const destIsStartOfAnother = state.links.some(l => l.from === to);
                if (destIsStartOfAnother) {
                    showToast(`Destination #${to} already starts another link — avoid chain loops.`, 'warning');
                    return;
                }
                const type = from < to ? 'ladder' : 'chute';
                state.links = state.links.filter(l => l.from !== from);
                const existingChutes = state.links.filter(l => l.type === 'chute').length;
                let variant = 'ladder';
                if (type === 'chute') {
                    if (state.slideStyle === 'snakes') variant = 'snake';
                    else if (state.slideStyle === 'mixed') variant = (existingChutes % 2 === 0) ? 'chute' : 'snake';
                    else variant = 'chute';
                }
                state.links.push({ from, to, type, variant });
                state.editLinkStart = null;
                playSound(type === 'ladder' ? 'ladder' : 'chute');
                showToast(`Added ${type === 'ladder' ? 'Ladder' : 'Slide'}: #${from} to #${to}`, 'success');
                document.getElementById('edit-links-hint').textContent = 'Click START square, then END square (low to high = Ladder, high to low = Slide).';
                renderBoard();
                persistState();
            }
            return;
        }

        state.lastSelectedTile = num;
        updateActivePromptCard(num);
        openTileInspectModal(num);
    }

    // ============================
    // PROMPT CARD, SPOTLIGHT & TIMER
    // ============================
    function getTilePromptData(num) {
        if (num === 1) return { prompt: 'START — Roll the die to begin your adventure!', answer: '', special: null };
        if (num === state.totalTiles) return { prompt: 'FINISH! You reached the top and won the game!', answer: '', special: null };
        const special = getEffectiveSpecial(num);
        if (state.prompts.length === 0) {
            return {
                prompt: special ? BONUS_TYPES[special].title : `Square #${num} — Classic board space!`,
                answer: '',
                special
            };
        }
        const obj = state.prompts[(num - 2) % state.prompts.length];
        return {
            prompt: obj.prompt || (special ? BONUS_TYPES[special].title : `Square #${num}`),
            answer: obj.answer || '',
            special
        };
    }

    function updateActivePromptCard(num, linkNote = '') {
        const data = getTilePromptData(num);
        document.getElementById('card-tile-label').textContent = `Square #${num}`;
        document.getElementById('card-prompt-text').textContent = data.prompt || `Square #${num}`;

        const badge = document.getElementById('card-link-badge');
        const noteText = linkNote || (data.special ? BONUS_TYPES[data.special].badge : '');
        if (noteText) {
            badge.textContent = noteText;
            badge.classList.remove('bg-green', 'text-dark', 'bg-pink', 'text-white', 'bg-orange', 'bg-blue', 'hidden');
            if (noteText.includes('Ladder') || noteText.includes('+2')) {
                badge.classList.add('bg-green', 'text-dark');
            } else if (noteText.includes('ROLL')) {
                badge.classList.add('bg-orange', 'text-dark');
            } else if (noteText.includes('REST')) {
                badge.classList.add('bg-blue', 'text-white');
            } else {
                badge.classList.add('bg-pink', 'text-white');
            }
        } else {
            badge.classList.add('hidden');
        }

        const ansRow = document.getElementById('card-answer-row');
        const ansText = document.getElementById('card-answer-text');
        const revBtn = document.getElementById('card-reveal-btn');
        if (data.answer) {
            ansRow.classList.remove('hidden');
            ansRow.classList.add('flex');
            ansText.textContent = `Answer: ${data.answer}`;
            ansText.classList.toggle('hidden', !state.showAnswers);
            revBtn.classList.toggle('hidden', state.showAnswers);
        } else {
            ansRow.classList.add('hidden');
            ansRow.classList.remove('flex');
        }
    }

    function stopSpotlightTimer() {
        clearInterval(modalTimerInterval);
        modalTimerInterval = null;
        modalTimerRunning = false;
        const label = document.getElementById('modal-timer-label');
        if (label) label.textContent = 'Start 15s Timer';
    }

    function resetSpotlightTimer(seconds = 15) {
        stopSpotlightTimer();
        modalTimerRemaining = seconds;
        const disp = document.getElementById('modal-timer-display');
        const bar = document.getElementById('modal-timer-bar');
        if (disp) disp.textContent = `${seconds}s`;
        if (bar) {
            bar.style.width = '100%';
            bar.classList.remove('bg-pink', 'bg-orange');
            bar.classList.add('bg-green');
        }
    }

    function toggleSpotlightTimer() {
        if (modalTimerRunning) {
            stopSpotlightTimer();
            const label = document.getElementById('modal-timer-label');
            if (label) label.textContent = `Resume (${modalTimerRemaining}s)`;
            return;
        }
        if (modalTimerRemaining <= 0) {
            modalTimerRemaining = 15;
        }
        modalTimerRunning = true;
        const label = document.getElementById('modal-timer-label');
        if (label) label.textContent = 'Pause Timer';
        playSound('pop');

        modalTimerInterval = setInterval(() => {
            modalTimerRemaining = Math.max(0, modalTimerRemaining - 1);
            const disp = document.getElementById('modal-timer-display');
            const bar = document.getElementById('modal-timer-bar');
            if (disp) disp.textContent = `${modalTimerRemaining}s`;
            if (bar) {
                const pct = Math.round((modalTimerRemaining / 15) * 100);
                bar.style.width = `${pct}%`;
                bar.classList.remove('bg-green', 'bg-orange', 'bg-pink');
                if (modalTimerRemaining <= 3) bar.classList.add('bg-pink');
                else if (modalTimerRemaining <= 7) bar.classList.add('bg-orange');
                else bar.classList.add('bg-green');
            }
            if (modalTimerRemaining > 0 && modalTimerRemaining <= 3) {
                playSound('tick');
            }
            if (modalTimerRemaining <= 0) {
                stopSpotlightTimer();
                playSound('chute');
                if (label) label.textContent = 'Time Up! Restart';
            }
        }, 1000);
    }

    function configureTileModalCommon(num) {
        const data = getTilePromptData(num);
        modalEditingTile = num;
        resetSpotlightTimer(15);

        document.getElementById('modal-view-pane').classList.remove('hidden');
        document.getElementById('modal-edit-pane').classList.add('hidden');
        document.getElementById('modal-tile-num').textContent = num;
        document.getElementById('modal-tile-title').textContent =
            num === 1 ? 'Start Square' : (num === state.totalTiles ? 'Finish Square' : 'Square Prompt');
        document.getElementById('modal-tile-sub').textContent =
            data.special ? BONUS_TYPES[data.special].title : 'Classroom Spotlight';
        document.getElementById('modal-prompt-text').textContent = data.prompt;

        const editBtn = document.getElementById('modal-edit-tile-btn');
        editBtn.classList.toggle('hidden', num <= 1 || num >= state.totalTiles);

        const ansBox = document.getElementById('modal-answer-box');
        const revBtn = document.getElementById('modal-reveal-btn');
        document.getElementById('modal-answer-val').textContent = data.answer || '';

        if (data.answer) {
            ansBox.classList.toggle('hidden', !state.showAnswers);
            revBtn.classList.toggle('hidden', state.showAnswers);
        } else {
            ansBox.classList.add('hidden');
            revBtn.classList.add('hidden');
        }
    }

    function openTileInspectModal(num) {
        pendingChallenge = null;
        configureTileModalCommon(num);

        const teamPill = document.getElementById('modal-team-pill');
        teamPill.classList.add('hidden');

        const link = state.links.find(l => l.from === num);
        const special = getEffectiveSpecial(num);
        const linkPrev = document.getElementById('modal-link-preview');
        linkPrev.classList.remove('bg-green/20', 'bg-pink/20', 'bg-orange/20', 'text-dark', 'dark:text-white', 'inline-flex');
        if (link) {
            linkPrev.textContent = link.type === 'ladder'
                ? `Ladder on this square: #${link.from} climbs to #${link.to}`
                : `Slide on this square: #${link.from} goes down to #${link.to}`;
            linkPrev.classList.add(link.type === 'ladder' ? 'bg-green/20' : 'bg-pink/20', 'inline-flex');
            linkPrev.classList.remove('hidden');
        } else if (special) {
            linkPrev.textContent = `${BONUS_TYPES[special].badge}: ${BONUS_TYPES[special].desc}`;
            linkPrev.classList.add('bg-orange/20', 'inline-flex');
            linkPrev.classList.remove('hidden');
        } else {
            linkPrev.classList.add('hidden');
        }

        document.getElementById('modal-inspect-actions').classList.remove('hidden');
        document.getElementById('modal-inspect-actions').classList.add('flex');
        const challActions = document.getElementById('modal-challenge-actions');
        challActions.classList.add('hidden');
        challActions.classList.remove('flex');

        openModal('tileModal');
        playSound('pop');
    }

    function openChallengeModal(challengeCtx) {
        pendingChallenge = challengeCtx;
        const { playerIdx, landedTile, linkAfter, specialAfter } = challengeCtx;
        const player = state.players[playerIdx];
        configureTileModalCommon(landedTile);

        const teamPill = document.getElementById('modal-team-pill');
        teamPill.textContent = `${player.name} landed on #${landedTile}`;
        teamPill.style.backgroundColor = player.light;
        teamPill.style.color = '#1e293b';
        teamPill.classList.remove('hidden');

        const linkPrev = document.getElementById('modal-link-preview');
        linkPrev.classList.remove('bg-green/20', 'bg-pink/20', 'bg-orange/20', 'inline-flex');
        const correctBtn = document.getElementById('modal-correct-btn');
        const missBtn = document.getElementById('modal-miss-btn');

        if (linkAfter && linkAfter.type === 'ladder') {
            linkPrev.textContent = `Answer correctly to climb Ladder #${linkAfter.from} to #${linkAfter.to}!`;
            linkPrev.classList.add('bg-green/20', 'inline-flex');
            linkPrev.classList.remove('hidden');
            correctBtn.innerHTML = `<i data-lucide="arrow-up-right" class="w-4 h-4"></i> Climb to #${linkAfter.to}`;
            missBtn.innerHTML = `<i data-lucide="x-circle" class="w-4 h-4"></i> Miss (Step Back)`;
        } else if (linkAfter && linkAfter.type === 'chute') {
            linkPrev.textContent = `Answer correctly to stay safe! Miss & slide down to #${linkAfter.to}!`;
            linkPrev.classList.add('bg-pink/20', 'inline-flex');
            linkPrev.classList.remove('hidden');
            correctBtn.innerHTML = `<i data-lucide="shield-check" class="w-4 h-4"></i> Dodge Slide!`;
            missBtn.innerHTML = `<i data-lucide="trending-down" class="w-4 h-4"></i> Miss (Slide #${linkAfter.to})`;
        } else if (specialAfter) {
            linkPrev.textContent = `${BONUS_TYPES[specialAfter].badge}: ${BONUS_TYPES[specialAfter].desc}`;
            linkPrev.classList.add('bg-orange/20', 'inline-flex');
            linkPrev.classList.remove('hidden');
            correctBtn.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4"></i> Correct!`;
            missBtn.innerHTML = `<i data-lucide="x-circle" class="w-4 h-4"></i> Miss (Step Back)`;
        } else {
            linkPrev.classList.add('hidden');
            correctBtn.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4"></i> Correct (Stay)`;
            missBtn.innerHTML = `<i data-lucide="x-circle" class="w-4 h-4"></i> Miss (Step Back)`;
        }
        hydrateIcons(correctBtn);
        hydrateIcons(missBtn);

        document.getElementById('modal-inspect-actions').classList.add('hidden');
        document.getElementById('modal-inspect-actions').classList.remove('flex');
        const challActions = document.getElementById('modal-challenge-actions');
        challActions.classList.remove('hidden');
        challActions.classList.add('flex');

        openModal('tileModal');
    }

    function openInlineTileEditor() {
        if (!modalEditingTile || modalEditingTile <= 1 || modalEditingTile >= state.totalTiles) return;
        stopSpotlightTimer();
        const data = getTilePromptData(modalEditingTile);
        const promptObj = state.prompts.length > 0 ? state.prompts[(modalEditingTile - 2) % state.prompts.length] : null;
        const prefixTag = data.special ? `${BONUS_TYPES[data.special].tag} ` : '';
        document.getElementById('modal-edit-prompt').value = promptObj ? `${prefixTag}${promptObj.prompt}` : '';
        document.getElementById('modal-edit-answer').value = promptObj ? (promptObj.answer || '') : '';
        document.getElementById('modal-view-pane').classList.add('hidden');
        document.getElementById('modal-edit-pane').classList.remove('hidden');
        document.getElementById('modal-edit-prompt').focus();
    }

    function saveInlineTileEdit() {
        if (!modalEditingTile || modalEditingTile <= 1 || modalEditingTile >= state.totalTiles) return;
        const newPromptRaw = document.getElementById('modal-edit-prompt').value.trim();
        const newAnsRaw = document.getElementById('modal-edit-answer').value.trim();

        const inp = document.getElementById('prompt-input');
        const lines = inp.value.trim() ? inp.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
        const targetIdx = modalEditingTile - 2;
        while (lines.length <= targetIdx) {
            lines.push(`Square #${lines.length + 2}`);
        }
        lines[targetIdx] = newAnsRaw ? `${newPromptRaw || `Square #${modalEditingTile}`} | ${newAnsRaw}` : (newPromptRaw || `Square #${modalEditingTile}`);
        inp.value = lines.join('\n');

        buildBoard({ keepLinks: true, preserveBonus: true });
        configureTileModalCommon(modalEditingTile);
        updateActivePromptCard(modalEditingTile);
        playSound('pop');
        showToast(`Updated Square #${modalEditingTile}`, 'success');
    }

    function closeTileModal() {
        stopSpotlightTimer();
        if (pendingChallenge) {
            const ctx = pendingChallenge;
            pendingChallenge = null;
            closeModal('tileModal');
            // Neutral safe fallback when dismissed via X or Esc
            finalizeTurnProgression(ctx.playerIdx, ctx.rolledSix, false);
            return;
        }
        closeModal('tileModal');
    }

    // ============================
    // PLAYERS, RULES & GAMEPLAY
    // ============================
    function initPlayers(count, { names = null, skipRender = false } = {}) {
        state.playerCount = Math.min(6, Math.max(2, count));
        state.players = [];
        for (let i = 0; i < state.playerCount; i++) {
            const preset = PLAYER_COLORS[i];
            const customName = Array.isArray(names) && typeof names[i] === 'string' && names[i].trim()
                ? names[i].trim()
                : preset.name;
            state.players.push({
                id: i,
                name: customName,
                color: preset.color,
                light: preset.light,
                label: preset.label,
                pos: 1,
                skipTurns: 0
            });
        }
        state.currentTurn = 0;
        state.winner = null;
        state.history = [];
        updateUndoButtonUI();
        if (!skipRender) {
            renderPlayersUI();
            renderBoard();
        }
    }

    function updateTurnBadge() {
        const badge = document.getElementById('turn-badge');
        if (!badge) return;
        if (state.winner) {
            badge.textContent = `${state.winner.name} Wins!`;
        } else {
            badge.textContent = `${state.players[state.currentTurn]?.name || 'Team 1'}'s Turn`;
        }
    }

    function updatePlayerStatsUI() {
        const list = document.getElementById('players-list');
        if (!list) return;
        const cards = list.querySelectorAll('[data-player-card]');
        if (cards.length !== state.players.length) {
            renderPlayersUI();
            return;
        }
        state.players.forEach((p, idx) => {
            const card = cards[idx];
            const isTurn = idx === state.currentTurn && !state.winner;
            card.className = `p-2 rounded-xl border-2 transition-all space-y-1 ${
                isTurn
                    ? 'border-dark dark:border-white bg-orange/15 shadow-hard-sm scale-[1.01]'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'
            }`;
            const posEl = card.querySelector('[data-player-pos]');
            if (posEl) posEl.textContent = `${p.pos}/${state.totalTiles}`;
            const skipBadge = card.querySelector('[data-player-skip]');
            if (skipBadge) skipBadge.classList.toggle('hidden', !(p.skipTurns > 0));
        });
        updateTurnBadge();
    }

    function renderPlayersUI() {
        const list = document.getElementById('players-list');
        if (!list) return;
        list.innerHTML = '';

        state.players.forEach((p, idx) => {
            const isTurn = idx === state.currentTurn && !state.winner;
            const card = document.createElement('div');
            card.setAttribute('data-player-card', String(idx));
            card.className = `p-2 rounded-xl border-2 transition-all space-y-1 ${
                isTurn
                    ? 'border-dark dark:border-white bg-orange/15 shadow-hard-sm scale-[1.01]'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'
            }`;
            card.innerHTML = `
                <div class="flex items-center gap-1.5">
                    <span class="w-6 h-6 rounded-full border-2 border-dark text-white font-heading font-bold text-[10px] flex items-center justify-center shrink-0" style="background:${p.color}">${escapeHtml(p.label)}</span>
                    <input type="text" data-player-name="${idx}" value="${escapeHtml(p.name)}" aria-label="Team ${idx + 1} name"
                        class="flex-1 min-w-0 bg-transparent text-xs font-extrabold text-dark dark:text-white focus:outline-none truncate">
                    <span data-player-skip class="${p.skipTurns > 0 ? '' : 'hidden '}px-1 py-0.5 rounded bg-blue text-white text-[8px] font-title font-bold uppercase shrink-0">SKIP</span>
                </div>
                <div class="flex items-center justify-between gap-1 pl-0.5">
                    <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">Sq. <span data-player-pos class="text-dark dark:text-white font-mono">${p.pos}/${state.totalTiles}</span></span>
                    <div class="flex items-center gap-0.5">
                        <button type="button" data-nudge="${idx}" data-delta="-1" title="Step back 1 square"
                            class="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-dark/40 dark:border-slate-500 text-[9px] font-mono font-bold hover:bg-pink hover:text-white transition-colors">-1</button>
                        <button type="button" data-nudge="${idx}" data-delta="1" title="Step forward 1 square"
                            class="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-dark/40 dark:border-slate-500 text-[9px] font-mono font-bold hover:bg-green hover:text-dark transition-colors">+1</button>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });

        list.querySelectorAll('input[data-player-name]').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const idx = Number(e.target.dataset.playerName);
                if (!state.players[idx]) return;
                state.players[idx].name = e.target.value || `Team ${idx + 1}`;
                state.savedPlayerNames = state.players.map(p => p.name);
                updateTurnBadge();
                persistState();
            });
        });

        list.querySelectorAll('button[data-nudge]').forEach(btn => {
            btn.addEventListener('click', () => {
                nudgePlayer(Number(btn.dataset.nudge), Number(btn.dataset.delta));
            });
        });

        document.querySelectorAll('.pcount-btn').forEach(btn => {
            const c = Number(btn.dataset.pcount);
            btn.className = `pcount-btn px-2 py-0.5 rounded-md border-2 border-dark text-[10px] font-extrabold transition-colors ${
                c === state.playerCount ? 'bg-blue text-white' : 'bg-white dark:bg-slate-800 text-dark dark:text-white'
            }`;
        });
        updateTurnBadge();
    }

    function updateRulesUI() {
        const applyBtn = (id, active, activeBg) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.setAttribute('aria-pressed', String(active));
            btn.classList.remove('bg-blue', 'text-white', 'bg-green', 'text-dark', 'bg-orange', 'bg-white', 'dark:bg-slate-800');
            if (active) {
                btn.classList.add(...activeBg.split(' '));
            } else {
                btn.classList.add('bg-white', 'dark:bg-slate-800');
            }
        };
        applyBtn('rule-challenge-btn', state.challengeMode, 'bg-green text-dark');
        applyBtn('rule-roll6-btn', state.roll6ExtraTurn, 'bg-blue text-white');
        applyBtn('rule-exact-btn', state.exactFinish, 'bg-orange text-dark');
    }

    function pushHistory() {
        state.history.push({
            players: state.players.map(p => ({ ...p })),
            currentTurn: state.currentTurn,
            winnerId: state.winner ? state.winner.id : null,
            lastSelectedTile: state.lastSelectedTile,
            statusMsg: document.getElementById('game-status-msg')?.textContent || ''
        });
        if (state.history.length > 20) state.history.shift();
        updateUndoButtonUI();
    }

    function updateUndoButtonUI() {
        const btn = document.getElementById('undo-move-btn');
        if (btn) btn.disabled = state.history.length === 0 || state.isRolling;
    }

    function undoLastMove() {
        if (state.isRolling || state.history.length === 0) return;
        const snap = state.history.pop();
        state.players = snap.players.map(p => ({ ...p }));
        state.currentTurn = snap.currentTurn;
        state.winner = snap.winnerId !== null ? (state.players.find(p => p.id === snap.winnerId) || null) : null;
        state.lastSelectedTile = snap.lastSelectedTile || 1;
        document.getElementById('game-status-msg').textContent = snap.statusMsg || 'Undid last move.';
        closeModal('winModal');
        updateActivePromptCard(state.lastSelectedTile);
        renderPlayersUI();
        renderBoard();
        updateUndoButtonUI();
        playSound('pop');
        showToast('Reverted last move', 'info');
    }

    function nudgePlayer(idx, delta) {
        if (state.isRolling || !state.players[idx]) return;
        const p = state.players[idx];
        const nextPos = Math.max(1, Math.min(state.totalTiles, p.pos + delta));
        if (nextPos === p.pos) return;
        pushHistory();
        p.pos = nextPos;
        if (p.pos >= state.totalTiles) {
            state.winner = p;
        } else if (state.winner && state.winner.id === p.id) {
            state.winner = null;
        }
        state.lastSelectedTile = p.pos;
        updateActivePromptCard(p.pos);
        updatePlayerStatsUI();
        renderBoard();
        playSound('hop');
        if (state.winner) triggerVictory(p);
    }

    function renderDiceFace(val) {
        const pipsMap = {
            1: [[50, 50]],
            2: [[28, 28], [72, 72]],
            3: [[28, 28], [50, 50], [72, 72]],
            4: [[28, 28], [72, 28], [28, 72], [72, 72]],
            5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
            6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]]
        };
        const pips = pipsMap[val] || pipsMap[1];
        const color = val === 6 ? '#ff4785' : '#1e293b';
        document.getElementById('dice-face').innerHTML = `
            <svg viewBox="0 0 100 100" class="w-10 h-10">
                ${pips.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="10.5" fill="${color}"/>`).join('')}
            </svg>
        `;
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function animateHopStep(playerIdx, fromTile, toTile) {
        const m = getBoardMetrics();
        const off = getTokenOffset(playerIdx, state.players.length);
        const a = getTileCenter(fromTile, m.cols, m.rows, m.cellW, m.cellH, m.padX, m.padY);
        const b = getTileCenter(toTile, m.cols, m.rows, m.cellW, m.cellH, m.padX, m.padY);
        const pStart = { x: a.x + off.dx, y: a.y + off.dy };
        const pEnd = { x: b.x + off.dx, y: b.y + off.dy };

        await animateTokenAlong(playerIdx, (t) => ({
            x: pStart.x + (pEnd.x - pStart.x) * t,
            y: pStart.y + (pEnd.y - pStart.y) * t - 16 * Math.sin(Math.PI * t)
        }), 200);
        playSound('hop');
    }

    async function animateLinkTravel(playerIdx, link, linkIdx) {
        const m = getBoardMetrics();
        const off = getTokenOffset(playerIdx, state.players.length);
        const p1 = getTileCenter(link.from, m.cols, m.rows, m.cellW, m.cellH, m.padX, m.padY);
        const p2 = getTileCenter(link.to, m.cols, m.rows, m.cellW, m.cellH, m.padX, m.padY);

        if (link.type === 'ladder') {
            playSound('ladder');
            const start = { x: p1.x + off.dx, y: p1.y + off.dy };
            const end = { x: p2.x + off.dx, y: p2.y + off.dy };
            await animateTokenAlong(playerIdx, (t) => ({
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t
            }), 520);
        } else {
            playSound('chute');
            const geom = getChuteGeometry(p1.x, p1.y, p2.x, p2.y, Math.max(0, linkIdx));
            if (geom) {
                const startPt = { x: p1.x + off.dx, y: p1.y + off.dy };
                const endPt = { x: p2.x + off.dx, y: p2.y + off.dy };
                await animateTokenAlong(playerIdx, (t) => {
                    const curve = cubicBezierPoint(geom.p0, geom.p1, geom.p2, geom.p3, t);
                    // Blend offset smoothly at ends so token settles into slot cleanly
                    const blend = Math.sin(Math.PI * t);
                    return {
                        x: (1 - blend) * (startPt.x + (endPt.x - startPt.x) * t) + blend * curve.x,
                        y: (1 - blend) * (startPt.y + (endPt.y - startPt.y) * t) + blend * curve.y
                    };
                }, 620);
            }
        }
    }

    function advanceActiveTurnIndex() {
        const total = state.players.length;
        for (let guard = 0; guard < total + 1; guard++) {
            state.currentTurn = (state.currentTurn + 1) % total;
            const nextP = state.players[state.currentTurn];
            if (nextP.skipTurns > 0) {
                nextP.skipTurns--;
                showToast(`${nextP.name} skips this turn!`, 'info');
            } else {
                break;
            }
        }
    }

    function triggerVictory(player) {
        state.winner = player;
        playSound('win');
        document.getElementById('game-status-msg').textContent = `${player.name} reached #${state.totalTiles} and won!`;
        showToast(`${player.name} wins the game!`, 'success');
        if (typeof confetti === 'function') {
            confetti({ particleCount: 95, spread: 75, origin: { y: 0.6 } });
        }
        document.getElementById('win-player-name').textContent = `${player.name} Wins!`;
        document.getElementById('win-stats-text').textContent = `Reached finish square #${state.totalTiles} with ${state.players.length} teams playing.`;
        openModal('winModal');
        renderPlayersUI();
        renderBoard();
    }

    async function applySpecialTileEffect(playerIdx, specialType) {
        const player = state.players[playerIdx];
        const statusMsg = document.getElementById('game-status-msg');
        let extraTurn = false;

        if (!specialType) return { extraTurn };

        if (specialType === 'plus2') {
            playSound('bonus');
            const target = Math.min(state.totalTiles, player.pos + 2);
            showToast(`${player.name}: +2 Boost!`, 'success');
            statusMsg.textContent = `${player.name} boosted forward +2 to #${target}!`;
            for (let s = player.pos + 1; s <= target; s++) {
                await animateHopStep(playerIdx, player.pos, s);
                player.pos = s;
                updatePlayerStatsUI();
            }
        } else if (specialType === 'back2') {
            playSound('wrong');
            const target = Math.max(1, player.pos - 2);
            showToast(`${player.name}: Slip back to #${target}!`, 'warning');
            statusMsg.textContent = `${player.name} slipped back to #${target}!`;
            for (let s = player.pos - 1; s >= target; s--) {
                await animateHopStep(playerIdx, player.pos, s);
                player.pos = s;
                updatePlayerStatsUI();
            }
        } else if (specialType === 'roll_again') {
            playSound('bonus');
            extraTurn = true;
            showToast(`${player.name}: Free Bonus Roll!`, 'success');
            statusMsg.textContent = `${player.name} gets an extra roll!`;
        } else if (specialType === 'skip') {
            playSound('wrong');
            player.skipTurns += 1;
            showToast(`${player.name} will skip their next turn.`, 'warning');
            statusMsg.textContent = `${player.name} must rest next turn.`;
        }
        return { extraTurn };
    }

    function finalizeTurnProgression(playerIdx, rolledSix, bonusExtraTurn) {
        const player = state.players[playerIdx];
        const statusMsg = document.getElementById('game-status-msg');

        state.lastSelectedTile = player.pos;
        state.isRolling = false;
        document.getElementById('roll-dice-btn').disabled = false;

        if (player.pos >= state.totalTiles) {
            updateUndoButtonUI();
            triggerVictory(player);
            return;
        }

        if (bonusExtraTurn || (state.roll6ExtraTurn && rolledSix)) {
            if (state.roll6ExtraTurn && rolledSix && !bonusExtraTurn) {
                showToast(`${player.name} rolled a 6 — Bonus Turn!`, 'info');
                statusMsg.textContent = `Rolled 6! ${player.name} rolls again.`;
            }
            // Keep state.currentTurn on same team
        } else {
            advanceActiveTurnIndex();
        }

        updateUndoButtonUI();
        renderPlayersUI();
        renderBoard();
    }

    async function resolveChallengeOutcome(isCorrect) {
        if (!pendingChallenge) return;
        const ctx = pendingChallenge;
        pendingChallenge = null;
        stopSpotlightTimer();
        closeModal('tileModal');

        const { playerIdx, prevPos, rolledSix, linkAfter, specialAfter } = ctx;
        const player = state.players[playerIdx];
        const statusMsg = document.getElementById('game-status-msg');
        let bonusTurn = false;
        let linkNote = '';

        state.isRolling = true;
        document.getElementById('roll-dice-btn').disabled = true;

        if (isCorrect) {
            playSound('bonus');
            if (linkAfter && linkAfter.type === 'ladder') {
                const idx = state.links.indexOf(linkAfter);
                await sleep(160);
                await animateLinkTravel(playerIdx, linkAfter, idx);
                player.pos = linkAfter.to;
                linkNote = `Ladder #${linkAfter.from} to #${linkAfter.to}`;
                statusMsg.textContent = `${player.name} answered right & climbed to #${linkAfter.to}!`;
                showToast(`${player.name} climbed Ladder #${linkAfter.from} to #${linkAfter.to}!`, 'success');
            } else if (linkAfter && linkAfter.type === 'chute') {
                linkNote = `Safe from Slide #${linkAfter.from}!`;
                statusMsg.textContent = `${player.name} dodged Slide #${linkAfter.from}!`;
                showToast(`${player.name} answered correctly & dodged the slide!`, 'success');
            } else {
                statusMsg.textContent = `${player.name} answered correctly on #${player.pos}!`;
            }

            if (specialAfter) {
                const res = await applySpecialTileEffect(playerIdx, specialAfter);
                if (res.extraTurn) bonusTurn = true;
            }
        } else {
            playSound('wrong');
            if (linkAfter && linkAfter.type === 'chute') {
                const idx = state.links.indexOf(linkAfter);
                await sleep(160);
                await animateLinkTravel(playerIdx, linkAfter, idx);
                player.pos = linkAfter.to;
                linkNote = `Slide #${linkAfter.from} to #${linkAfter.to}`;
                statusMsg.textContent = `${player.name} missed & slid to #${linkAfter.to}!`;
                showToast(`${player.name} slid down to #${linkAfter.to}!`, 'warning');
            } else if (player.pos > prevPos) {
                const target = Math.max(1, prevPos);
                statusMsg.textContent = `${player.name} missed — stepping back to #${target}.`;
                await animateHopStep(playerIdx, player.pos, target);
                player.pos = target;
            }
        }

        updateActivePromptCard(player.pos, linkNote);
        finalizeTurnProgression(playerIdx, rolledSix, bonusTurn);
    }

    async function rollDice() {
        if (state.isRolling || pendingChallenge) return;
        if (state.winner) {
            resetGameCounters({ silent: true });
        }

        pushHistory();
        state.isRolling = true;
        updateUndoButtonUI();
        const rollBtn = document.getElementById('roll-dice-btn');
        const diceEl = document.getElementById('dice-face');
        rollBtn.disabled = true;
        diceEl.classList.add('dice-rolling');
        playSound('dice');

        let finalVal = 1;
        for (let i = 0; i < 8; i++) {
            finalVal = 1 + Math.floor(Math.random() * 6);
            renderDiceFace(finalVal);
            await sleep(50);
        }
        diceEl.classList.remove('dice-rolling');

        const playerIdx = state.currentTurn;
        const player = state.players[playerIdx];
        const prevPos = player.pos;
        const statusMsg = document.getElementById('game-status-msg');
        statusMsg.textContent = `${player.name} rolled a ${finalVal}!`;

        // Build step-by-step path (handles Exact Finish bounce-back cleanly!)
        const steps = [];
        if (state.exactFinish && prevPos + finalVal > state.totalTiles) {
            let cur = prevPos;
            for (let k = 0; k < finalVal; k++) {
                if (cur < state.totalTiles && k < (state.totalTiles - prevPos)) {
                    cur++;
                } else {
                    cur = Math.max(1, cur - 1);
                }
                steps.push(cur);
            }
        } else {
            const target = Math.min(state.totalTiles, prevPos + finalVal);
            for (let s = prevPos + 1; s <= target; s++) {
                steps.push(s);
            }
        }

        for (const nextTile of steps) {
            await animateHopStep(playerIdx, player.pos, nextTile);
            player.pos = nextTile;
            updatePlayerStatsUI();
        }

        const landedTile = player.pos;
        state.lastSelectedTile = landedTile;
        const hitLink = state.links.find(l => l.from === landedTile) || null;
        const hitSpecial = getEffectiveSpecial(landedTile);
        const promptObj = getTilePromptData(landedTile);
        const hasPromptToCheck = landedTile > 1 && landedTile < state.totalTiles && state.prompts.length > 0 && Boolean(promptObj.prompt);

        if (state.challengeMode && hasPromptToCheck) {
            updateActivePromptCard(landedTile);
            renderBoard();
            state.isRolling = false;
            rollBtn.disabled = true; // Held until challenge resolves
            openChallengeModal({
                playerIdx,
                prevPos,
                landedTile,
                rolledSix: finalVal === 6,
                linkAfter: hitLink,
                specialAfter: hitSpecial
            });
            return;
        }

        // Standard Automated Mode
        let linkNote = '';
        let bonusTurn = false;
        if (hitLink) {
            const linkIdx = state.links.indexOf(hitLink);
            await sleep(200);
            await animateLinkTravel(playerIdx, hitLink, linkIdx);
            player.pos = hitLink.to;
            if (hitLink.type === 'ladder') {
                linkNote = `Ladder #${hitLink.from} to #${hitLink.to}`;
                statusMsg.textContent = `${player.name} climbed Ladder to #${hitLink.to}!`;
                showToast(`${player.name} climbed Ladder #${hitLink.from} to #${hitLink.to}!`, 'success');
            } else {
                linkNote = `Slide #${hitLink.from} to #${hitLink.to}`;
                statusMsg.textContent = `${player.name} slid down to #${hitLink.to}!`;
                showToast(`${player.name} slid down #${hitLink.from} to #${hitLink.to}!`, 'warning');
            }
            updatePlayerStatsUI();
        }

        const postLinkSpecial = getEffectiveSpecial(player.pos);
        if (postLinkSpecial) {
            await sleep(140);
            const eff = await applySpecialTileEffect(playerIdx, postLinkSpecial);
            if (eff.extraTurn) bonusTurn = true;
        }

        updateActivePromptCard(player.pos, linkNote);
        finalizeTurnProgression(playerIdx, finalVal === 6, bonusTurn);
    }

    function resetGameCounters({ silent = false } = {}) {
        if (state.isRolling) return;
        pendingChallenge = null;
        closeModal('winModal');
        closeModal('tileModal');
        state.players.forEach(p => {
            p.pos = 1;
            p.skipTurns = 0;
        });
        state.currentTurn = 0;
        state.winner = null;
        state.history = [];
        state.lastSelectedTile = 1;
        document.getElementById('game-status-msg').textContent = 'Counters reset! Press Roll or Spacebar.';
        document.getElementById('roll-dice-btn').disabled = false;
        updateUndoButtonUI();
        updateActivePromptCard(1);
        renderPlayersUI();
        renderBoard();
        if (!silent) playSound('pop');
    }

    // ============================
    // PERSISTENCE & CLOUD SYNC
    // ============================
    function getWorkspaceData() {
        return {
            updatedAt: Date.now(),
            gridSize: `${state.cols}x${state.rows}`,
            slideStyle: state.slideStyle,
            colorTheme: state.colorTheme,
            ladderCount: state.ladderCount,
            chuteCount: state.chuteCount,
            orient: state.orient,
            title: document.getElementById('custom-title').value,
            subtitle: document.getElementById('custom-subtitle').value,
            promptsRaw: document.getElementById('prompt-input').value,
            shufflePrompts: document.getElementById('shuffle-prompts').checked,
            showPathArrows: state.showPathArrows,
            bonusTilesEnabled: state.bonusTilesEnabled,
            bonusTiles: { ...state.bonusTiles },
            printCutouts: state.printCutouts,
            fullBoardPrint: state.fullBoardPrint,
            fullBoardDefaultV2: true,
            challengeMode: state.challengeMode,
            roll6ExtraTurn: state.roll6ExtraTurn,
            exactFinish: state.exactFinish,
            links: state.links.map(l => ({ ...l })),
            playerCount: state.playerCount,
            playerNames: state.players.length ? state.players.map(p => p.name) : (state.savedPlayerNames || null),
            activeSetId: state.activeSetId
        };
    }

    function applyWorkspaceData(data) {
        if (!data || typeof data !== 'object') return;
        if (data.gridSize && /^\d+x\d+$/.test(data.gridSize)) {
            const [c, r] = data.gridSize.split('x').map(Number);
            if (c >= 4 && r >= 4) {
                state.cols = c;
                state.rows = r;
                state.totalTiles = c * r;
                const gridRadio = document.querySelector(`input[name="grid-size"][value="${data.gridSize}"]`);
                if (gridRadio) gridRadio.checked = true;
            }
        }
        if (data.slideStyle) {
            state.slideStyle = data.slideStyle;
            const sRadio = document.querySelector(`input[name="slide-style"][value="${data.slideStyle}"]`);
            if (sRadio) sRadio.checked = true;
        }
        if (data.colorTheme) {
            state.colorTheme = data.colorTheme;
            const cRadio = document.querySelector(`input[name="color-theme"][value="${data.colorTheme}"]`);
            if (cRadio) cRadio.checked = true;
        }
        if (typeof data.ladderCount === 'number') {
            state.ladderCount = Math.max(0, Math.min(8, data.ladderCount));
            document.getElementById('ladder-count').value = state.ladderCount;
            document.getElementById('ladder-count-val').textContent = state.ladderCount;
        }
        if (typeof data.chuteCount === 'number') {
            state.chuteCount = Math.max(0, Math.min(8, data.chuteCount));
            document.getElementById('chute-count').value = state.chuteCount;
            document.getElementById('chute-count-val').textContent = state.chuteCount;
        }
        if (data.orient) {
            state.orient = data.orient;
            const oRadio = document.querySelector(`input[name="page-orient"][value="${data.orient}"]`);
            if (oRadio) oRadio.checked = true;
        }
        if (typeof data.title === 'string') document.getElementById('custom-title').value = data.title;
        if (typeof data.subtitle === 'string') document.getElementById('custom-subtitle').value = data.subtitle;
        if (typeof data.promptsRaw === 'string') document.getElementById('prompt-input').value = data.promptsRaw;
        if (typeof data.shufflePrompts === 'boolean') document.getElementById('shuffle-prompts').checked = data.shufflePrompts;
        if (typeof data.showPathArrows === 'boolean') {
            state.showPathArrows = data.showPathArrows;
            document.getElementById('toggle-path-arrows').checked = data.showPathArrows;
        }
        if (typeof data.bonusTilesEnabled === 'boolean') {
            state.bonusTilesEnabled = data.bonusTilesEnabled;
            document.getElementById('toggle-bonus-tiles').checked = data.bonusTilesEnabled;
        }
        if (data.bonusTiles && typeof data.bonusTiles === 'object') {
            state.bonusTiles = { ...data.bonusTiles };
            hasSavedBonusTiles = true;
        }
        if (typeof data.printCutouts === 'boolean') {
            state.printCutouts = data.printCutouts;
            document.getElementById('toggle-print-cutouts').checked = data.printCutouts;
        }
        state.fullBoardPrint = data.fullBoardDefaultV2
            ? Boolean(data.fullBoardPrint)
            : true;
        const fullBoardToggleEl = document.getElementById('toggle-full-board-print');
        if (fullBoardToggleEl) fullBoardToggleEl.checked = state.fullBoardPrint;
        if (typeof data.challengeMode === 'boolean') state.challengeMode = data.challengeMode;
        if (typeof data.roll6ExtraTurn === 'boolean') state.roll6ExtraTurn = data.roll6ExtraTurn;
        if (typeof data.exactFinish === 'boolean') state.exactFinish = data.exactFinish;

        if (Array.isArray(data.links)) {
            state.links = data.links.map(l => ({ ...l }));
            hasSavedLinks = true;
        }
        if (typeof data.playerCount === 'number') state.playerCount = Math.min(6, Math.max(2, data.playerCount));
        if (Array.isArray(data.playerNames)) state.savedPlayerNames = data.playerNames.slice();
        if (data.activeSetId !== undefined) state.activeSetId = data.activeSetId;
        updateRulesUI();
    }

    function updateActiveSetBanner() {
        const banner = document.getElementById('active-set-banner');
        const saveAsBtn = document.getElementById('save-as-btn');
        const current = state.savedSets.find(s => s.id === state.activeSetId);
        if (current) {
            document.getElementById('active-set-name').textContent = current.name;
            banner.classList.remove('hidden');
            banner.classList.add('flex');
            if (saveAsBtn) {
                saveAsBtn.classList.remove('hidden');
                saveAsBtn.classList.add('inline-flex');
            }
        } else {
            state.activeSetId = null;
            banner.classList.add('hidden');
            banner.classList.remove('flex');
            if (saveAsBtn) {
                saveAsBtn.classList.add('hidden');
                saveAsBtn.classList.remove('inline-flex');
            }
        }
    }

    function persistState({ refreshLibrary = false } = {}) {
        const ws = getWorkspaceData();
        updateSyncBadge('saving');
        try { localStorage.setItem(WS_STORAGE_KEY, JSON.stringify(ws)); } catch (e) {}

        if (state.activeSetId) {
            const idx = state.savedSets.findIndex(s => s.id === state.activeSetId);
            if (idx >= 0) {
                const now = ws.updatedAt;
                state.savedSets[idx] = {
                    ...state.savedSets[idx],
                    ...ws,
                    id: state.savedSets[idx].id,
                    name: state.savedSets[idx].name,
                    updatedAt: now,
                    lastUsed: now
                };
                try { localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(state.savedSets)); } catch (e) {}
                if (refreshLibrary) renderSavedSetsList();
            }
        }

        clearTimeout(cloudSaveTimer);
        cloudSaveTimer = setTimeout(() => {
            if (typeof window.saveProgress === 'function') {
                window.saveProgress(CLOUD_TOOL_KEY, {
                    workspace: ws,
                    sets: state.savedSets
                }).then(() => updateSyncBadge('saved')).catch(() => updateSyncBadge('saved'));
            } else {
                updateSyncBadge('saved');
            }
        }, 700);
    }

    function mergeSavedSets(localSets, cloudSets) {
        const map = new Map();
        const isSeedOnly = (sets) => sets.length > 0 && sets.every(s => String(s.id || '').startsWith('seed_'));
        const baseLocal = isSeedOnly(localSets) && cloudSets.length > 0 ? [] : localSets;

        for (const s of baseLocal) {
            if (s && s.id) map.set(s.id, s);
        }
        for (const cs of cloudSets) {
            if (!cs || !cs.id) continue;
            const existing = map.get(cs.id);
            if (!existing || (cs.updatedAt || 0) >= (existing.updatedAt || 0)) {
                map.set(cs.id, cs);
            }
        }
        return Array.from(map.values());
    }

    async function loadPersistedState() {
        let localSets = [];
        try {
            const rawSets = localStorage.getItem(SETS_STORAGE_KEY);
            if (rawSets) {
                const parsedSets = JSON.parse(rawSets);
                if (Array.isArray(parsedSets)) localSets = parsedSets;
            }
        } catch (e) {}

        if (localSets.length === 0) {
            localSets = [
                {
                    id: 'seed_past_simple',
                    name: 'Past Simple Review (30)',
                    updatedAt: Date.now() - 86400000,
                    gridSize: '6x5',
                    slideStyle: 'chutes',
                    colorTheme: 'vibrant',
                    ladderCount: 4,
                    chuteCount: 4,
                    orient: 'portrait',
                    title: PRESETS.past_simple.title,
                    subtitle: PRESETS.past_simple.subtitle,
                    promptsRaw: PRESETS.past_simple.prompts.join('\n')
                },
                {
                    id: 'seed_speaking',
                    name: 'Speaking Warm-Up (25)',
                    updatedAt: Date.now() - 172800000,
                    gridSize: '5x5',
                    slideStyle: 'snakes',
                    colorTheme: 'pastel',
                    ladderCount: 4,
                    chuteCount: 4,
                    orient: 'portrait',
                    title: PRESETS.speaking.title,
                    subtitle: PRESETS.speaking.subtitle,
                    promptsRaw: PRESETS.speaking.prompts.join('\n')
                }
            ];
            try { localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(localSets)); } catch (e) {}
        }
        state.savedSets = localSets;

        let localWs = null;
        let hasWorkspace = false;
        try {
            const rawWs = localStorage.getItem(WS_STORAGE_KEY);
            if (rawWs) {
                localWs = JSON.parse(rawWs);
                applyWorkspaceData(localWs);
                hasWorkspace = true;
            }
        } catch (e) {}

        if (typeof window.loadProgress === 'function') {
            try {
                const cloud = await window.loadProgress(CLOUD_TOOL_KEY);
                if (cloud) {
                    if (Array.isArray(cloud.sets) && cloud.sets.length > 0) {
                        state.savedSets = mergeSavedSets(state.savedSets, cloud.sets);
                        try { localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(state.savedSets)); } catch (e) {}
                    }
                    if (cloud.workspace) {
                        const cloudTs = cloud.workspace.updatedAt || 0;
                        const localTs = localWs?.updatedAt || 0;
                        if (!hasWorkspace || cloudTs > localTs) {
                            applyWorkspaceData(cloud.workspace);
                            try { localStorage.setItem(WS_STORAGE_KEY, JSON.stringify(cloud.workspace)); } catch (e) {}
                            hasWorkspace = true;
                        }
                    }
                }
            } catch (e) {}
        }

        if (!hasWorkspace) {
            document.getElementById('custom-title').value = PRESETS.past_simple.title;
            document.getElementById('custom-subtitle').value = PRESETS.past_simple.subtitle;
            document.getElementById('prompt-input').value = PRESETS.past_simple.prompts.join('\n');
        }

        updateActiveSetBanner();
        renderSavedSetsList();
        updateSyncBadge('saved');
    }

    // ============================
    // BUILD / PRESETS / CLEANUP
    // ============================
    function updatePromptCountPill() {
        const parsed = parsePromptsInput();
        const pill = document.getElementById('prompt-count-pill');
        pill.textContent = parsed.length === 0 ? 'Classic (blank)' : `${parsed.length} prompt${parsed.length === 1 ? '' : 's'}`;
    }

    function buildBoard({ keepLinks = false, preserveBonus = false, skipPersist = false } = {}) {
        state.title = document.getElementById('custom-title').value.trim() || 'Slides & Ladders';
        state.subtitle = document.getElementById('custom-subtitle').value.trim() || '';

        let parsed = parsePromptsInput();
        if (document.getElementById('shuffle-prompts').checked && parsed.length > 1) {
            parsed = shuffleArray(parsed);
        }
        state.prompts = parsed;

        if (!keepLinks) {
            generateBalancedLinks();
        } else {
            state.links = state.links.filter(l => l.from > 1 && l.from < state.totalTiles && l.to > 1 && l.to < state.totalTiles);
            applySlideStyleToExistingLinks();
        }

        if (!preserveBonus) {
            generateBonusTiles();
        } else {
            // Trim bonus tiles out of range or conflicting with links
            const nextBonus = {};
            const occupied = new Set([1, state.totalTiles]);
            state.links.forEach(l => { occupied.add(l.from); occupied.add(l.to); });
            Object.entries(state.bonusTiles).forEach(([k, v]) => {
                const n = Number(k);
                if (n > 1 && n < state.totalTiles && !occupied.has(n)) nextBonus[n] = v;
            });
            state.bonusTiles = nextBonus;
        }

        state.players.forEach(p => { if (p.pos > state.totalTiles) p.pos = 1; });
        state.lastSelectedTile = Math.min(state.totalTiles, Math.max(1, state.lastSelectedTile));
        updatePromptCountPill();
        renderPlayersUI();
        renderBoard();
        updateActivePromptCard(state.lastSelectedTile);
        if (!skipPersist) persistState();
    }

    function loadPreset(key) {
        const p = PRESETS[key];
        if (!p) return;
        document.getElementById('custom-title').value = p.title;
        document.getElementById('custom-subtitle').value = p.subtitle;
        document.getElementById('prompt-input').value = p.prompts.join('\n');
        state.activeSetId = null;
        const nameInput = document.getElementById('set-name-input');
        if (nameInput) nameInput.value = '';
        updateActiveSetBanner();
        renderSavedSetsList();
        buildBoard({ keepLinks: false });
        playSound('pop');
        showToast(`Loaded "${p.title}"`, 'info');
    }

    function cleanPromptsInput() {
        const inp = document.getElementById('prompt-input');
        const lines = inp.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (lines.length === 0) {
            showToast('Nothing to clean', 'info');
            return;
        }
        const seen = new Set();
        const cleaned = [];
        for (const l of lines) {
            if (!seen.has(l)) {
                seen.add(l);
                cleaned.push(l);
            }
        }
        const removed = lines.length - cleaned.length;
        inp.value = cleaned.join('\n');
        buildBoard({ keepLinks: true, preserveBonus: true });
        playSound('pop');
        showToast(removed > 0 ? `Cleaned! Removed ${removed} duplicate${removed > 1 ? 's' : ''}` : `Formatted ${cleaned.length} prompts cleanly`, 'success');
    }

    // ============================
    // PRINT A4 & PNG / SVG EXPORTS
    // ============================
    function applyPage() {
        document.documentElement.setAttribute('data-orient', state.orient);
        const styleEl = document.getElementById('page-style');
        if (styleEl) styleEl.textContent = `@page { size: A4 ${state.orient}; margin: 0; }`;
    }

    function preparePrint(isKey = false) {
        applyPage();
        const printAreaEl = document.getElementById('print-area');
        if (printAreaEl) {
            printAreaEl.classList.toggle('print-full-board', Boolean(state.fullBoardPrint) && !isKey);
        }

        const title = document.getElementById('custom-title').value.trim() || 'Slides & Ladders';
        const subtitle = document.getElementById('custom-subtitle').value.trim() || '';
        document.getElementById('print-heading').textContent = isKey ? `${title} — ANSWER KEY` : title;
        document.getElementById('print-subheading').textContent = isKey
            ? 'Teacher Reference Sheet with square answers and ladder/slide routes.'
            : subtitle;

        document.getElementById('print-svg-container').innerHTML = buildBoardSVG({
            forPrint: true,
            showAnswers: isKey
        });

        const cutoutStrip = document.getElementById('print-cutout-strip');
        if (!isKey && state.printCutouts) {
            const isBW = state.colorTheme === 'bw';
            const badges = PLAYER_COLORS.slice(0, state.playerCount).map(pc =>
                `<span class="cutout-token" style="background:${isBW ? '#ffffff' : pc.light}; color:#1e293b;">${pc.label}</span>`
            ).join('');
            cutoutStrip.innerHTML = `
                <span style="font-size:8pt; font-weight:800;">Cut-Out Counters (${state.playerCount} Players):</span>
                <div style="display:flex; gap:6px; align-items:center;">${badges}</div>
            `;
            cutoutStrip.classList.remove('hidden');
        } else {
            cutoutStrip.innerHTML = '';
            cutoutStrip.classList.add('hidden');
        }

        const keyGrid = document.getElementById('print-key-grid');
        const items = [];
        if (isKey) {
            if (state.prompts.length > 0) {
                for (let n = 2; n < state.totalTiles; n++) {
                    const obj = state.prompts[(n - 2) % state.prompts.length];
                    if (obj && obj.answer) {
                        items.push(`<div><b>#${n}:</b> ${escapeHtml(obj.prompt)} &rarr; <span style="color:#00a84f">${escapeHtml(obj.answer)}</span></div>`);
                    }
                }
            }
            state.links.forEach(l => {
                const arrow = l.type === 'ladder' ? 'Ladder Up' : 'Slide Down';
                items.push(`<div><b>${arrow}:</b> #${l.from} &rarr; #${l.to}</div>`);
            });
        }
        if (isKey && items.length > 0) {
            keyGrid.innerHTML = items.join('');
            keyGrid.classList.remove('hidden');
        } else {
            keyGrid.innerHTML = '';
            keyGrid.classList.add('hidden');
        }
    }

    function triggerPrint(isKey = false) {
        printingAsKey = isKey;
        preparePrint(isKey);
        setTimeout(() => window.print(), 80);
    }

    function buildStandalonePosterSVG() {
        const m = getBoardMetrics();
        const title = document.getElementById('custom-title').value.trim() || 'Slides & Ladders';
        const subtitle = document.getElementById('custom-subtitle').value.trim() || '';
        const headerH = 74;
        const footerH = 32;
        const totalW = m.svgW;
        const totalH = headerH + m.svgH + footerH;
        const innerSvg = buildBoardSVG({ forPrint: true, showAnswers: state.showAnswers });
        const innerBody = innerSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">
    <rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#ffffff"/>
    <text x="20" y="36" font-family="Fredoka, sans-serif" font-weight="700" font-size="26" fill="#1e293b">${escapeXml(title.toUpperCase())}</text>
    <text x="20" y="57" font-family="Nunito, sans-serif" font-weight="700" font-size="13" fill="#475569">${escapeXml(subtitle)}</text>
    <line x1="20" y1="67" x2="${totalW - 20}" y2="67" stroke="#1e293b" stroke-width="3"/>
    <g transform="translate(0 ${headerH})">${innerBody}</g>
    <text x="20" y="${totalH - 12}" font-family="Nunito, sans-serif" font-weight="700" font-size="11" fill="#475569">START at 1 -&gt; FINISH at ${state.totalTiles} | Ladders go UP | Slides &amp; Snakes go DOWN</text>
    <g transform="translate(${totalW - 20}, ${totalH - 12})">
        <circle cx="-118" cy="-4" r="3" fill="#ff4785"/>
        <circle cx="-110" cy="-4" r="3" fill="#ff7e33"/>
        <circle cx="-102" cy="-4" r="3" fill="#00d063"/>
        <circle cx="-94" cy="-4" r="3" fill="#1ea7fd"/>
        <text x="0" y="0" text-anchor="end" font-family="Nunito, sans-serif" font-weight="700" font-size="11.5" fill="#64748b">Made with <tspan font-family="Fredoka, sans-serif" font-weight="700" fill="#1e293b">KlassKit</tspan></text>
    </g>
</svg>`;
    }

    function getSafeExportBase() {
        const raw = document.getElementById('custom-title').value.trim() || 'slides-and-ladders';
        return raw.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-|-$/g, '') || 'slides-and-ladders';
    }

    function exportBoardSVG() {
        const svgStr = buildStandalonePosterSVG();
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${getSafeExportBase()}.svg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        showToast('Downloaded SVG board!', 'success');
    }

    function exportBoardPNG() {
        const svgStr = buildStandalonePosterSVG();
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const scale = 2;
            const canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            canvas.toBlob((pngBlob) => {
                if (!pngBlob) return;
                const pngUrl = URL.createObjectURL(pngBlob);
                const a = document.createElement('a');
                a.href = pngUrl;
                a.download = `${getSafeExportBase()}.png`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(pngUrl), 500);
                showToast('Downloaded Hi-Res PNG!', 'success');
            }, 'image/png');
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            showToast('Could not render PNG in this browser.', 'error');
        };
        img.src = url;
    }

    // ============================
    // SAVED BOARDS LIBRARY UI
    // ============================
    function persistSavedSets() {
        try { localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(state.savedSets)); } catch (e) {}
        renderSavedSetsList();
        persistState({ refreshLibrary: false });
    }

    function renderSavedSetsList() {
        const list = document.getElementById('library-list');
        if (!list) return;
        const sort = document.getElementById('library-sort')?.value || 'recent';
        const query = (document.getElementById('library-search')?.value || '').trim().toLowerCase();
        const searchClear = document.getElementById('library-search-clear');
        if (searchClear) searchClear.classList.toggle('hidden', query.length === 0);

        document.getElementById('saved-count').textContent = state.savedSets.length;
        updateActiveSetBanner();

        const sorted = state.savedSets.slice().sort((a, b) => {
            if (sort === 'alpha') return (a.name || '').localeCompare(b.name || '');
            if (sort === 'popular') return (b.usageCount || 0) - (a.usageCount || 0);
            return (b.lastUsed || b.updatedAt || 0) - (a.lastUsed || a.updatedAt || 0);
        });

        const filtered = query
            ? sorted.filter(s => (s.name || '').toLowerCase().includes(query) || (s.promptsRaw || '').toLowerCase().includes(query))
            : sorted;

        if (filtered.length === 0) {
            list.innerHTML = `<p class="text-[11px] font-bold text-slate-400 text-center py-4">${query ? 'No matching saved boards.' : 'No saved boards yet.'}</p>`;
            return;
        }

        list.innerHTML = filtered.map(item => {
            const isActive = item.id === state.activeSetId;
            return `
                <div class="flex items-center gap-1.5 p-2 rounded-xl border-2 ${isActive ? 'border-blue bg-blue/10 shadow-hard-sm' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70'} hover:border-blue transition-colors">
                    <button type="button" data-load-id="${escapeHtml(item.id)}" class="flex-1 text-left min-w-0">
                        <p class="text-xs font-extrabold truncate text-dark dark:text-white flex items-center gap-1.5">
                            <span class="truncate">${escapeHtml(item.name)}</span>
                            ${isActive ? '<span class="px-1.5 py-0.5 rounded bg-blue text-white text-[9px] uppercase shrink-0">Active</span>' : ''}
                        </p>
                        <p class="text-[10px] font-bold text-slate-400">${escapeHtml(item.gridSize || '6x5')} &middot; ${escapeHtml(item.slideStyle || 'chutes')}</p>
                    </button>
                    <button type="button" data-dup-id="${escapeHtml(item.id)}" class="p-1.5 rounded-lg text-slate-400 hover:text-blue hover:bg-blue/10 transition-colors" title="Duplicate board" aria-label="Duplicate board">
                        <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" data-delete-id="${escapeHtml(item.id)}" class="p-1.5 rounded-lg text-slate-400 hover:text-pink hover:bg-pink/10 transition-colors" title="Delete board" aria-label="Delete board">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            `;
        }).join('');

        hydrateIcons(list);

        list.querySelectorAll('[data-load-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = state.savedSets.find(s => s.id === btn.dataset.loadId);
                if (item) applySavedSet(item);
            });
        });

        list.querySelectorAll('[data-dup-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = state.savedSets.find(s => s.id === btn.dataset.dupId);
                if (!item) return;
                const now = Date.now();
                const copyId = 'cl_' + now;
                const copy = {
                    ...item,
                    id: copyId,
                    name: `${item.name} (Copy)`,
                    createdAt: now,
                    updatedAt: now,
                    lastUsed: now,
                    usageCount: 0
                };
                state.savedSets.unshift(copy);
                persistSavedSets();
                showToast(`Duplicated as "${copy.name}"`, 'success');
            });
        });

        list.querySelectorAll('[data-delete-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.deleteId;
                const item = state.savedSets.find(s => s.id === id);
                openConfirm('Delete Board?', `Remove "${item?.name || 'this board'}" from your saved library?`, () => {
                    state.savedSets = state.savedSets.filter(s => s.id !== id);
                    if (state.activeSetId === id) {
                        state.activeSetId = null;
                        const nameInput = document.getElementById('set-name-input');
                        if (nameInput) nameInput.value = '';
                    }
                    persistSavedSets();
                    showToast('Board deleted.', 'info');
                });
            });
        });
    }

    function applySavedSet(item) {
        state.savedPlayerNames = null;
        hasSavedLinks = Array.isArray(item.links);
        hasSavedBonusTiles = Boolean(item.bonusTiles && typeof item.bonusTiles === 'object');
        applyWorkspaceData({ ...item, activeSetId: item.id });
        initPlayers(state.playerCount, { names: state.savedPlayerNames, skipRender: true });
        const now = Date.now();
        item.updatedAt = now;
        item.lastUsed = now;
        item.usageCount = (item.usageCount || 0) + 1;
        const nameInput = document.getElementById('set-name-input');
        if (nameInput) nameInput.value = item.name || '';
        try { localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(state.savedSets)); } catch (e) {}
        applyPage();
        buildBoard({ keepLinks: hasSavedLinks, preserveBonus: hasSavedBonusTiles });
        renderSavedSetsList();
        playSound('pop');
        showToast(`Loaded "${item.name}"`, 'success');
    }

    // ============================
    // TOGGLES & UI HELPERS
    // ============================
    function switchSidebarTab(tabId) {
        state.activeTab = tabId;
        ['prompts', 'board', 'library'].forEach(t => {
            const panel = document.getElementById(`tab-panel-${t}`);
            if (panel) panel.classList.toggle('hidden', t !== tabId);
            const tabBtn = document.querySelector(`[data-sidebar-tab="${t}"]`);
            if (tabBtn) {
                tabBtn.classList.toggle('active', t === tabId);
                tabBtn.setAttribute('aria-selected', String(t === tabId));
            }
        });
    }

    function setEditLinksMode(on) {
        state.editLinksMode = on;
        state.editLinkStart = null;
        const btn = document.getElementById('edit-links-btn');
        const iconWrap = document.getElementById('edit-links-icon');
        const banner = document.getElementById('edit-links-banner');
        btn.setAttribute('aria-pressed', String(on));
        btn.classList.toggle('bg-white/85', !on);
        btn.classList.toggle('dark:bg-slate-800/85', !on);
        btn.classList.toggle('dark:text-white', !on);
        btn.classList.toggle('bg-orange', on);
        btn.classList.toggle('text-dark', true);
        if (iconWrap) {
            iconWrap.classList.toggle('text-orange', !on);
            iconWrap.classList.toggle('text-dark', on);
        }
        banner.classList.toggle('hidden', !on);
        banner.classList.toggle('flex', on);
        document.getElementById('edit-links-hint').textContent = 'Click START square, then END square (low to high = Ladder, high to low = Slide). Click any link to delete.';
        renderBoard();
    }

    function toggleAnswerOverlay() {
        state.showAnswers = !state.showAnswers;
        const btn = document.getElementById('answer-toggle-btn');
        btn.setAttribute('aria-pressed', String(state.showAnswers));
        btn.classList.toggle('bg-white/85', !state.showAnswers);
        btn.classList.toggle('dark:bg-slate-800/85', !state.showAnswers);
        btn.classList.toggle('bg-orange', state.showAnswers);
        btn.classList.toggle('text-dark', state.showAnswers);
        btn.classList.toggle('text-orange', !state.showAnswers);
        renderBoard();
        updateActivePromptCard(state.lastSelectedTile);
        playSound('pop');
        showToast(state.showAnswers ? 'Teacher Answers visible' : 'Teacher Answers hidden', 'info');
    }

    function toggleSmartboardFocusMode(forceState) {
        state.focusMode = typeof forceState === 'boolean' ? forceState : !state.focusMode;
        const consoleEl = document.getElementById('main-console');
        const btn = document.getElementById('fullscreen-stage-btn');
        if (consoleEl) consoleEl.classList.toggle('stage-focus-mode', state.focusMode);
        if (btn) {
            btn.setAttribute('aria-pressed', String(state.focusMode));
            btn.innerHTML = `<i data-lucide="${state.focusMode ? 'minimize-2' : 'maximize-2'}" class="w-4 h-4"></i>`;
            btn.classList.toggle('bg-blue', state.focusMode);
            btn.classList.toggle('text-white', state.focusMode);
            btn.classList.toggle('bg-white/85', !state.focusMode);
            btn.classList.toggle('dark:bg-slate-800/85', !state.focusMode);
            btn.classList.toggle('text-blue', !state.focusMode);
            hydrateIcons(btn);
        }
        if (state.focusMode) {
            try {
                if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                }
            } catch (e) {}
        } else {
            try {
                if (document.exitFullscreen && document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                }
            } catch (e) {}
        }
    }

    function applySoundUI() {
        const btn = document.getElementById('sound-btn');
        const onIcon = document.getElementById('sound-icon-on');
        const offIcon = document.getElementById('sound-icon-off');
        btn.setAttribute('aria-pressed', String(state.soundOn));
        onIcon.classList.toggle('hidden', !state.soundOn);
        onIcon.classList.toggle('inline-flex', state.soundOn);
        offIcon.classList.toggle('hidden', state.soundOn);
        offIcon.classList.toggle('inline-flex', !state.soundOn);
        btn.classList.toggle('bg-green/20', state.soundOn);
        btn.classList.toggle('bg-slate-200', !state.soundOn);
        btn.classList.toggle('dark:bg-slate-700', !state.soundOn);
    }

    function initSoundState() {
        try {
            if (localStorage.getItem('soundMuted') === 'true') {
                state.soundOn = false;
                applySoundUI();
            }
        } catch (e) {}
    }

    function syncThemeButtonAria() {
        const isDark = document.documentElement.classList.contains('dark');
        document.getElementById('theme-btn')?.setAttribute('aria-pressed', String(isDark));
    }

    // ============================
    // INITIALIZATION & EVENTS
    // ============================
    window.addEventListener('beforeprint', () => preparePrint(printingAsKey));
    window.addEventListener('afterprint', () => {
        printingAsKey = false;
        preparePrint(false);
    });

    document.addEventListener('DOMContentLoaded', async () => {
        syncThemeButtonAria();
        initSoundState();
        if (typeof requireAuth === 'function') await requireAuth();
        document.body.classList.remove('opacity-0');

        await loadPersistedState();
        const initialActiveSet = state.activeSetId ? state.savedSets.find(s => s.id === state.activeSetId) : null;
        const initialSetNameInput = document.getElementById('set-name-input');
        if (initialSetNameInput && initialActiveSet) {
            initialSetNameInput.value = initialActiveSet.name || '';
        }

        applyPage();
        renderDiceFace(6);
        initPlayers(state.playerCount, { names: state.savedPlayerNames, skipRender: true });
        buildBoard({ keepLinks: hasSavedLinks, preserveBonus: hasSavedBonusTiles, skipPersist: true });
        updateActivePromptCard(1);
        hydrateIcons(document);

        // Dark mode toggle
        document.getElementById('theme-btn').addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            document.getElementById('theme-btn').setAttribute('aria-pressed', String(isDark));
            try {
                localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
                localStorage.setItem('klasskit-theme', isDark ? 'dark' : 'light');
            } catch (e) {}
            playSound('pop');
        });

        // Sound toggle (persists soundMuted)
        document.getElementById('sound-btn').addEventListener('click', () => {
            state.soundOn = !state.soundOn;
            try { localStorage.setItem('soundMuted', String(!state.soundOn)); } catch (e) {}
            applySoundUI();
            if (state.soundOn) playSound('pop');
        });

        // Sidebar tabs
        document.querySelectorAll('[data-sidebar-tab]').forEach(btn => {
            btn.addEventListener('click', () => switchSidebarTab(btn.dataset.sidebarTab));
        });

        // Sidebar collapse & mobile close
        const sidebar = document.getElementById('sidebar');
        document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
            if (state.focusMode) {
                toggleSmartboardFocusMode(false);
                return;
            }
            if (window.innerWidth < 768) {
                sidebar.classList.toggle('hidden-panel-mobile');
            } else {
                sidebar.classList.toggle('hidden-panel-desktop');
            }
        });
        document.getElementById('mobile-close-panel').addEventListener('click', () => {
            sidebar.classList.add('hidden-panel-mobile');
        });

        // Grid size radios
        document.querySelectorAll('input[name="grid-size"]').forEach(r => {
            r.addEventListener('change', (e) => {
                const [c, rows] = e.target.value.split('x').map(Number);
                state.cols = c;
                state.rows = rows;
                state.totalTiles = c * rows;
                buildBoard({ keepLinks: false });
                playSound('pop');
            });
        });

        // Slide style radios
        document.querySelectorAll('input[name="slide-style"]').forEach(r => {
            r.addEventListener('change', (e) => {
                state.slideStyle = e.target.value;
                applySlideStyleToExistingLinks();
                renderBoard();
                persistState();
                playSound('pop');
            });
        });

        // Color theme radios
        document.querySelectorAll('input[name="color-theme"]').forEach(r => {
            r.addEventListener('change', (e) => {
                state.colorTheme = e.target.value;
                renderBoard();
                persistState();
                playSound('pop');
            });
        });

        // Sliders
        document.getElementById('ladder-count').addEventListener('input', (e) => {
            state.ladderCount = Number(e.target.value);
            document.getElementById('ladder-count-val').textContent = state.ladderCount;
            generateBalancedLinks();
            renderBoard();
            persistState();
        });
        document.getElementById('chute-count').addEventListener('input', (e) => {
            state.chuteCount = Number(e.target.value);
            document.getElementById('chute-count-val').textContent = state.chuteCount;
            generateBalancedLinks();
            renderBoard();
            persistState();
        });

        // Link toolbar buttons
        document.getElementById('shuffle-links-btn').addEventListener('click', () => {
            generateBalancedLinks();
            renderBoard();
            persistState();
            playSound('pop');
            showToast('Generated fresh ladders & slides!', 'info');
        });
        document.getElementById('clear-links-btn').addEventListener('click', () => {
            state.links = [];
            renderBoard();
            persistState();
            playSound('pop');
            showToast('Cleared all ladders & slides', 'info');
        });
        document.getElementById('edit-links-btn').addEventListener('click', () => setEditLinksMode(!state.editLinksMode));
        document.getElementById('sidebar-edit-links-btn').addEventListener('click', () => setEditLinksMode(!state.editLinksMode));
        document.getElementById('done-edit-links-btn').addEventListener('click', () => setEditLinksMode(false));

        // Board feature checkboxes
        document.getElementById('toggle-path-arrows').addEventListener('change', (e) => {
            state.showPathArrows = e.target.checked;
            renderBoard();
            persistState();
        });
        document.getElementById('toggle-bonus-tiles').addEventListener('change', (e) => {
            state.bonusTilesEnabled = e.target.checked;
            generateBonusTiles();
            renderBoard();
            persistState();
        });
        document.getElementById('toggle-print-cutouts').addEventListener('change', (e) => {
            state.printCutouts = e.target.checked;
            persistState();
        });
        document.getElementById('toggle-full-board-print')?.addEventListener('change', (e) => {
            state.fullBoardPrint = e.target.checked;
            persistState();
        });

        // Answer toggle, Smartboard Focus, Reset
        document.getElementById('answer-toggle-btn').addEventListener('click', toggleAnswerOverlay);
        document.getElementById('fullscreen-stage-btn').addEventListener('click', () => toggleSmartboardFocusMode());
        document.getElementById('reset-game-btn').addEventListener('click', () => resetGameCounters());
        document.getElementById('undo-move-btn').addEventListener('click', undoLastMove);

        // Classroom Rules Strip
        document.getElementById('rule-challenge-btn').addEventListener('click', () => {
            state.challengeMode = !state.challengeMode;
            updateRulesUI();
            persistState();
            playSound('pop');
            showToast(state.challengeMode ? 'Check Answer mode ON' : 'Check Answer mode OFF', 'info');
        });
        document.getElementById('rule-roll6-btn').addEventListener('click', () => {
            state.roll6ExtraTurn = !state.roll6ExtraTurn;
            updateRulesUI();
            persistState();
            playSound('pop');
        });
        document.getElementById('rule-exact-btn').addEventListener('click', () => {
            state.exactFinish = !state.exactFinish;
            updateRulesUI();
            persistState();
            playSound('pop');
        });

        // Presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
        });

        // Clean & Clear Prompts
        document.getElementById('clean-prompts-btn').addEventListener('click', cleanPromptsInput);
        document.getElementById('clear-prompts-btn').addEventListener('click', () => {
            document.getElementById('prompt-input').value = '';
            buildBoard({ keepLinks: true, preserveBonus: true });
            playSound('pop');
        });

        // Live sync title/subtitle/prompts to board
        document.getElementById('custom-title').addEventListener('input', () => persistState());
        document.getElementById('custom-subtitle').addEventListener('input', () => persistState());
        document.getElementById('prompt-input').addEventListener('input', () => {
            updatePromptCountPill();
            clearTimeout(liveInputTimer);
            liveInputTimer = setTimeout(() => {
                buildBoard({ keepLinks: true, preserveBonus: true });
            }, 180);
        });
        document.getElementById('shuffle-prompts').addEventListener('change', () => buildBoard({ keepLinks: true, preserveBonus: true }));

        // Build CTA
        document.getElementById('build-btn').addEventListener('click', () => {
            buildBoard({ keepLinks: false });
            playSound('ladder');
            showToast('Board rebuilt with fresh links!', 'success');
        });

        // Orientation, Print, & Export
        document.querySelectorAll('input[name="page-orient"]').forEach(r => {
            r.addEventListener('change', (e) => {
                state.orient = e.target.value;
                applyPage();
                renderBoard();
                persistState();
            });
        });
        document.getElementById('print-handout-btn').addEventListener('click', () => triggerPrint(false));
        document.getElementById('print-key-btn').addEventListener('click', () => triggerPrint(true));
        document.getElementById('export-png-btn').addEventListener('click', exportBoardPNG);
        document.getElementById('export-svg-btn').addEventListener('click', exportBoardSVG);

        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', () => {
            state.zoom = Math.min(1.6, +(state.zoom + 0.1).toFixed(2));
            renderBoard();
        });
        document.getElementById('zoom-out').addEventListener('click', () => {
            state.zoom = Math.max(0.6, +(state.zoom - 0.1).toFixed(2));
            renderBoard();
        });
        document.getElementById('zoom-reset').addEventListener('click', () => {
            state.zoom = 1;
            renderBoard();
        });

        // Player count buttons
        document.querySelectorAll('.pcount-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (state.isRolling || pendingChallenge) return;
                const prevNames = state.players.map(p => p.name);
                initPlayers(Number(btn.dataset.pcount), { names: prevNames });
                state.savedPlayerNames = state.players.map(p => p.name);
                persistState();
                playSound('pop');
            });
        });

        // Dice Roll
        document.getElementById('roll-dice-btn').addEventListener('click', rollDice);
        document.getElementById('dice-face').addEventListener('click', rollDice);

        // Prompt Card actions
        document.getElementById('card-reveal-btn').addEventListener('click', () => {
            document.getElementById('card-answer-text').classList.remove('hidden');
            document.getElementById('card-reveal-btn').classList.add('hidden');
            playSound('pop');
        });
        document.getElementById('card-spotlight-btn').addEventListener('click', () => {
            openTileInspectModal(state.lastSelectedTile || 1);
        });

        // Tile Spotlight & Challenge Modal
        const tileModal = document.getElementById('tileModal');
        document.getElementById('tile-modal-close').addEventListener('click', closeTileModal);
        document.getElementById('tile-modal-ok').addEventListener('click', closeTileModal);
        tileModal.addEventListener('click', (e) => { if (e.target === tileModal) closeTileModal(); });
        document.getElementById('modal-reveal-btn').addEventListener('click', () => {
            document.getElementById('modal-answer-box').classList.remove('hidden');
            document.getElementById('modal-reveal-btn').classList.add('hidden');
            playSound('pop');
        });
        document.getElementById('modal-timer-btn').addEventListener('click', toggleSpotlightTimer);
        document.getElementById('modal-correct-btn').addEventListener('click', () => resolveChallengeOutcome(true));
        document.getElementById('modal-miss-btn').addEventListener('click', () => resolveChallengeOutcome(false));
        document.getElementById('modal-edit-tile-btn').addEventListener('click', openInlineTileEditor);
        document.getElementById('modal-edit-cancel').addEventListener('click', () => {
            document.getElementById('modal-edit-pane').classList.add('hidden');
            document.getElementById('modal-view-pane').classList.remove('hidden');
        });
        document.getElementById('modal-edit-save').addEventListener('click', saveInlineTileEdit);

        // Victory Modal
        document.getElementById('win-play-again-btn').addEventListener('click', () => resetGameCounters());
        document.getElementById('win-rematch-shuffle-btn').addEventListener('click', () => {
            generateBalancedLinks();
            persistState();
            resetGameCounters();
        });
        document.getElementById('win-close-btn').addEventListener('click', () => closeModal('winModal'));
        document.getElementById('winModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('winModal')) closeModal('winModal');
        });

        // Help Modal
        const helpModal = document.getElementById('helpModal');
        document.getElementById('help-btn').addEventListener('click', () => openModal('helpModal'));
        document.getElementById('help-close-btn').addEventListener('click', () => closeModal('helpModal'));
        document.getElementById('help-got-it-btn').addEventListener('click', () => closeModal('helpModal'));
        helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeModal('helpModal'); });

        // Library Search, Sort, New, Save, Save As Copy
        document.getElementById('library-sort').addEventListener('change', renderSavedSetsList);
        document.getElementById('library-search').addEventListener('input', renderSavedSetsList);
        document.getElementById('library-search-clear').addEventListener('click', () => {
            document.getElementById('library-search').value = '';
            renderSavedSetsList();
        });

        document.getElementById('close-set-btn').addEventListener('click', () => {
            state.activeSetId = null;
            const setNameInputEl = document.getElementById('set-name-input');
            if (setNameInputEl) setNameInputEl.value = '';
            updateActiveSetBanner();
            renderSavedSetsList();
            persistState();
        });

        document.getElementById('new-set-btn').addEventListener('click', () => {
            openConfirm('Start New Board?', 'This will detach from any active saved board and start a blank workspace.', () => {
                state.activeSetId = null;
                const setNameInputEl = document.getElementById('set-name-input');
                if (setNameInputEl) setNameInputEl.value = '';
                updateActiveSetBanner();
                document.getElementById('custom-title').value = 'New Slides & Ladders';
                document.getElementById('custom-subtitle').value = 'Roll the die, move your counter, and complete each square!';
                document.getElementById('prompt-input').value = '';
                renderSavedSetsList();
                buildBoard({ keepLinks: false });
                showToast('Started a fresh blank board', 'info');
            });
        });

        // Bulk Import Modal
        const chutesBulkModal = window.KlassKitBulkImport ? window.KlassKitBulkImport.create({
            id: 'chutes-bulk-import-overlay',
            title: 'Slides & Ladders Bulk Import',
            subtitle: 'Paste square prompts (one per line) or Prompt | Answer pairs',
            accentColor: 'blue',
            unitLabel: 'prompt',
            unitLabelPlural: 'prompts',
            confirmText: 'Build Board',
            guideItems: [
                { label: 'Title & Guide', syntax: '## Past Tense Adventure\n? Say the past verb!', color: 'blue', desc: 'Optional board title (##) and instructions (?).' },
                { label: 'Prompt / Key', syntax: 'go | went\n[+2] Name 3 fruits!', color: 'green', desc: 'One prompt per line; add | answer or [+2]/[-2]/[ROLL]/[SKIP] tags.' },
                { label: 'Comments', syntax: '# Unit 5 Review', color: 'orange', desc: 'Lines starting with # or // are ignored.' }
            ],
            placeholder: '## Irregular Past Race\n? Say the past tense of the verb before moving on!\ngo | went\neat | ate\nsee | saw\n[+2] take | took\nbuy | bought',
            template: '## Speaking & Grammar Ladder\n? Roll the die, answer the square, and climb the ladders!\ngo | went\nsee | saw\nmake | made\nwrite | wrote\n[+2] Name 3 animals\n[ROLL] Say one hobby you like',
            sample: '## Irregular Verbs Challenge\n? Change each verb to Past Simple to stay on the square!\ngo | went\neat | ate\nsee | saw\nbuy | bought\n[+2] take | took\ncome | came\nwrite | wrote\nspeak | spoke\nread | read\n[ROLL] drink | drank\nsleep | slept\nswim | swam\nrun | ran\nfly | flew',
            options: [
                { id: 'append', label: 'Append to current square prompts', defaultChecked: false },
                { id: 'newLinks', label: 'Generate new random Ladders & Slides', defaultChecked: false }
            ],
            parse(rawText) {
                const rawLines = String(rawText || '').replace(/\r\n/g, '\n').split('\n');
                let title = '';
                let subtitle = '';
                const items = [];

                for (const line of rawLines) {
                    const t = line.trim();
                    if (!t) continue;
                    if (t.startsWith('##')) { title = t.slice(2).trim(); continue; }
                    if (t.startsWith('?')) { subtitle = t.slice(1).trim(); continue; }
                    if (t.startsWith('#') || t.startsWith('//')) continue;
                    items.push(t);
                }

                return {
                    items,
                    title,
                    subtitle,
                    warnings: [],
                    badges: items.map((line, i) => {
                        const [qRaw, a] = line.split('|').map((s) => s.trim());
                        const parsed = parsePromptTag(qRaw);
                        return {
                            tag: `#${i + 2}${parsed.special ? ` ${BONUS_TYPES[parsed.special].code}` : ''}`,
                            label: a ? `${parsed.cleanPrompt} -> ${a}` : parsed.cleanPrompt,
                            tone: parsed.special ? 'orange' : (a ? 'blue' : 'slate')
                        };
                    })
                };
            },
            onImport(result, opts) {
                const items = result.items || [];
                if (!items.length) return false;
                if (result.title) document.getElementById('custom-title').value = result.title;
                if (result.subtitle) document.getElementById('custom-subtitle').value = result.subtitle;
                const inp = document.getElementById('prompt-input');
                if (opts && opts.append && inp.value.trim()) {
                    inp.value = inp.value.trim() + '\n' + items.join('\n');
                } else {
                    inp.value = items.join('\n');
                }
                updatePromptCountPill();
                buildBoard({ keepLinks: !(opts && opts.newLinks), preserveBonus: true });
                playSound('pop');
                showToast(`Imported ${items.length} square prompt(s)`, 'success');
                return true;
            }
        }) : null;

        document.getElementById('bulk-import-btn')?.addEventListener('click', () => chutesBulkModal?.open());

        // Save Modal & Inline Save Controls
        const saveModal = document.getElementById('saveModal');
        const saveInput = document.getElementById('save-set-input');
        const setNameInputEl = document.getElementById('set-name-input');

        const confirmSave = (explicitName, { forceNew = false } = {}) => {
            const name = (typeof explicitName === 'string' ? explicitName : saveInput.value).trim();
            if (!name) {
                showToast('Please enter a board name.', 'warning');
                return;
            }
            const now = Date.now();
            const ws = getWorkspaceData();
            const existingIdx = (!forceNew && state.activeSetId) ? state.savedSets.findIndex(s => s.id === state.activeSetId) : -1;
            const isSameName = existingIdx >= 0 && (state.savedSets[existingIdx].name || '').trim().toLowerCase() === name.toLowerCase();

            if (isSameName) {
                state.savedSets[existingIdx] = {
                    ...state.savedSets[existingIdx],
                    ...ws,
                    name,
                    updatedAt: now,
                    lastUsed: now,
                    usageCount: (state.savedSets[existingIdx].usageCount || 0) + 1
                };
                if (setNameInputEl) setNameInputEl.value = name;
                closeModal('saveModal');
                persistSavedSets();
                playSound('ladder');
                showToast(`Updated "${name}"!`, 'success');
            } else {
                const id = 'cl_' + now;
                const payload = {
                    id,
                    name,
                    createdAt: now,
                    updatedAt: now,
                    lastUsed: now,
                    usageCount: 1,
                    ...ws,
                    activeSetId: id
                };
                state.savedSets.unshift(payload);
                state.activeSetId = id;
                if (setNameInputEl) setNameInputEl.value = name;
                closeModal('saveModal');
                persistSavedSets();
                playSound('ladder');
                showToast(`Saved "${name}"!`, 'success');
            }
        };

        document.getElementById('save-set-btn').addEventListener('click', () => {
            const inlineName = setNameInputEl ? setNameInputEl.value.trim() : '';
            if (inlineName) {
                confirmSave(inlineName);
                return;
            }
            const existing = state.savedSets.find(s => s.id === state.activeSetId);
            saveInput.value = existing
                ? existing.name
                : (document.getElementById('custom-title').value.trim() || 'My Slides & Ladders');
            openModal('saveModal');
            saveInput.focus();
            saveInput.select();
        });

        document.getElementById('save-as-btn').addEventListener('click', () => {
            const existing = state.savedSets.find(s => s.id === state.activeSetId);
            const base = existing?.name || setNameInputEl?.value.trim() || 'My Slides & Ladders';
            saveInput.value = `${base} (Copy)`;
            saveModal.dataset.forceNew = 'true';
            openModal('saveModal');
            saveInput.focus();
            saveInput.select();
        });

        if (setNameInputEl) {
            setNameInputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('save-set-btn').click();
                }
            });
        }

        document.getElementById('save-modal-cancel').addEventListener('click', () => {
            delete saveModal.dataset.forceNew;
            closeModal('saveModal');
        });
        saveModal.addEventListener('click', (e) => {
            if (e.target === saveModal) {
                delete saveModal.dataset.forceNew;
                closeModal('saveModal');
            }
        });
        document.getElementById('save-modal-confirm').addEventListener('click', () => {
            const forceNew = saveModal.dataset.forceNew === 'true';
            delete saveModal.dataset.forceNew;
            confirmSave(undefined, { forceNew });
        });
        saveInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const forceNew = saveModal.dataset.forceNew === 'true';
                delete saveModal.dataset.forceNew;
                confirmSave(undefined, { forceNew });
            } else if (e.key === 'Escape') {
                e.preventDefault();
                delete saveModal.dataset.forceNew;
                closeModal('saveModal');
            }
        });

        // Confirm Modal
        const confirmModal = document.getElementById('confirmModal');
        document.getElementById('confirmBtnNo').addEventListener('click', closeConfirm);
        confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) closeConfirm(); });
        document.getElementById('confirmBtnYes').addEventListener('click', () => {
            if (typeof confirmCallback === 'function') confirmCallback();
            closeConfirm();
        });

        // Global Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            const bulkOverlay = document.getElementById('chutes-bulk-import-overlay');
            const isBulkOpen = bulkOverlay && !bulkOverlay.classList.contains('hidden');
            const isTileOpen = !document.getElementById('tileModal').classList.contains('hidden');
            const isWinOpen = !document.getElementById('winModal').classList.contains('hidden');
            const isHelpOpen = !document.getElementById('helpModal').classList.contains('hidden');
            const isSaveOpen = !document.getElementById('saveModal').classList.contains('hidden');
            const isConfirmOpen = !document.getElementById('confirmModal').classList.contains('hidden');

            if (e.key === 'Escape') {
                if (isConfirmOpen) { closeConfirm(); return; }
                if (isSaveOpen) { delete saveModal.dataset.forceNew; closeModal('saveModal'); return; }
                if (isTileOpen) { closeTileModal(); return; }
                if (isWinOpen) { closeModal('winModal'); return; }
                if (isHelpOpen) { closeModal('helpModal'); return; }
                if (state.editLinksMode) { setEditLinksMode(false); return; }
                if (state.focusMode) { toggleSmartboardFocusMode(false); return; }
                return;
            }

            if (isBulkOpen || isTileOpen || isWinOpen || isHelpOpen || isSaveOpen || isConfirmOpen) {
                return;
            }

            const tag = (document.activeElement?.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const lower = e.key.toLowerCase();
            if (e.code === 'Space') {
                e.preventDefault();
                rollDice();
            } else if (lower === 'z') {
                e.preventDefault();
                undoLastMove();
            } else if (lower === 'e') {
                e.preventDefault();
                setEditLinksMode(!state.editLinksMode);
            } else if (lower === 'a') {
                e.preventDefault();
                toggleAnswerOverlay();
            } else if (lower === 'f') {
                e.preventDefault();
                toggleSmartboardFocusMode();
            }
        });
    });

    // Expose internal test helpers safely on window for debugging if needed
    window.__chutesDebug = {
        state,
        wrapTextLines,
        fitTileText,
        generateBalancedLinks,
        buildBoardSVG,
        getBoardMetrics,
        parsePromptTag
    };
})();
