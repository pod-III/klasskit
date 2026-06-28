let PRESETS={};
let collections=[],currentCollectionId=null,currentPassages=[],isSetupMode=false,syncTimeout=null;
let playPassages=[],currentStep=0,score=0,isChecking=false;
let passageTokens=[],errorRanges=[],clickedWords=new Set();

// ── Broadcast System ──
const IS_PLAYER_WINDOW = new URLSearchParams(location.search).has('player');
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fix-em-sync') : null;
let _bcThrottle = null, _bcLastTime = 0;

function broadcastState(options = {}) {
    if (!bc || IS_PLAYER_WINDOW) return;
    const now = performance.now();
    const minInterval = options.immediate ? 0 : 80;
    if (_bcThrottle) clearTimeout(_bcThrottle);
    const go = () => { _bcLastTime = performance.now(); _performBroadcast(); };
    if (now - _bcLastTime >= minInterval) go();
    else _bcThrottle = setTimeout(go, minInterval - (now - _bcLastTime));
}
function broadcastFullState() { broadcastState({ immediate: true }); }

function _performBroadcast() {
    const gameVisible = !document.getElementById('game-screen')?.classList.contains('hidden');
    const resultVisible = !document.getElementById('result-screen')?.classList.contains('hidden');
    // Capture word highlights state
    const wordStates = [];
    document.querySelectorAll('#passage-text .passage-word').forEach(el => {
        wordStates.push({ className: el.className, text: el.textContent });
    });
    bc.postMessage({
        type: 'state-update',
        gameVisible,
        resultVisible,
        currentStep,
        totalSteps: playPassages.length,
        score,
        passageHTML: document.getElementById('passage-text')?.innerHTML || '',
        passageFontSize: document.getElementById('passage-text')?.style.fontSize || '',
        passageTag: document.getElementById('passage-tag')?.textContent || '',
        passageTitle: document.getElementById('passage-title')?.textContent || '',
        explanationHTML: document.getElementById('explanation-content')?.innerHTML || '',
        explanationVisible: document.getElementById('explanation-panel')?.classList.contains('visible') || false,
        progressPct: document.getElementById('progress-bar')?.style.width || '0%',
        finalScore: document.getElementById('final-score')?.textContent || '',
        finalMessage: document.getElementById('final-message')?.textContent || '',
    });
}

if (bc && IS_PLAYER_WINDOW) {
    bc.onmessage = ({ data }) => {
        if (data.type !== 'state-update') return;
        if (window._playerRetryInterval) { clearInterval(window._playerRetryInterval); window._playerRetryInterval = null; }
        window._playerLoadingEl?.remove(); window._playerLoadingEl = null;

        // Show correct screen
        document.getElementById('landing-screen')?.classList.add('hidden');
        document.getElementById('setup-mode')?.classList.add('hidden');
        document.getElementById('play-mode')?.classList.remove('hidden');

        if (data.resultVisible) {
            document.getElementById('game-screen')?.classList.add('hidden');
            document.getElementById('result-screen')?.classList.remove('hidden');
            const fm = document.getElementById('final-message'); if (fm) fm.textContent = data.finalMessage;
            const fs = document.getElementById('final-score'); if (fs) fs.textContent = data.finalScore;
        } else if (data.gameVisible) {
            document.getElementById('result-screen')?.classList.add('hidden');
            document.getElementById('game-screen')?.classList.remove('hidden');

            const pt = document.getElementById('passage-text'); if (pt) { pt.innerHTML = data.passageHTML; if (data.passageFontSize) pt.style.fontSize = data.passageFontSize; pt.querySelectorAll('.passage-word').forEach(el => { el.style.pointerEvents = 'none'; el.onclick = null; }); }
            const tag = document.getElementById('passage-tag'); if (tag) tag.textContent = data.passageTag;
            const title = document.getElementById('passage-title'); if (title) title.textContent = data.passageTitle;
            const pb = document.getElementById('progress-bar'); if (pb) pb.style.width = data.progressPct;
            const st = document.getElementById('score-text'); if (st) st.textContent = data.score;
            const pt2 = document.getElementById('progress-text'); if (pt2) pt2.textContent = `${data.currentStep + 1}/${data.totalSteps}`;

            const expPanel = document.getElementById('explanation-panel');
            if (expPanel) { if (data.explanationVisible) expPanel.classList.add('visible'); else expPanel.classList.remove('visible'); }
            const expContent = document.getElementById('explanation-content'); if (expContent) expContent.innerHTML = data.explanationHTML;

            // Hide host-only controls
            document.getElementById('main-check-btn')?.style.setProperty('display', 'none');
            document.getElementById('feedback-controls')?.style.setProperty('display', 'none');
            document.getElementById('click-hint')?.style.setProperty('display', 'none');
        } else {
            document.getElementById('game-screen')?.classList.add('hidden');
            document.getElementById('result-screen')?.classList.add('hidden');
        }

        const sd = document.getElementById('student-info-display');
        if (sd) sd.textContent = data.gameVisible ? `${data.currentStep + 1} / ${data.totalSteps} · Score ${data.score}` : (data.resultVisible ? 'Done!' : 'Waiting...');
    };
}

function initTheme(){const saved=localStorage.getItem('theme_hub');if(saved==='dark'||(!saved&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');updateThemeUI();}
function toggleTheme(){const isDark=document.documentElement.classList.toggle('dark');localStorage.setItem('theme_hub',isDark?'dark':'light');updateThemeUI();}
function updateThemeUI(){const isDark=document.documentElement.classList.contains('dark');const icon=document.getElementById('theme-icon');if(icon){icon.setAttribute('data-lucide',isDark?'sun':'moon');lucide.createIcons();}}

function toggleMode(target){isSetupMode=target==='setup'?true:(target==='play'?false:!isSetupMode);const setup=document.getElementById('setup-mode'),play=document.getElementById('play-mode'),toggleBtn=document.getElementById('setup-toggle'),icon=toggleBtn.querySelector('[data-lucide]');if(isSetupMode){setup.classList.remove('hidden');setup.classList.add('grid');play.classList.add('hidden');toggleBtn.querySelector('span').textContent='PLAY';if(icon)icon.setAttribute('data-lucide','play');renderCollections();renderEditor();}else{setup.classList.add('hidden');setup.classList.remove('grid');play.classList.remove('hidden');toggleBtn.querySelector('span').textContent='SETUP';if(icon)icon.setAttribute('data-lucide','settings');resetGameState();}lucide.createIcons();}

function createNewCollection(){const id='fixem_'+Date.now();const newSet={id,name:"New Grammar Set",passages:[makeDefaultPassage()],timestamp:Date.now()};collections.push(newSet);currentCollectionId=id;currentPassages=newSet.passages;saveData();renderCollections();renderEditor();}
function makeDefaultPassage(){return{id:'p_'+Date.now(),title:'',level:'A1',text:'',errors:[{errorText:'',correction:'',explanation:''}]};}

function selectCollection(id){const set=collections.find(c=>c.id===id);if(set){currentCollectionId=id;currentPassages=set.passages;renderCollections();renderEditor();AudioEngine.playTone(600,'sine',0.1);}}

async function deleteCurrentCollection(){if(collections.length<=1){await showAlertModal("You must have at least one set!",{title:"Cannot Delete",icon:"alert-circle",iconColor:"orange"});return;}const confirmed=await showConfirmModal("Permanently delete this set?",{title:"Delete Set?",confirmText:"Delete",cancelText:"Keep",icon:"trash-2",iconColor:"red"});if(confirmed){collections=collections.filter(c=>c.id!==currentCollectionId);currentCollectionId=collections[0].id;currentPassages=collections[0].passages;saveData();renderCollections();renderEditor();}}

function updateCollectionName(name){const set=collections.find(c=>c.id===currentCollectionId);if(set){set.name=name;saveData();renderCollections();}}

function renderCollections(){const list=document.getElementById('collections-list');list.innerHTML='';collections.sort((a,b)=>b.timestamp-a.timestamp).forEach(set=>{const isActive=set.id===currentCollectionId;const pCount=set.passages.filter(p=>isPassageValid(p)).length;const btn=document.createElement('button');btn.className=`collection-item w-full px-4 py-3 rounded-xl border-2 font-black text-left flex items-center gap-3 shadow-hard-sm transition-all relative overflow-hidden ${isActive?'bg-orange text-white border-dark scale-[1.01]':'bg-chalk dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-orange hover:text-orange dark:hover:text-orange'}`;btn.innerHTML=`${isActive?'<div class="collection-active-stripe"></div>':''}<div class="w-8 h-8 rounded-lg ${isActive?'bg-white/20':'bg-slate-100 dark:bg-slate-700'} flex items-center justify-center shrink-0 border border-dark/10"><i data-lucide="scroll-text" class="w-4 h-4 ${isActive?'text-white':''}"></i></div><span class="flex-1 truncate text-sm">${set.name||'Untitled Set'}</span><span class="text-xs font-black opacity-60 shrink-0">${pCount}P</span>`;btn.onclick=()=>selectCollection(set.id);list.appendChild(btn);});const activeSet=collections.find(c=>c.id===currentCollectionId);const nameInput=document.getElementById('set-name-input');if(nameInput)nameInput.value=activeSet?activeSet.name:"";const landingTitle=document.getElementById('landing-title'),landingDesc=document.getElementById('landing-desc'),startBtn=document.getElementById('start-btn');if(activeSet){landingTitle.textContent=activeSet.name.toUpperCase();const cnt=activeSet.passages.filter(p=>isPassageValid(p)).length;landingDesc.textContent=`${cnt} passage${cnt!==1?'s':''} ready. Can you spot all the errors?`;startBtn.disabled=cnt===0;}else{landingTitle.textContent="NO SET LOADED";landingDesc.textContent="Please create or select a set in SETUP.";startBtn.disabled=true;}lucide.createIcons();}

function isPassageValid(p){return p.title.trim()&&p.text.trim()&&p.errors.some(e=>e.errorText.trim()&&e.correction.trim());}

function addPassage(){currentPassages.push(makeDefaultPassage());saveData();renderEditor();setTimeout(()=>{const editor=document.getElementById('passages-editor');editor.scrollTop=editor.scrollHeight;},50);}
function removePassage(idx){if(currentPassages.length<=1)return;currentPassages.splice(idx,1);saveData();renderEditor();}
function duplicatePassage(idx){const p=currentPassages[idx];const copy=JSON.parse(JSON.stringify(p));copy.id='p_'+Date.now();currentPassages.splice(idx+1,0,copy);saveData();renderEditor();}
function addError(pIdx){currentPassages[pIdx].errors.push({errorText:'',correction:'',explanation:''});saveData();renderEditor();}
function removeError(pIdx,eIdx){const p=currentPassages[pIdx];if(p.errors.length<=1)return;p.errors.splice(eIdx,1);saveData();renderEditor();}
function updatePassageField(pIdx,field,val){currentPassages[pIdx][field]=val;saveData();}
function updateErrorField(pIdx,eIdx,field,val){currentPassages[pIdx].errors[eIdx][field]=val;saveData();}

function renderEditor(){const container=document.getElementById('passages-editor');container.innerHTML='';currentPassages.forEach((p,idx)=>{const card=document.createElement('div');card.className='bg-chalk dark:bg-slate-800 border-2 border-dark dark:border-slate-600 rounded-xl shadow-hard-sm relative group';card.innerHTML=`<div class="flex items-center gap-3 px-5 pt-4 pb-3 border-b-2 border-dark/10 dark:border-slate-700"><span class="w-8 h-8 rounded-lg bg-orange text-white flex items-center justify-center font-heading text-base border-2 border-dark shadow-hard-sm shrink-0">${idx+1}</span><input type="text" value="${escapeHtml(p.title)}" oninput="updatePassageField(${idx},'title',this.value)" placeholder="Passage title..." class="flex-1 bg-transparent border-b-2 border-slate-200 dark:border-slate-600 focus:border-orange outline-none font-heading text-base text-dark dark:text-white placeholder-slate-300 min-w-0"><select onchange="updatePassageField(${idx},'level',this.value)" class="type-select text-[10px] font-black uppercase tracking-widest bg-chalk dark:bg-slate-700 border-2 border-dark/15 dark:border-slate-600 rounded-lg px-2 py-1 text-dark dark:text-white cursor-pointer focus:outline-none focus:border-orange"><option value="A1" ${p.level==='A1'?'selected':''}>A1</option><option value="A2" ${p.level==='A2'?'selected':''}>A2</option><option value="B1" ${p.level==='B1'?'selected':''}>B1</option><option value="B1+" ${p.level==='B1+'?'selected':''}>B1+</option><option value="B2" ${p.level==='B2'?'selected':''}>B2</option><option value="B2+" ${p.level==='B2+'?'selected':''}>B2+</option></select><span class="flex-1"></span><div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onclick="duplicatePassage(${idx})" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue hover:bg-blue/10 shrink-0" title="Duplicate"><i data-lucide="copy" class="w-4 h-4"></i></button><button onclick="removePassage(${idx})" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-pink hover:bg-pink/10 shrink-0" title="Remove"><i data-lucide="x" class="w-4 h-4"></i></button></div></div><div class="px-5 pt-3 pb-2"><textarea oninput="updatePassageField(${idx},'text',this.value)" placeholder="Type the passage text here..." class="w-full bg-white dark:bg-slate-900 border-2 border-dark/20 dark:border-slate-600 rounded-xl px-4 py-3 font-bold text-base text-dark dark:text-white focus:outline-none focus:border-orange dark:focus:border-orange shadow-inner resize-none transition-colors" rows="3">${escapeHtml(p.text)}</textarea></div><div class="px-5 pb-3"><p class="text-[9px] font-black text-pink uppercase tracking-[0.2em] mb-2">Errors</p><div class="space-y-2">${p.errors.map((e,eIdx)=>`<div class="flex items-center gap-2"><input type="text" value="${escapeHtml(e.errorText)}" oninput="updateErrorField(${idx},${eIdx},'errorText',this.value)" placeholder="Error text" class="flex-1 bg-white dark:bg-slate-900 border-2 border-pink/30 dark:border-pink/20 rounded-lg px-3 py-1.5 font-bold text-sm text-dark dark:text-slate-200 focus:outline-none focus:border-pink transition-colors"><span class="text-slate-400 font-black text-xs">→</span><input type="text" value="${escapeHtml(e.correction)}" oninput="updateErrorField(${idx},${eIdx},'correction',this.value)" placeholder="Correction" class="flex-1 bg-white dark:bg-slate-900 border-2 border-green/30 dark:border-green/20 rounded-lg px-3 py-1.5 font-bold text-sm text-dark dark:text-slate-200 focus:outline-none focus:border-green transition-colors">${p.errors.length>1?`<button onclick="removeError(${idx},${eIdx})" class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-pink shrink-0"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>`:''}</div><textarea oninput="updateErrorField(${idx},${eIdx},'explanation',this.value)" placeholder="Explanation (optional)" class="w-full bg-blue/5 dark:bg-blue/5 border-2 border-blue/20 dark:border-blue/30 rounded-lg px-3 py-1.5 font-semibold text-xs text-dark dark:text-slate-200 focus:outline-none focus:border-blue resize-none transition-colors placeholder-slate-400" rows="1">${escapeHtml(e.explanation||'')}</textarea>`).join('')}</div><button onclick="addError(${idx})" class="mt-2 text-xs font-black text-pink hover:text-pink/80 flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> Add error</button></div>`;container.appendChild(card);});lucide.createIcons();}

async function saveData(){const payload={collections,lastId:currentCollectionId,updatedAt:Date.now()};localStorage.setItem('prog_fix_em',JSON.stringify(payload));if(syncTimeout)clearTimeout(syncTimeout);syncTimeout=setTimeout(async()=>{try{await saveProgress('fix_em',payload);}catch(e){console.warn('[FixEm] Cloud save failed:',e);}},2000);}

async function loadData(){const legacyLocal=localStorage.getItem('fix_em_collections');if(legacyLocal){const legacyId=localStorage.getItem('fix_em_last_id');const migrated={collections:JSON.parse(legacyLocal),lastId:legacyId,updatedAt:0};localStorage.setItem('prog_fix_em',JSON.stringify(migrated));localStorage.removeItem('fix_em_collections');localStorage.removeItem('fix_em_last_id');}let localData=null;const localRaw=localStorage.getItem('prog_fix_em');if(localRaw){try{localData=JSON.parse(localRaw);}catch(e){}}if(localData&&localData.collections){collections=localData.collections;currentCollectionId=localData.lastId||(collections[0]?collections[0].id:null);const active=collections.find(c=>c.id===currentCollectionId);currentPassages=active?active.passages:[];}try{const cloud=await loadProgress('fix_em');if(cloud&&cloud.collections&&cloud.collections.length>0){const cloudTime=cloud.updatedAt||0;const localTime=localData?.updatedAt||0;if(cloudTime>=localTime||collections.length===0){collections=cloud.collections;currentCollectionId=cloud.lastId||collections[0].id;const active=collections.find(c=>c.id===currentCollectionId);currentPassages=active?active.passages:(collections[0]?collections[0].passages:[]);localStorage.setItem('prog_fix_em',JSON.stringify(cloud));if(isSetupMode){renderCollections();renderEditor();}}}}catch(e){console.warn('[FixEm] Cloud load failed:',e);}if(collections.length===0)createNewCollection();}

function loadPreset(key,title){if(PRESETS[key]){const id='fixem_preset_'+key+'_'+Date.now();const newSet={id,name:title||key,passages:JSON.parse(JSON.stringify(PRESETS[key])),timestamp:Date.now()};collections.push(newSet);currentCollectionId=id;currentPassages=newSet.passages;saveData();renderCollections();renderEditor();AudioEngine.playTone(800,'sine',0.1);}}
function saveAndPlay(){saveData();toggleMode('play');}

function resetGameState(){currentStep=0;score=0;isChecking=false;clickedWords=new Set();document.getElementById('landing-screen').classList.remove('hidden');document.getElementById('game-screen').classList.add('hidden');document.getElementById('result-screen').classList.add('hidden');document.getElementById('feedback-controls').classList.add('hidden');document.getElementById('main-check-btn').classList.remove('hidden');const hint=document.getElementById('click-hint');if(hint)hint.classList.remove('hidden');}

async function startGame(){const validP=currentPassages.filter(p=>isPassageValid(p));if(validP.length===0){await showAlertModal("Please add some passages in SETUP before starting!",{title:"No Passages",icon:"help-circle",iconColor:"orange"});toggleMode('setup');return;}playPassages=validP;currentStep=0;score=0;isChecking=false;document.getElementById('landing-screen').classList.add('hidden');document.getElementById('result-screen').classList.add('hidden');document.getElementById('game-screen').classList.remove('hidden');renderDots();showPassage();}

function renderDots(){const container=document.getElementById('dots-container');container.innerHTML='';playPassages.forEach((_,idx)=>{const dot=document.createElement('div');dot.className='dot';dot.id=`dot-${idx}`;container.appendChild(dot);});updateProgressBar();}
function updateDots(){playPassages.forEach((_,idx)=>{const dot=document.getElementById(`dot-${idx}`);if(!dot)return;if(idx<currentStep)dot.className='dot completed';else if(idx===currentStep)dot.className='dot active';else dot.className='dot';});updateProgressBar();}
function updateProgressBar(){const bar=document.getElementById('progress-bar');if(!bar)return;if(playPassages.length===0){bar.style.width='0%';return;}const pct=((currentStep+1)/playPassages.length)*100;bar.style.width=pct+'%';}

function fitText(el,container,max,min){if(!el||!container)return;let size=max;el.style.fontSize=size+'px';const isOverflowing=()=>el.scrollHeight>container.clientHeight||el.scrollWidth>container.clientWidth;while(isOverflowing()&&size>min){size-=1;el.style.fontSize=size+'px';}}


function showPassage(){isChecking=false;clickedWords=new Set();setTimeout(()=>broadcastState(),0);const p=playPassages[currentStep];document.getElementById('progress-text').textContent=`${currentStep+1}/${playPassages.length}`;document.getElementById('score-text').textContent=score;document.getElementById('feedback-controls').classList.add('hidden');document.getElementById('main-check-btn').classList.remove('hidden');hideExplanation();const hint=document.getElementById('click-hint');if(hint)hint.classList.remove('hidden');document.getElementById('passage-tag').textContent=`#${currentStep+1} · ${p.level}`;document.getElementById('passage-title').textContent=p.title;updateDots();const passageEl=document.getElementById('passage-text');passageTokens=[];let wordIdx=0,charPos=0;const parts=p.text.split(/(\s+)/);let html='';for(const part of parts){if(/^\s+$/.test(part)){charPos+=part.length;html+=part;}else{passageTokens.push({text:part,wordIdx,charStart:charPos,charEnd:charPos+part.length});html+=`<span class="passage-word clickable" data-word-idx="${wordIdx}" onclick="toggleWord(${wordIdx})">${escapeHtml(part)}</span>`;wordIdx++;charPos+=part.length;}}passageEl.innerHTML=html;fitText(passageEl,document.getElementById('passage-fit-container'),32,14);const validErrors=p.errors.filter(e=>e.errorText.trim()&&e.correction.trim());errorRanges=findErrorRanges(p.text,validErrors,passageTokens);}

function findErrorRanges(text,errors,tokens){const ranges=[];let searchStart=0;for(const error of errors){const idx=text.toLowerCase().indexOf(error.errorText.toLowerCase(),searchStart);if(idx>=0){const endIdx=idx+error.errorText.length;let startWord=-1,endWord=-1;for(const token of tokens){if(token.charEnd>idx&&token.charStart<endIdx){if(startWord===-1)startWord=token.wordIdx;endWord=token.wordIdx;}}if(startWord>=0){ranges.push({error,startWord,endWord});searchStart=endIdx;}}}return ranges;}

function toggleWord(idx){if(isChecking)return;const el=document.querySelector(`[data-word-idx="${idx}"]`);if(!el)return;if(clickedWords.has(idx)){clickedWords.delete(idx);el.classList.remove('selected');}else{clickedWords.add(idx);el.classList.add('selected');AudioEngine.playTone(500,'sine',0.05);}}

function checkAnswers(){if(isChecking)return;isChecking=true;const hint=document.getElementById('click-hint');if(hint)hint.classList.add('hidden');let foundCount=0;const errorWordSet=new Set();errorRanges.forEach(range=>{const allClicked=[];for(let w=range.startWord;w<=range.endWord;w++){allClicked.push(clickedWords.has(w));errorWordSet.add(w);}const isFound=allClicked.every(Boolean);if(isFound)foundCount++;for(let w=range.startWord;w<=range.endWord;w++){const el=document.querySelector(`[data-word-idx="${w}"]`);if(el){el.classList.remove('clickable','selected');el.classList.add(isFound?'marked-found':'marked-missed');}}});clickedWords.forEach(w=>{if(!errorWordSet.has(w)){const el=document.querySelector(`[data-word-idx="${w}"]`);if(el){el.classList.remove('clickable','selected');el.classList.add('marked-wrong');}}});document.querySelectorAll('.passage-word.clickable').forEach(el=>el.classList.remove('clickable'));const errors=errorRanges.map(r=>r.error);const explanationContent=document.getElementById('explanation-content');const explanationHTML=errors.map((e,i)=>{const range=errorRanges[i];const isFound=range&&range.startWord>=0&&Array.from({length:range.endWord-range.startWord+1},(_,w)=>clickedWords.has(range.startWord+w)).every(Boolean);return `<div class="mb-2 last:mb-0"><div class="flex items-center gap-2 mb-0.5"><i data-lucide="${isFound?'check-circle':'x-circle'}" class="w-3.5 h-3.5 ${isFound?'text-green':'text-pink'}"></i><span class="text-xs font-black ${isFound?'text-green':'text-pink'} uppercase tracking-widest">${isFound?'FOUND':'MISSED'}</span></div><p class="text-sm font-bold text-dark dark:text-white">"${escapeHtml(e.errorText)}" → "${escapeHtml(e.correction)}"</p>${e.explanation?`<p class="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">${escapeHtml(e.explanation)}</p>`:''}</div>`;}).join('');explanationContent.innerHTML=explanationHTML;showExplanation();score+=foundCount;document.getElementById('score-text').textContent=score;document.getElementById('feedback-controls').classList.remove('hidden');document.getElementById('main-check-btn').classList.add('hidden');if(foundCount>0){AudioEngine.correct();confetti({particleCount:80,spread:70,origin:{y:0.7},colors:['#00E676','#FF8C42','#2979FF']});}else{AudioEngine.wrong();}lucide.createIcons();}


function showExplanation(){const panel=document.getElementById('explanation-panel');requestAnimationFrame(()=>{panel.classList.add('visible');broadcastState({immediate:true});});}
function hideExplanation(){const panel=document.getElementById('explanation-panel');panel.classList.remove('visible');}
function nextPassage(){currentStep++;if(currentStep<playPassages.length)showPassage();else showResult();broadcastState({immediate:true});}
function showResult(){document.getElementById('game-screen').classList.add('hidden');document.getElementById('result-screen').classList.remove('hidden');setTimeout(()=>broadcastState({immediate:true}),0);const totalErrors=playPassages.reduce((sum,p)=>sum+p.errors.filter(e=>e.errorText.trim()&&e.correction.trim()).length,0);document.getElementById('final-score').textContent=`${score}/${totalErrors}`;const ratio=score/(totalErrors||1);let rank="F",msg="Keep Training! 💪";if(ratio>=0.9){rank="S";msg="LEGENDARY! 🏆";}else if(ratio>=0.8){rank="A";msg="EXCELLENT! ⭐";}else if(ratio>=0.6){rank="B";msg="GREAT JOB! 👍";}else if(ratio>=0.4){rank="C";msg="NOT BAD! 🎯";}const rankEl=document.getElementById('final-rank');rankEl.textContent=rank;rankEl.className='text-4xl font-heading rank-'+rank.toLowerCase();document.getElementById('final-message').textContent=msg;if(ratio>=0.8)confetti({particleCount:200,spread:80,origin:{y:0.6}});}

function escapeHtml(str){if(!str)return'';return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}

window.addEventListener('keydown',(e)=>{if(isSetupMode)return;const gameScreen=document.getElementById('game-screen');if(gameScreen.classList.contains('hidden'))return;if(!isChecking){if(e.key.toLowerCase()==='r'||e.key==='Enter'){e.preventDefault();checkAnswers();return;}}if((e.key==='Enter'||e.key===' ')&&!document.getElementById('feedback-controls').classList.contains('hidden')){e.preventDefault();nextPassage();return;}});

const AudioEngine={playTone(freq,type,duration,vol=0.1){try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,ctx.currentTime);gain.gain.setValueAtTime(vol,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+duration);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+duration);}catch(e){}},correct(){this.playTone(600,'sine',0.2);setTimeout(()=>this.playTone(900,'sine',0.3),100);},wrong(){this.playTone(250,'sawtooth',0.3);}};

// ── Bulk Import ──
let parsedImportPassages = [];
const VALID_LEVELS = ['A1','A2','B1','B1+','B2','B2+'];

function openImportModal() {
    document.getElementById('import-textarea').value = '';
    parsedImportPassages = [];
    updateImportPreview();
    document.getElementById('import-overlay').classList.add('open');
    lucide.createIcons();
    setTimeout(() => document.getElementById('import-textarea').focus(), 300);
}

function closeImportModal() {
    document.getElementById('import-overlay').classList.remove('open');
}

function parseBulkImport(text) {
    const passages = [];
    const warnings = [];
    const blocks = text.split(/\n\s*\n/);

    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
        const block = blocks[blockIdx];
        const lines = block.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//') && !l.startsWith('#'));
        if (lines.length === 0) continue;

        let title = '';
        let level = 'A1';
        let passageText = '';
        let errors = [];
        let currentError = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // ## Title
            if (line.startsWith('##')) {
                title = line.slice(2).trim();
                continue;
            }

            // @Level
            if (line.startsWith('@')) {
                const lvl = line.slice(1).trim().toUpperCase();
                if (VALID_LEVELS.includes(lvl)) {
                    level = lvl;
                } else {
                    warnings.push(`Passage ${passages.length + 1}: Unknown level "@${lvl}" — defaulted to A1. Valid: ${VALID_LEVELS.join(', ')}`);
                }
                continue;
            }

            // > explanation (attaches to current error)
            if (line.startsWith('>')) {
                const expl = line.slice(1).trim();
                if (currentError) {
                    currentError.explanation = expl;
                } else {
                    warnings.push(`Passage ${passages.length + 1}: Explanation ">" found before any error line — ignored.`);
                }
                continue;
            }

            // - errorText = correction
            if (line.startsWith('-')) {
                const rest = line.slice(1).trim();
                const eqIdx = rest.indexOf('=');
                let errorText, correction;
                if (eqIdx >= 0) {
                    errorText = rest.slice(0, eqIdx).trim();
                    correction = rest.slice(eqIdx + 1).trim();
                } else {
                    errorText = rest;
                    correction = '';
                    warnings.push(`Passage ${passages.length + 1}: Error "${errorText.slice(0, 30)}" has no "= correction" — left empty.`);
                }
                currentError = { errorText, correction, explanation: '' };
                errors.push(currentError);
                continue;
            }

            // = correction only (attaches to last error without correction)
            if (line.startsWith('=')) {
                const corr = line.slice(1).trim();
                if (currentError && !currentError.correction) {
                    currentError.correction = corr;
                } else {
                    warnings.push(`Passage ${passages.length + 1}: Correction "=" found without a preceding "-" error line — ignored.`);
                }
                continue;
            }

            // Otherwise: passage text
            passageText += (passageText ? ' ' : '') + line;
        }

        if (!passageText && errors.length === 0 && !title) continue;
        if (!passageText) {
            warnings.push(`Passage ${passages.length + 1}: No passage text found — skipped.`);
            continue;
        }
        if (errors.length === 0) {
            warnings.push(`Passage ${passages.length + 1}: No errors defined — passage will have a blank error entry.`);
            errors.push({ errorText: '', correction: '', explanation: '' });
        }

        passages.push({
            id: 'p_imp_' + Date.now() + '_' + passages.length,
            title: title || 'Imported Passage',
            level,
            text: passageText,
            errors
        });
    }

    return { passages, warnings };
}

function updateImportPreview() {
    const text = document.getElementById('import-textarea').value;
    const result = parseBulkImport(text);
    parsedImportPassages = result.passages;
    const warnings = result.warnings;
    const count = parsedImportPassages.length;
    const previewEl = document.getElementById('import-preview-count');
    const confirmBtn = document.getElementById('import-confirm-btn');
    const previewPanel = document.getElementById('import-preview-panel');
    const previewList = document.getElementById('import-preview-list');
    const warningsEl = document.getElementById('import-warnings');

    const span = previewEl.querySelector('span');
    if (count === 0) {
        span.textContent = '0 passages detected';
        span.className = '';
        confirmBtn.disabled = true;
        previewPanel.classList.add('hidden');
    } else {
        let msg = `${count} passage${count !== 1 ? 's' : ''} detected ✓`;
        if (warnings.length > 0) {
            msg += ` (${warnings.length} warning${warnings.length !== 1 ? 's' : ''})`;
        }
        span.textContent = msg;
        span.className = warnings.length > 0 ? 'text-orange' : 'text-green';
        confirmBtn.disabled = false;

        previewPanel.classList.remove('hidden');
        const levelColors = {
            'A1': 'bg-blue/15 text-blue', 'A2': 'bg-green/15 text-green',
            'B1': 'bg-orange/15 text-orange', 'B1+': 'bg-orange/15 text-orange',
            'B2': 'bg-pink/15 text-pink', 'B2+': 'bg-pink/15 text-pink'
        };
        previewList.innerHTML = parsedImportPassages.map((p, i) => {
            const color = levelColors[p.level] || levelColors['A1'];
            const truncTitle = p.title.length > 25 ? p.title.slice(0, 25) + '…' : p.title;
            const errCount = p.errors.filter(e => e.errorText.trim() && e.correction.trim()).length;
            return `<span class="import-badge ${color}" title="${escapeHtml(p.title)}">${i + 1}. ${p.level} <span class="opacity-60 font-semibold ml-1 truncate max-w-[120px]">${escapeHtml(truncTitle)}</span> <span class="opacity-40">${errCount}E</span></span>`;
        }).join('');

        if (warnings.length > 0) {
            warningsEl.innerHTML = warnings.map(w => `<p class="text-[10px] font-bold text-orange flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3 shrink-0"></i> ${escapeHtml(w)}</p>`).join('');
        } else {
            warningsEl.innerHTML = '';
        }
    }
    lucide.createIcons();
}

function confirmImport() {
    if (parsedImportPassages.length === 0) return;

    const set = collections.find(c => c.id === currentCollectionId);
    if (!set) return;

    const existing = set.passages.filter(p => isPassageValid(p));
    set.passages = [...existing, ...parsedImportPassages];
    currentPassages = set.passages;

    saveData();
    renderCollections();
    renderEditor();
    closeImportModal();
    AudioEngine.playTone(700, 'sine', 0.15);
    setTimeout(() => AudioEngine.playTone(900, 'sine', 0.15), 120);

    setTimeout(() => {
        const editor = document.getElementById('passages-editor');
        editor.scrollTop = editor.scrollHeight;
    }, 100);
}

function copyTemplate() {
    const template = `// ============================================================
//  KLASSKIT FIX-EM BULK IMPORT TEMPLATE
//  Remove these comment lines (starting with // or #) before
//  importing, or leave them — they are ignored by the parser.
// ============================================================

// --- Passage format ---
// ## Title (optional, defaults to "Imported Passage")
// @Level (optional: A1, A2, B1, B1+, B2, B2+ — defaults to A1)
// Passage text on the next line(s).
// - errorText = correction (one per line)
// > explanation (optional, after each error)
// Separate passages with a blank line.

## My Daily Routine
@A1
Every day, I gets up at 7:00 AM. I eats breakfast with my family.
- gets up = get up
> Incorrect third-person -s on a first-person pronoun.
- eats = eat
> Same subject-verb agreement issue.

## At the Supermarket
@A1
Today, Sarah and John is at the supermarket. They wants to buy some fruits.
- is = are
> Plural subject needs 'are'.
- wants = want
> Incorrect third-person plural form.`;
    navigator.clipboard.writeText(template).then(() => {
        AudioEngine.playTone(600, 'sine', 0.1);
    });
}

window.onload=async()=>{
    if (IS_PLAYER_WINDOW) {
        document.title = 'Student View | Fix-Em';
        document.getElementById('btn-open-player')?.style.setProperty('display','none');
        document.getElementById('setup-toggle')?.style.setProperty('display','none');
        document.getElementById('player-toolbar')?.classList.remove('hidden');
        document.getElementById('play-mode')?.classList.remove('hidden');
        document.getElementById('setup-mode')?.classList.add('hidden');
        initTheme();
        lucide.createIcons();
        const loadingEl = document.createElement('div');
        loadingEl.className = 'fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-2.5 bg-white/95 border-2 border-dark rounded-full shadow-hard backdrop-blur-sm';
        loadingEl.innerHTML = `<svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg><span class="font-bold text-xs text-slate-500 uppercase tracking-widest">Connecting...</span>`;
        document.body.appendChild(loadingEl);
        window._playerLoadingEl = loadingEl;
        const ping = () => bc?.postMessage({ type: 'player-ready' });
        ping(); window._playerRetryInterval = setInterval(ping, 2000);
        return;
    }
    await requireAuth();
    initTheme();
    try{const res=await fetch('presets.json');PRESETS=await res.json();}catch(e){console.warn('Could not load presets.json:',e);}
    await loadData();
    lucide.createIcons();
    if (bc) bc.onmessage = (evt) => { if (evt.data?.type === 'player-ready') broadcastFullState(); };
    document.getElementById('btn-open-player')?.addEventListener('click', () => {
        window.open(location.pathname + '?player=1', 'fixem-student', 'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no');
    });
};
