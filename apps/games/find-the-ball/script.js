        // --- GAME STATE ---
        const BALL_COLORS = [
            { name: 'Orange',  value: '#FF8C42', light: '#FFB74D', dark: '#E65100' },
            { name: 'Red',     value: '#FF5252', light: '#FF8A80', dark: '#C62828' },
            { name: 'Yellow',  value: '#FFD740', light: '#FFF59D', dark: '#FBC02D' },
            { name: 'Green',   value: '#69F0AE', light: '#B9F6CA', dark: '#2E7D32' },
            { name: 'Blue',    value: '#448AFF', light: '#82B1FF', dark: '#1565C0' },
            { name: 'Purple',  value: '#E040FB', light: '#EA80FC', dark: '#8E24AA' },
            { name: 'Pink',    value: '#FF6B95', light: '#FFAB91', dark: '#C2185B' },
        ];

        let gameState = {
            cupCount: 3,
            ballCount: 1,
            shuffleSpeed: 1.0,
            isShuffling: false,
            isPlaying: false,
            ballPositions: [],
            cupPositions: [],
            selectedCupIndex: 1,
            selectedBgIndex: 1,
            ballColorIndex: 0,
            foundBallsCount: 0
        };

        // --- DOM REFERENCES ---
        const stage = document.getElementById('game-stage');
        
        // --- INITIALIZATION ---
        async function init() {
            await requireAuth();
            
            // Load progress from cloud
            const savedState = await loadProgress('magic_cups');
            if (savedState) {
                gameState.cupCount = savedState.cupCount ?? 3;
                gameState.ballCount = savedState.ballCount ?? 1;
                gameState.shuffleSpeed = savedState.shuffleSpeed ?? 1.0;
                gameState.selectedCupIndex = savedState.selectedCupIndex ?? 1;
                gameState.selectedBgIndex = savedState.selectedBgIndex ?? 1;
                gameState.ballColorIndex = savedState.ballColorIndex ?? 0;
            }

            lucide.createIcons();
            updateStepperUI();
            updateSpeedSetting(true);
            renderDesignSelector();
            renderBgSelector();
            renderBallColorPicker();
            renderCups();
            lucide.createIcons();
            updateStatus('ready');
            
            if(window.innerWidth < 768) {
                toggleControlPanel(true);
            }
        }

        // --- CLOUD PERSISTENCE ---
        let saveTimeout;
        function triggerCloudSave() {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                saveProgress('magic_cups', {
                    cupCount: gameState.cupCount,
                    ballCount: gameState.ballCount,
                    shuffleSpeed: gameState.shuffleSpeed,
                    selectedCupIndex: gameState.selectedCupIndex,
                    selectedBgIndex: gameState.selectedBgIndex,
                    ballColorIndex: gameState.ballColorIndex
                });
            }, 1000);
        }

        // --- LOGIC: SETTINGS ---
        function changeCups(delta) {
            if(gameState.isPlaying) return;
            const newVal = gameState.cupCount + delta;
            if (newVal >= 2 && newVal <= 8) {
                gameState.cupCount = newVal;
                if(gameState.ballCount >= gameState.cupCount) gameState.ballCount = gameState.cupCount - 1;
                updateStepperUI();
                renderCups();
                triggerCloudSave();
            }
        }

        function changeBalls(delta) {
            if(gameState.isPlaying) return;
            const newVal = gameState.ballCount + delta;
            if (newVal >= 1 && newVal < gameState.cupCount) {
                gameState.ballCount = newVal;
                updateStepperUI();
                triggerCloudSave();
            }
        }

        function updateStepperUI() {
            document.getElementById('cup-count-display').innerText = gameState.cupCount;
            document.getElementById('ball-count-display').innerText = gameState.ballCount;
            document.getElementById('btn-cup-minus').disabled = (gameState.cupCount <= 2);
            document.getElementById('btn-cup-plus').disabled = (gameState.cupCount >= 8);
            document.getElementById('btn-ball-minus').disabled = (gameState.ballCount <= 1);
            document.getElementById('btn-ball-plus').disabled = (gameState.ballCount >= gameState.cupCount - 1);
        }

        function updateSpeedSetting(skipSave = false) {
            const sliderVal = parseInt(document.getElementById('speed-slider').value);
            const speedFactor = sliderVal / 10;
            gameState.shuffleSpeed = speedFactor;
            document.getElementById('speed-display').innerText = `${speedFactor.toFixed(1)}X`;
            if (!skipSave) triggerCloudSave();
        }

        // --- LOGIC: RENDER ---
        function renderDesignSelector() {
            const selector = document.getElementById('cup-design-selector');
            selector.innerHTML = '';
            for (let i = 1; i <= 10; i++) {
                const button = document.createElement('button');
                button.type = 'button';
                button.id = `cup-select-${i}`;
                button.className = 'p-1 bg-white rounded-xl border-2 border-dark shadow-hard-sm hover:-translate-y-0.5 hover:shadow-hard active:translate-y-0 transition-all duration-200 group overflow-hidden';
                button.innerHTML = `
                    <div class="w-full aspect-[4/5] bg-slate-50 rounded-lg flex items-center justify-center relative">
                        <img src="./cups/cup-${i}.webp" class="w-3/4 h-3/4 object-contain transition-transform group-hover:scale-110 duration-300" alt="Design ${i}" draggable="false">
                        <div class="absolute inset-0 bg-blue/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                `;
                button.onclick = () => selectCupDesign(i);
                selector.appendChild(button);
            }
            highlightSelectedDesign(gameState.selectedCupIndex);
        }

        function highlightSelectedDesign(index) {
            document.querySelectorAll('#cup-design-selector button').forEach(btn => {
                btn.classList.remove('border-blue', 'ring-2', 'ring-blue/30');
                btn.classList.add('border-dark');
            });
            const selectedBtn = document.getElementById(`cup-select-${index}`);
            if(selectedBtn) {
                selectedBtn.classList.remove('border-dark');
                selectedBtn.classList.add('border-blue', 'ring-2', 'ring-blue/30');
            }
        }

        function selectCupDesign(index) {
            if(gameState.isPlaying) return;
            gameState.selectedCupIndex = index;
            highlightSelectedDesign(index);
            renderCups();
            triggerCloudSave();
        }

        // --- LOGIC: BACKGROUND RENDER ---
        function renderBgSelector() {
            const selector = document.getElementById('bg-selector');
            selector.innerHTML = '';
            for (let i = 1; i <= 6; i++) {
                const button = document.createElement('button');
                button.type = 'button';
                button.id = `bg-select-${i}`;
                button.className = 'p-1 bg-white rounded-xl border-2 border-dark shadow-hard-sm hover:-translate-y-0.5 hover:shadow-hard active:translate-y-0 transition-all duration-200 group overflow-hidden';
                button.innerHTML = `
                    <div class="w-full aspect-[16/10] bg-slate-50 rounded-lg relative overflow-hidden">
                        <img src="./bg/bg-${i}.webp" class="w-full h-full object-cover transition-transform group-hover:scale-110 duration-300" alt="Theme ${i}" draggable="false">
                        <div class="absolute inset-0 bg-blue/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                `;
                button.onclick = () => selectBg(i);
                selector.appendChild(button);
            }
            highlightSelectedBg(gameState.selectedBgIndex);
            applyBg();
        }

        function highlightSelectedBg(index) {
            document.querySelectorAll('#bg-selector button').forEach(btn => {
                btn.classList.remove('border-blue', 'ring-2', 'ring-blue/30');
                btn.classList.add('border-dark');
            });
            const selectedBtn = document.getElementById(`bg-select-${index}`);
            if(selectedBtn) {
                selectedBtn.classList.remove('border-dark');
                selectedBtn.classList.add('border-blue', 'ring-2', 'ring-blue/30');
            }
        }

        function selectBg(index) {
            if(gameState.isPlaying) return;
            gameState.selectedBgIndex = index;
            highlightSelectedBg(index);
            applyBg();
            triggerCloudSave();
        }

        function cycleCupDesign() {
            if(gameState.isPlaying) return;
            const next = gameState.selectedCupIndex >= 10 ? 1 : gameState.selectedCupIndex + 1;
            selectCupDesign(next);
        }

        function cycleBackground() {
            if(gameState.isPlaying) return;
            const next = gameState.selectedBgIndex >= 6 ? 1 : gameState.selectedBgIndex + 1;
            selectBg(next);
        }

        // --- LOGIC: BALL COLOR ---
        function renderBallColorPicker() {
            const selector = document.getElementById('ball-color-selector');
            selector.innerHTML = '';
            BALL_COLORS.forEach((color, i) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.id = `ball-color-select-${i}`;
                button.className = 'ball-swatch';
                button.title = color.name;
                button.innerHTML = `
                    <div class="ball-swatch-inner" style="background: radial-gradient(circle at 30% 30%, ${color.light}, ${color.value}, ${color.dark});"></div>
                    <div class="ball-swatch-check"><i data-lucide="check" class="w-3 h-3 text-white"></i></div>
                `;
                button.onclick = () => selectBallColor(i);
                selector.appendChild(button);
            });
            highlightSelectedBallColor(gameState.ballColorIndex);
        }

        function highlightSelectedBallColor(index) {
            document.querySelectorAll('#ball-color-selector .ball-swatch').forEach((btn, i) => {
                const check = btn.querySelector('.ball-swatch-check');
                if (i === index) {
                    btn.classList.add('active');
                    if(check) check.style.opacity = '1';
                } else {
                    btn.classList.remove('active');
                    if(check) check.style.opacity = '0';
                }
            });
        }

        function selectBallColor(index) {
            if(gameState.isPlaying) return;
            gameState.ballColorIndex = index;
            highlightSelectedBallColor(index);
            renderCups();
            triggerCloudSave();
        }

        function applyBg() {
            const gameArea = document.getElementById('game-area');
            if(gameArea) {
                gameArea.style.backgroundImage = `url('./bg/bg-${gameState.selectedBgIndex}.webp')`;
            }
        }

        function renderCups() {
            stage.innerHTML = '';
            gameState.cupPositions = [];
            
            const stageWidth = stage.clientWidth;
            const cupBaseWidth = 180; 
            const gap = 30; 
            const totalRequiredWidth = (gameState.cupCount * cupBaseWidth) + ((gameState.cupCount - 1) * gap);
            
            let scale = 1;
            if (totalRequiredWidth > (stageWidth - 20)) {
                scale = (stageWidth - 40) / totalRequiredWidth;
            }
            
            const actualTotalWidth = totalRequiredWidth * scale;
            const startX = (stageWidth - actualTotalWidth) / 2;

            for (let i = 0; i < gameState.cupCount; i++) {
                const cup = document.createElement('div');
                cup.className = 'cup-container';
                cup.id = `cup-${i}`;
                
                const visualIndexOffset = i * (cupBaseWidth + gap);
                const xPos = startX + (visualIndexOffset * scale);
                gameState.cupPositions.push(xPos); 
                
                const imageIndex = gameState.selectedCupIndex; 
                
                cup.style.transform = `translate(${xPos}px, 0) scale(${scale})`;
                cup.style.width = `${cupBaseWidth}px`; 

                const bc = BALL_COLORS[gameState.ballColorIndex];
                cup.innerHTML = `
                    <div class="cup-label text-xl transition-opacity duration-300 opacity-0" data-original-id="${i}">Cup ${i + 1}</div>
                    <img src="./cups/cup-${imageIndex}.webp" class="cup-img" alt="Cup ${i+1}" draggable="false">
                    <div class="ball" id="ball-${i}" style="background: radial-gradient(circle at 30% 30%, ${bc.light}, ${bc.value}, ${bc.dark});"></div>
                `;
                
                cup.style.left = '0px'; 
                cup.dataset.scale = scale; 
                cup.onclick = () => handleCupClick(i);
                stage.appendChild(cup);
            }
        }
        
        function getTranslateX(el) {
            const style = window.getComputedStyle(el);
            const transform = style.transform;
            if (transform === 'none') return 0;
            if (transform.startsWith('matrix3d')) {
                const values = transform.match(/matrix3d\((.+)\)/);
                return values ? parseFloat(values[1].split(', ')[12]) : 0; 
            }
            if (transform.startsWith('matrix')) {
                const values = transform.match(/matrix\((.+)\)/);
                return values ? parseFloat(values[1].split(', ')[4]) : 0;
            }
            return 0;
        }

        function updateLabelsByPosition() {
            const cups = Array.from(document.querySelectorAll('.cup-container'));
            const sortedCups = cups
                .map(cup => ({ element: cup, x: getTranslateX(cup) }))
                .sort((a, b) => a.x - b.x);

            sortedCups.forEach((item, index) => {
                const label = item.element.querySelector('.cup-label');
                if (label) label.textContent = `Cup ${index + 1}`; 
            });
        }

        // --- STATUS & UI UPDATE ---
        function updateStatus(state, msg = "") {
            const badge = document.getElementById('status-badge');
            const dot = document.getElementById('status-dot');
            const text = document.getElementById('status-text');

            // Reset classes
            badge.className = "px-4 py-1.5 rounded-full border-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm";
            dot.className = "w-2 h-2 rounded-full transition-colors";

            if (state === 'ready') {
                badge.classList.add('bg-slate-100', 'border-slate-200', 'text-slate-500');
                dot.classList.add('bg-slate-400');
                text.innerText = "READY";
            } else if (state === 'shuffling') {
                badge.classList.add('bg-blue/10', 'border-blue/20', 'text-blue');
                dot.classList.add('bg-blue', 'animate-ping');
                text.innerText = "SHUFFLING...";
            } else if (state === 'guessing') {
                badge.classList.add('bg-orange/10', 'border-orange/20', 'text-orange');
                dot.classList.add('bg-orange', 'animate-pulse');
                text.innerText = "GUESS NOW!";
            } else if (state === 'win') {
                badge.classList.add('bg-green/10', 'border-green/20', 'text-green');
                dot.classList.add('bg-green');
                text.innerText = "ALL FOUND!";
            } else if (state === 'progress') {
                badge.classList.add('bg-green/10', 'border-green/20', 'text-green');
                dot.classList.add('bg-green');
                text.innerText = msg;
            } else if (state === 'empty') {
                badge.classList.add('bg-pink/10', 'border-pink/20', 'text-pink');
                dot.classList.add('bg-pink');
                text.innerText = "EMPTY";
            }
        }

        // --- GAMEFLOW ---

        async function startGame() {
            if (gameState.isShuffling || gameState.isPlaying) return;
            
            gameState.isPlaying = true;
            gameState.foundBallsCount = 0; 
            toggleControls(false);
            
            const startBtn = document.getElementById('start-btn');
            startBtn.innerHTML = '<i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i><span>PREPARING...</span>';
            startBtn.classList.replace('bg-green', 'bg-slate-200');
            startBtn.classList.replace('text-dark', 'text-slate-400');
            startBtn.classList.remove('animate-pulse-slow');
            
            updateStatus('shuffling'); 
            
            if(window.innerWidth < 768) toggleControlPanel(true);

            // 1. Setup Balls
            gameState.ballPositions = [];
            let availableIndices = Array.from({length: gameState.cupCount}, (_, i) => i);
            for(let i = 0; i < gameState.ballCount; i++) {
                const randomIndex = Math.floor(Math.random() * availableIndices.length);
                gameState.ballPositions.push(availableIndices.splice(randomIndex, 1)[0]);
            }
            
            // 2. Reveal
            for (const ballIndex of gameState.ballPositions) {
                const winningCup = document.getElementById(`cup-${ballIndex}`);
                winningCup.classList.add('lifted');
                winningCup.querySelector('.ball').classList.add('visible');
            }
            await wait(1000);
            
            // 3. Hide
            for (const ballIndex of gameState.ballPositions) {
                document.getElementById(`cup-${ballIndex}`).classList.remove('lifted');
            }
            await wait(500);
            
            // 4. Shuffle
            gameState.isShuffling = true;
            await performShuffle();
            
            // 5. Ready
            gameState.isShuffling = false;
            updateLabelsByPosition(); 
            document.querySelectorAll('.cup-label').forEach(label => {
                label.classList.remove('opacity-0');
                label.classList.add('opacity-100');
            });
            
            updateStatus('guessing');
            
            // Button to Reset State
            startBtn.innerHTML = '<i data-lucide="rotate-ccw" class="w-6 h-6"></i><span>RESET</span>';
            startBtn.classList.replace('bg-slate-200', 'bg-pink');
            startBtn.classList.replace('text-slate-400', 'text-white');
            startBtn.onclick = resetGame; 
            startBtn.disabled = false;
            
            lucide.createIcons();
        }

        async function performShuffle() {
            const swaps = 10;
            const baseTimeMs = 350; 
            const speedMs = baseTimeMs / gameState.shuffleSpeed; 
            let currentOrder = Array.from({length: gameState.cupCount}, (_, i) => i);

            for(let n=0; n<swaps; n++) {
                let slotA = Math.floor(Math.random() * gameState.cupCount);
                let slotB = Math.floor(Math.random() * gameState.cupCount);
                while(slotA === slotB) slotB = Math.floor(Math.random() * gameState.cupCount);

                const cupIdA = currentOrder[slotA];
                const cupIdB = currentOrder[slotB];
                const elA = document.getElementById(`cup-${cupIdA}`);
                const elB = document.getElementById(`cup-${cupIdB}`);

                elA.style.zIndex = 20; elB.style.zIndex = 10;

                const scale = elA.dataset.scale || 1;
                elA.style.transition = `transform ${speedMs/1000}s ease-in-out`;
                elB.style.transition = `transform ${speedMs/1000}s ease-in-out`;
                
                elA.style.transform = `translate(${gameState.cupPositions[slotB]}px, 0) scale(${scale})`;
                elB.style.transform = `translate(${gameState.cupPositions[slotA]}px, 0) scale(${scale})`;

                await wait(speedMs);

                currentOrder[slotA] = cupIdB;
                currentOrder[slotB] = cupIdA;
                elA.style.zIndex = 10;
            }
        }

        function feedbackFlash(type) {
            const area = document.getElementById('game-area');
            const colorClass = type === 'good' ? 'bg-green/10' : 'bg-pink/10';
            area.classList.add(colorClass);
            setTimeout(() => area.classList.remove(colorClass), 300);
        }

        function handleCupClick(idIndex) {
            if (!gameState.isPlaying || gameState.isShuffling) return;

            const selectedCup = document.getElementById(`cup-${idIndex}`);
            if(selectedCup.classList.contains('lifted')) return;

            selectedCup.classList.add('clicked');
            
            setTimeout(() => {
                selectedCup.classList.remove('clicked');
                selectedCup.classList.add('lifted');
                
                const isBall = gameState.ballPositions.includes(idIndex);
                feedbackFlash(isBall ? 'good' : 'bad');

                if (isBall) {
                    gameState.foundBallsCount++;
                    selectedCup.querySelector('.ball').classList.add('visible');
                    
                    if(gameState.foundBallsCount >= gameState.ballCount) {
                         updateStatus('win');
                    } else {
                        const remaining = gameState.ballCount - gameState.foundBallsCount;
                        updateStatus('progress', `${gameState.foundBallsCount} FOUND / ${remaining} LEFT`);
                    }
                } else {
                    updateStatus('empty');
                    setTimeout(() => {
                        if(gameState.foundBallsCount < gameState.ballCount) updateStatus('guessing');
                    }, 1500);
                }
            }, 150);
        }

        function resetGame() {
            gameState.isPlaying = false;
            gameState.isShuffling = false;
            gameState.ballPositions = [];
            gameState.foundBallsCount = 0;
            
            toggleControls(true);
            
            const startBtn = document.getElementById('start-btn');
            startBtn.innerHTML = '<i data-lucide="play" class="w-6 h-6 fill-dark"></i><span>START GAME</span>';
            startBtn.className = "w-full btn-chunky bg-green text-dark py-3.5 rounded-2xl text-xl tracking-widest flex items-center justify-center gap-3 hover:brightness-105 animate-pulse-slow";
            startBtn.onclick = startGame; 
            
            updateStatus('ready');
            lucide.createIcons();
            renderCups(); 
        }

        function toggleControls(enable) {
            document.getElementById('start-btn').disabled = !enable;
            
            const steppers = document.querySelectorAll('.btn-stepper');
            steppers.forEach(btn => btn.disabled = !enable);
            if(enable) updateStepperUI();

            document.getElementById('speed-slider').disabled = !enable;
            document.getElementById('speed-slider').style.opacity = enable ? '1' : '0.5';

            const designBtns = document.querySelectorAll('#cup-design-selector button');
            designBtns.forEach(btn => {
                btn.disabled = !enable;
                if(!enable) btn.classList.add('opacity-50');
                else btn.classList.remove('opacity-50');
            });

            const bgBtns = document.querySelectorAll('#bg-selector button');
            bgBtns.forEach(btn => {
                btn.disabled = !enable;
                if(!enable) btn.classList.add('opacity-50');
                else btn.classList.remove('opacity-50');
            });

            const ballColorBtns = document.querySelectorAll('#ball-color-selector .ball-swatch');
            ballColorBtns.forEach(btn => {
                btn.disabled = !enable;
                if(!enable) btn.classList.add('opacity-50');
                else btn.classList.remove('opacity-50');
            });
        }

        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        function toggleControlPanel(forceHide = false) {
            const controls = document.getElementById('controls');
            const isCurrentlyHidden = window.innerWidth >= 768 
                ? controls.classList.contains('hidden-panel-desktop')
                : controls.classList.contains('hidden-panel-mobile');

            if(forceHide || !isCurrentlyHidden) {
                controls.classList.add('hidden-panel-mobile', 'hidden-panel-desktop');
            } else {
                controls.classList.remove('hidden-panel-mobile', 'hidden-panel-desktop');
            }
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
                renderCups(); 
            }, 350);
        }

        window.addEventListener('resize', () => {
             const controls = document.getElementById('controls');
             if(window.innerWidth >= 768) {
                 controls.classList.remove('hidden-panel-mobile');
             } else {
                 controls.classList.remove('hidden-panel-desktop');
             }
             renderCups();
        });

        init();