// --- 1. CONFIGURATION & REGISTRY ---
const CONFIG = {
    colors: ['pink', 'orange', 'green', 'blue', 'purple', 'red', 'teal', 'indigo'],
    sizes: {
        vocab: {
            auto: 'autofit-text', xs: 'text-sm', sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl',
            xl: 'text-6xl', '2xl': 'text-7xl', '3xl': 'text-8xl'
        },
        text: {
            auto: 'autofit-text', xs: 'text-sm leading-tight', sm: 'text-lg leading-snug', md: 'text-2xl leading-relaxed',
            lg: 'text-4xl leading-tight', xl: 'text-6xl leading-none', '2xl': 'text-7xl leading-none', '3xl': 'text-8xl leading-none'
        },
        table: {
            auto: 'autofit-text', xs: 'text-[10px]', sm: 'text-xs', md: 'text-base', lg: 'text-xl',
            xl: 'text-2xl', '2xl': 'text-3xl', '3xl': 'text-4xl'
        },
        note: {
            auto: 'autofit-text', xs: 'text-xl', sm: 'text-2xl', md: 'text-4xl', lg: 'text-6xl',
            xl: 'text-8xl', '2xl': 'text-9xl', '3xl': 'text-[10rem]'
        },
        formula: {
            auto: 'autofit-text', xs: 'text-lg', sm: 'text-xl', md: 'text-3xl', lg: 'text-5xl',
            xl: 'text-7xl', '2xl': 'text-8xl', '3xl': 'text-9xl'
        },
        title: {
            auto: 'autofit-text', xs: 'text-lg', sm: 'text-xl', md: 'text-2xl', lg: 'text-4xl',
            xl: 'text-5xl', '2xl': 'text-6xl', '3xl': 'text-7xl'
        }
    }
};

const ModuleRegistry = {
    vocab: {
        icon: 'list', color: 'green', label: 'Vocab',
        default: { list: 'Apple\nBanana\nCherry' },
        inputs: (id, d) => `<label class="l">Items</label><textarea class="inp-area h-32" oninput="Store.updateMod('${id}','data.list',this.value)">${d.list || ''}</textarea>`,
        render: (d, c, fs) => {
            const bulletClasses = { xs: 'w-2.5 h-2.5', sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-6 h-6', xl: 'w-8 h-8', '2xl': 'w-10 h-10', '3xl': 'w-12 h-12' };
            const mbClasses = { xs: 'mb-1 gap-2', sm: 'mb-1.5 gap-2.5', md: 'mb-2 gap-4', lg: 'mb-3 gap-5', xl: 'mb-4 gap-6', '2xl': 'mb-5 gap-7', '3xl': 'mb-6 gap-8' };
            const bCls = bulletClasses[fs] || bulletClasses.md;
            const itemCls = mbClasses[fs] || mbClasses.md;
            return `<ul class="p-6 h-full flex flex-col justify-center" style="background: var(--surface-card)">${(d.list || '').split('\n').map(x => `<li class="flex items-center ${itemCls}"><div class="${bCls} bg-brand-${c} shrink-0" style="border: 1px solid var(--border-primary); box-shadow: 1px 1px 0 0 var(--border-primary)"></div><span class="font-body font-bold ${CONFIG.sizes.vocab[fs] || CONFIG.sizes.vocab.md}" style="color: var(--text-primary)">${x}</span></li>`).join('')}</ul>`;
        }
    },
    dodont: {
        icon: 'shield-alert', color: 'red', label: "Do's/Don'ts",
        default: { wrong: 'I go to home.', correct: 'I go home.' },
        inputs: (id, d) => `
            <label class="l text-red-500">Don't Say (Wrong)</label>
            <textarea class="inp-area h-20 mb-2" style="background-color: var(--bg-brand-red-tint)" oninput="Store.updateMod('${id}','data.wrong',this.value)">${d.wrong || ''}</textarea>
            <label class="l text-green-500">Do Say (Correct)</label>
            <textarea class="inp-area h-20" style="background-color: var(--bg-brand-green-tint)" oninput="Store.updateMod('${id}','data.correct',this.value)">${d.correct || ''}</textarea>
        `,
        render: (d, c, fs) => {
            const fontClasses = {
                auto: 'autofit-text', xs: 'text-lg', sm: 'text-xl', md: 'text-3xl', lg: 'text-5xl', xl: 'text-6xl', '2xl': 'text-7xl', '3xl': 'text-8xl'
            };
            const headerFontClasses = {
                auto: 'text-xs', xs: 'text-[10px]', sm: 'text-[11px]', md: 'text-xs', lg: 'text-sm', xl: 'text-base', '2xl': 'text-lg', '3xl': 'text-xl'
            };
            const fCls = fontClasses[fs] || fontClasses.md;
            const hCls = headerFontClasses[fs] || headerFontClasses.md;
            return `
            <div class="h-full flex flex-col">
                <div class="flex-1 p-4 flex flex-col justify-center items-center text-center relative" style="background-color: var(--bg-brand-red-tint); border-bottom: 2px solid var(--border-primary)">
                    <div class="absolute top-2 left-2 p-1 bg-red-500 text-white rounded shadow-sm"><i data-lucide="x" class="w-4 h-4"></i></div>
                    <p class="font-heading font-black text-brand-red opacity-50 ${hCls} uppercase tracking-widest mb-1">DON'T SAY</p>
                    <p class="font-hand ${fCls} line-through decoration-brand-red decoration-4" style="color: var(--text-primary)">${d.wrong || ''}</p>
                </div>
                <div class="flex-1 p-4 flex flex-col justify-center items-center text-center relative" style="background-color: var(--bg-brand-green-tint)">
                    <div class="absolute top-2 left-2 p-1 bg-brand-green text-brand-dark rounded shadow-sm"><i data-lucide="check" class="w-4 h-4"></i></div>
                    <p class="font-heading font-black text-brand-green opacity-50 ${hCls} uppercase tracking-widest mb-1">DO SAY</p>
                    <p class="font-hand ${fCls}" style="color: var(--text-primary)">${d.correct || ''}</p>
                </div>
            </div>`;
        }
    },
    comic: {
        icon: 'film', color: 'pink', label: 'Comic',
        default: { cap1: 'First...', cap2: 'Then...', cap3: 'Finally...' },
        inputs: (id, d) => {
            const mkPanel = (n) => {
                const img = Store.imgCache.get(d[`img${n}`]) || '';
                return `
                <div class="p-2 rounded-lg mb-2 border-2" style="background-color: var(--bg-tertiary); border-color: var(--border-secondary)">
                    <label class="l">Panel ${n}</label>
                    <div class="flex gap-2 mb-2 h-16">
                        <div onclick="App.openImageSelector('${id}', 'img${n}')" class="w-16 h-16 border rounded cursor-pointer flex items-center justify-center overflow-hidden hover:border-brand-dark relative group" style="background-color: var(--surface-card); border-color: var(--border-secondary)">
                            ${img ? `<img src="${img}" class="w-full h-full object-cover">` : `<i data-lucide="image-plus" class="w-4 h-4 text-slate-300"></i>`}
                            <div class="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center"><i data-lucide="edit" class="w-4 h-4 text-white drop-shadow"></i></div>
                        </div>
                        <textarea class="inp-area h-full flex-1 text-xs" oninput="Store.updateMod('${id}','data.cap${n}',this.value)" placeholder="Caption...">${d[`cap${n}`] || ''}</textarea>
                    </div>
                </div>`;
            }
            return `<div>${mkPanel(1)}${mkPanel(2)}${mkPanel(3)}</div>`;
        },
        render: (d, c, fs) => {
            const fontClasses = {
                auto: 'autofit-text', xs: 'text-sm', sm: 'text-lg', md: 'text-xl', lg: 'text-2xl', xl: 'text-3xl', '2xl': 'text-4xl', '3xl': 'text-5xl'
            };
            const bubbleClasses = {
                auto: 'w-6 h-6 text-xs', xs: 'w-4 h-4 text-[9px]', sm: 'w-5 h-5 text-[10px]', md: 'w-6 h-6 text-xs', lg: 'w-8 h-8 text-sm', xl: 'w-10 h-10 text-base', '2xl': 'w-12 h-12 text-lg', '3xl': 'w-14 h-14 text-xl'
            };
            const fCls = fontClasses[fs] || fontClasses.md;
            const bCls = bubbleClasses[fs] || bubbleClasses.md;
            const mkP = (n) => {
                const imgId = d[`img${n}`];
                const src = Store.imgCache.get(imgId);
                return `
                <div class="flex-1 flex flex-col gap-2 min-w-[50px]">
                    <div class="aspect-square border-4 rounded-xl overflow-hidden relative shadow-sm" style="background-color: var(--bg-slate-tint); border-color: var(--border-primary)">
                        ${imgId ? `<img data-idb-id="${imgId}" src="${src || ''}" class="w-full h-full object-cover">` : ''}
                        <div class="absolute top-2 left-2 bg-brand-dark text-white font-black flex items-center justify-center rounded-full ${bCls}">${n}</div>
                    </div>
                    <div class="border-2 rounded-xl p-3 shadow-neo-sm min-h-[4rem] flex items-center justify-center text-center" style="background: var(--surface-card); border-color: var(--border-primary)">
                        <p class="font-hand font-bold ${fCls} leading-tight" style="color: var(--text-primary)">${d[`cap${n}`] || ''}</p>
                    </div>
                </div>`;
            };
            return `<div class="h-full flex gap-4 p-4 items-center justify-center">${mkP(1)}${mkP(2)}${mkP(3)}</div>`;
        }
    },
    grammar_structure: {
        icon: 'layers', color: 'blue', label: 'Formula',
        default: { formula: 'S + V + O', example: 'I eat apples.' },
        inputs: (id, d) => `<label class="l">Formula</label><input class="inp font-heading font-black text-xl mb-2" value="${d.formula || ''}" oninput="Store.updateMod('${id}','data.formula',this.value)"><label class="l">Example</label><textarea class="inp-area font-hand text-xl h-24" oninput="Store.updateMod('${id}','data.example',this.value)">${d.example || ''}</textarea>`,
        render: (d, c, fs) => {
            const exampleClasses = {
                auto: 'autofit-text', xs: 'text-base', sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl', xl: 'text-5xl', '2xl': 'text-6xl', '3xl': 'text-7xl'
            };
            const exCls = exampleClasses[fs] || exampleClasses.md;
            return `<div class="p-8 text-center h-full flex flex-col justify-center" style="background: var(--surface-card)"><div class="mb-4 font-heading font-black text-brand-${c} px-6 py-4 rounded-xl border-2 border-brand-${c} border-dashed ${CONFIG.sizes.formula[fs] || CONFIG.sizes.formula.md}" style="background-color: var(--bg-brand-${c}-tint)">${d.formula || ''}</div><p class="font-hand opacity-80 ${exCls}" style="color: var(--text-secondary)">"${d.example || ''}"</p></div>`;
        }
    },
    text: {
        icon: 'message-square', color: 'orange', label: 'Text',
        default: { text: 'Type your content here...' },
        inputs: (id, d) => `<label class="l">Content</label><textarea class="inp-area h-40" oninput="Store.updateMod('${id}','data.text',this.value)">${d.text || ''}</textarea>`,
        render: (d, c, fs) => `<div class="p-6 font-body whitespace-pre-line h-full flex flex-col justify-center ${CONFIG.sizes.text[fs] || CONFIG.sizes.text.md}" style="background: var(--surface-card); color: var(--text-secondary)">${d.text || ''}</div>`
    },
    dialogue: {
        icon: 'message-circle', color: 'teal', label: 'Dialogue',
        default: { text: "A: Hello!\nB: Hi there!\nA: How are you?" },
        inputs: (id, d) => `<label class="l">Dialogue (Prefix with A: or B:)</label><textarea class="inp-area h-40" oninput="Store.updateMod('${id}','data.text',this.value)">${d.text || ''}</textarea>`,
        render: (d, c, fs) => {
            const lines = (d.text || '').split('\n');
            const bubbles = lines.map(line => {
                const isB = line.trim().startsWith('B:');
                const txt = line.replace(/^[AB]:\s*/, '');
                if (!txt.trim()) return '';
                return `<div class="flex w-full mb-3 ${isB ? 'justify-end' : 'justify-start'}">
                    <div class="${isB ? 'bg-brand-blue text-white rounded-br-none' : 'bg-brand-pink text-brand-dark rounded-bl-none'} px-6 py-3 rounded-3xl border-2 border-brand-dark shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] max-w-[80%] font-body font-bold ${CONFIG.sizes.text[fs] || 'text-2xl'}">${txt}</div>
                </div>`;
            }).join('');
            return `<div class="p-6 h-full flex flex-col justify-center overflow-y-auto custom-scrollbar bg-graph-paper" style="background-color: var(--surface-card)">${bubbles}</div>`
        }
    },
    table: {
        icon: 'grid-3x3', color: 'purple', label: 'Table',
        default: { content: 'Head | Head\nCell | Cell' },
        inputs: (id, d) => {
            if (!d.rows) {
                if (d.content) {
                    d.rows = d.content.split('\n').filter(r => r.trim()).map(r => r.split('|').map(c => c.trim()));
                } else {
                    d.rows = [['Header 1', 'Header 2'], ['Row 1 Col 1', 'Row 1 Col 2']];
                }
            }
            const numCols = d.rows[0] ? d.rows[0].length : 0;
            
            let tableHtml = `<div class="overflow-x-auto w-full border-2 border-slate-200 rounded-xl p-2 mb-3 bg-slate-50 dark:bg-slate-800/50">`;
            tableHtml += `<table class="w-full border-collapse">`;
            
            d.rows.forEach((row, rIdx) => {
                tableHtml += `<tr>`;
                row.forEach((cell, cIdx) => {
                    const isHeader = rIdx === 0;
                    const inputClass = isHeader 
                        ? "w-full p-1.5 text-xs font-black uppercase text-center border-2 border-slate-300 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg outline-none focus:border-brand-blue" 
                        : "w-full p-1.5 text-xs text-left border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg outline-none focus:border-brand-blue";
                    tableHtml += `<td class="p-1 min-w-[100px]">
                        <input type="text" value="${cell.replace(/"/g, '&quot;')}" 
                            class="${inputClass}" 
                            oninput="TableEditor.updateCell('${id}', ${rIdx}, ${cIdx}, this.value)"
                        >
                    </td>`;
                });
                tableHtml += `</tr>`;
            });
            
            tableHtml += `</table></div>`;
            
            const controlsHtml = `
                <div class="flex flex-wrap gap-2 justify-between items-center text-xs mt-2">
                    <div class="flex gap-2">
                        <button onclick="TableEditor.addRow('${id}')" class="neo-btn px-3 py-1.5 bg-brand-green text-white text-[10px] uppercase font-black flex items-center gap-1 shadow-neo-sm"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Row</button>
                        <button onclick="TableEditor.addCol('${id}')" class="neo-btn px-3 py-1.5 bg-brand-blue text-white text-[10px] uppercase font-black flex items-center gap-1 shadow-neo-sm"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Col</button>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="TableEditor.deleteRow('${id}')" class="neo-btn px-3 py-1.5 bg-red-100 dark:bg-red-500/20 text-brand-red text-[10px] uppercase font-black flex items-center gap-1 shadow-neo-sm" ${d.rows.length <= 1 ? 'disabled style="opacity: 0.5; pointer-events: none;"' : ''}><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Row</button>
                        <button onclick="TableEditor.deleteCol('${id}')" class="neo-btn px-3 py-1.5 bg-red-100 dark:bg-red-500/20 text-brand-red text-[10px] uppercase font-black flex items-center gap-1 shadow-neo-sm" ${numCols <= 1 ? 'disabled style="opacity: 0.5; pointer-events: none;"' : ''}><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Col</button>
                    </div>
                </div>
            `;
            
            return `
                <div class="table-editor-container">
                    <label class="lbl mb-2">Interactive Table Editor</label>
                    ${tableHtml}
                    ${controlsHtml}
                </div>
            `;
        },
        render: (d, c, fs) => {
            if (!d.rows) {
                if (d.content) {
                    d.rows = d.content.split('\n').filter(r => r.trim()).map(r => r.split('|').map(c => c.trim()));
                } else {
                    d.rows = [['Header 1', 'Header 2'], ['Row 1 Col 1', 'Row 1 Col 2']];
                }
            }
            const tableHeaderClasses = { xs: 'text-[11px]', sm: 'text-xs', md: 'text-sm', lg: 'text-lg', xl: 'text-xl', '2xl': 'text-2xl', '3xl': 'text-3xl' };
            const thCls = tableHeaderClasses[fs] || tableHeaderClasses.md;
            
            const trs = d.rows.map((row, i) => {
                if (i === 0) return `<tr class="bg-brand-${c} text-white">${row.map(x => `<th class="p-3 font-heading font-black uppercase text-center ${thCls}" style="border-bottom: 4px solid var(--border-primary); color: white;">${x}</th>`).join('')}</tr>`;
                return `<tr class="" style="background-color: ${i % 2 === 0 ? 'transparent' : `var(--bg-brand-${c}-tint)`}">${row.map(x => `<td class="p-3 border font-bold border-brand-dark ${CONFIG.sizes.table[fs] || CONFIG.sizes.table.md}" style="color: var(--text-secondary); border-color: var(--border-primary)">${x}</td>`).join('')}</tr>`;
            }).join('');
            return `<div class="h-full overflow-auto custom-scrollbar" style="background: var(--surface-card)"><table class="w-full text-left border-collapse">${trs}</table></div>`;
        }
    },
    note: {
        icon: 'sticky-note', color: 'red', label: 'Note',
        default: { text: 'Reminder!' },
        inputs: (id, d) => `<label class="l">Note Text</label><textarea class="inp-area font-hand text-xl bg-yellow-50 border-none" oninput="Store.updateMod('${id}','data.text',this.value)">${d.text || ''}</textarea>`,
        render: (d, c, fs) => `<div class="p-8 h-full flex items-center justify-center relative" style="background-color: var(--bg-brand-yellow-tint)"><div class="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-red-500 shadow-sm -mt-3 z-10" style="border: 2px solid var(--border-primary)"></div><p class="font-hand text-center leading-normal rotate-1 ${CONFIG.sizes.note[fs] || CONFIG.sizes.note.md}" style="color: var(--text-primary)">${d.text || ''}</p></div>`
    },
    image: {
        icon: 'image', color: 'teal', label: 'Image',
        default: { url: '', imageId: null },
        inputs: (id, d) => {
            const img = Store.imgCache.get(d.imageId) || d.url;
            return `
                <label class="l">Image Source</label>
                <div class="mb-2 relative w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center overflow-hidden" style="border-color: var(--border-primary); background-color: var(--bg-tertiary)">
                    ${img ? `<img src="${img}" class="absolute inset-0 w-full h-full object-cover opacity-50">` : ''}
                    <div class="relative z-10 flex flex-col items-center gap-2">
                        <button onclick="App.openImageSelector('${id}')" class="neo-btn text-xs px-3 py-2 hover:bg-brand-teal hover:text-white transition-colors" style="background-color: var(--surface-card); color: var(--text-primary)">
                            <i data-lucide="image" class="w-4 h-4 mr-1"></i> ${img ? 'Change Image' : 'Select Image'}
                        </button>
                    </div>
                </div>
                <label class="l">Or External URL</label>
                <input class="inp text-xs" value="${d.url || ''}" oninput="Store.updateMod('${id}','data.url',this.value); Store.updateMod('${id}','data.imageId',null);">
            `;
        },
        render: (d, c, fs) => {
            if (d.imageId) {
                const src = Store.imgCache.get(d.imageId) || ''; 
                return `<div class="w-full h-full flex items-center justify-center overflow-hidden" style="background-color: var(--bg-slate-tint)"><img data-idb-id="${d.imageId}" src="${src}" class="w-full h-full object-cover"></div>`;
            }
            return `<div class="w-full h-full flex items-center justify-center overflow-hidden" style="background-color: var(--bg-slate-tint)"><img src="${d.url}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/400?text=Select+Image'"></div>`;
        }
    }
};

// --- INTERACTIVE TABLE EDITOR ASSISTANT ---
const TableEditor = {
    updateCell(id, r, c, val) {
        const m = Store.current.modules.find(x => x.id === id);
        if (!m || !m.data.rows) return;
        m.data.rows[r][c] = val;
        m.data.content = m.data.rows.map(row => row.join(' | ')).join('\n');
        Renderer.renderPoster();
        Store.triggerSave();
    },
    addRow(id) {
        const m = Store.current.modules.find(x => x.id === id);
        if (!m) return;
        if (!m.data.rows) {
            m.data.rows = [['Header 1', 'Header 2'], ['Row 1 Col 1', 'Row 1 Col 2']];
        }
        const numCols = m.data.rows[0].length;
        const newRow = Array(numCols).fill('New Cell');
        m.data.rows.push(newRow);
        m.data.content = m.data.rows.map(row => row.join(' | ')).join('\n');
        Editor.render(id);
        Renderer.renderPoster();
        Store.triggerSave();
    },
    addCol(id) {
        const m = Store.current.modules.find(x => x.id === id);
        if (!m) return;
        if (!m.data.rows) {
            m.data.rows = [['Header 1', 'Header 2'], ['Row 1 Col 1', 'Row 1 Col 2']];
        }
        m.data.rows.forEach((row, idx) => {
            row.push(idx === 0 ? `Header ${row.length + 1}` : 'New Cell');
        });
        m.data.content = m.data.rows.map(row => row.join(' | ')).join('\n');
        Editor.render(id);
        Renderer.renderPoster();
        Store.triggerSave();
    },
    deleteRow(id) {
        const m = Store.current.modules.find(x => x.id === id);
        if (!m || !m.data.rows || m.data.rows.length <= 1) return;
        m.data.rows.pop();
        m.data.content = m.data.rows.map(row => row.join(' | ')).join('\n');
        Editor.render(id);
        Renderer.renderPoster();
        Store.triggerSave();
    },
    deleteCol(id) {
        const m = Store.current.modules.find(x => x.id === id);
        if (!m || !m.data.rows || m.data.rows[0].length <= 1) return;
        m.data.rows.forEach(row => row.pop());
        m.data.content = m.data.rows.map(row => row.join(' | ')).join('\n');
        Editor.render(id);
        Renderer.renderPoster();
        Store.triggerSave();
    }
};

// --- 2. DATA STORE (DB & STATE) ---
const Store = {
    state: { posters: [], currentId: 'default', theme: 'light' },
    current: null,
    imgCache: new Map(),
    db: null,
    debounce: null,

    async init() {
        // IDB
        Store.db = await new Promise((res, rej) => {
            const req = indexedDB.open('PosterStudioDB', 2);
            req.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains('imgs')) e.target.result.createObjectStore('imgs'); };
            req.onsuccess = e => res(e.target.result);
            req.onerror = rej;
        });

        // LocalStorage
        const local = localStorage.getItem('poster-studio-v2');
        if (local) Store.state = JSON.parse(local);

        // Sync from Cloud
        await Store.loadFromCloud();

        if (!Store.state.posters.length) App.createNewPoster();

        Store.loadCurrent();
    },

    loadCurrent() {
        Store.current = Store.state.posters.find(p => p.id === Store.state.currentId) || Store.state.posters[0];
    },

    save(visual = false) {
        Store.current.lastModified = Date.now();
        const idx = Store.state.posters.findIndex(p => p.id === Store.current.id);
        Store.state.posters[idx] = Store.current;
        localStorage.setItem('poster-studio-v2', JSON.stringify(Store.state));
        
        // Sync to Cloud
        Store.syncToCloud();

        if (visual) {
            const btn = document.getElementById('save-btn');
            btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Saved!`;
            btn.classList.add('bg-brand-green', 'text-brand-dark'); btn.classList.remove('bg-brand-blue', 'text-white');
            setTimeout(() => {
                btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> Save`;
                btn.classList.remove('bg-brand-green', 'text-brand-dark'); btn.classList.add('bg-brand-blue', 'text-white');
                lucide.createIcons();
            }, 1000);
        }
    },

    async syncToCloud() {
        try {
            await saveProgress('poster_studio_data', Store.state);
            console.log("✅ Poster data synced to cloud");
        } catch (e) {
            console.error("Cloud sync failed", e);
        }
    },

    async loadFromCloud() {
        try {
            const data = await loadProgress('poster_studio_data');
            if (data) {
                // Simple merge: keep cloud data as source of truth for projects
                Store.state = data;
                console.log("✅ Poster data loaded from cloud");
            }
        } catch (e) {
            console.error("Cloud load failed", e);
        }
    },

    triggerSave() {
        clearTimeout(Store.debounce);
        Store.debounce = setTimeout(() => Store.save(false), 500);
    },

    // Updates
    updateGlobal(key, val) { Store.current.global[key] = val; Renderer.renderPoster(); }, // Removed full UI update for inputs
    updateMod(id, key, val) {
        const m = Store.current.modules.find(x => x.id === id);
        if (!m) return;
        if (key.includes('.')) { const [p, c] = key.split('.'); m[p][c] = val; }
        else { m[key] = val; }
        Renderer.renderPoster(); Store.triggerSave();
    },

    async uploadImage(input) {
        const file = input.files[0]; if (!file) return;
        
        let imgId;
        const { data: { user } } = await db.auth.getUser();
        if (!isSandbox() && user) {
            try {
                imgId = await uploadMedia(file, 'poster_studio', Store.current.id);
            } catch (err) {
                console.error("Cloud upload failed", err);
            }
        }
        
        if (!imgId) {
            imgId = crypto.randomUUID();
            const blob = new Blob([file], { type: file.type });
            Store.imgCache.set(imgId, URL.createObjectURL(blob));
            const tx = Store.db.transaction('imgs', 'readwrite');
            tx.objectStore('imgs').put(blob, imgId);
        }

        if (App.currentImageModId) {
            const key = App.currentImageKey || 'imageId';
            Store.updateMod(App.currentImageModId, `data.${key}`, imgId);
            if (key === 'imageId') Store.updateMod(App.currentImageModId, 'data.url', null);
            Editor.render(App.currentImageModId);
            App.closeImageLibrary();
        } else {
            App.refreshImageLibrary();
        }
    },
    async deleteImage(id) {
        if (id && id.includes('klasskit-media')) {
            deleteMediaFromUrl(id).catch(e => console.error("Cloud delete failed", e));
        }
        return new Promise(res => {
            const tx = Store.db.transaction('imgs', 'readwrite');
            tx.objectStore('imgs').delete(id);
            tx.oncomplete = () => { Store.imgCache.delete(id); res(); }
        });
    },
    async getAllImages() {
        const images = [];

        // 1. Local IndexedDB
        const localKeys = await new Promise(res => {
            try {
                const tx = Store.db.transaction('imgs', 'readonly');
                const req = tx.objectStore('imgs').getAllKeys();
                req.onsuccess = () => res(req.result);
                req.onerror = () => res([]);
            } catch(e) { res([]); }
        });
        for (const k of localKeys) {
            const url = await Store.getImage(k);
            images.push({ id: k, url });
        }

        // 2. Cloud Storage (if not sandbox)
        const { data: { user } } = await db.auth.getUser();
        if (!isSandbox() && user) {
            try {
                const dir = `${user.id}/poster_studio/${Store.current.id}`;
                const { data: files } = await db.storage.from(STORAGE_CONFIG.bucket).list(dir);
                if (files) {
                    for (const f of files) {
                        if (f.name === '.emptyFolderPlaceholder') continue;
                        const path = `${dir}/${f.name}`;
                        const cloudUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_CONFIG.bucket}/${path}`;
                        // Check if not already in list (some might be in cache)
                        if (!images.find(x => x.id === cloudUrl)) {
                            images.push({ id: cloudUrl, url: Store.imgCache.get(cloudUrl) || '' });
                        }
                    }
                }
            } catch (e) { console.warn("Cloud image list failed", e); }
        }

        return images;
    },
    async getImage(id) {
        if (!id) return null;
        if (Store.imgCache.has(id)) return Store.imgCache.get(id);
        
        // Cloud URL Support
        if (id.includes('klasskit-media')) {
            const signed = await resolveMediaUrl(id);
            // Don't cache signed URLs long-term as they expire, but keep for session
            Store.imgCache.set(id, signed);
            return signed;
        }

        return new Promise(res => {
            try {
                const tx = Store.db.transaction('imgs', 'readonly');
                const req = tx.objectStore('imgs').get(id);
                req.onsuccess = () => {
                    if (req.result) {
                        const url = URL.createObjectURL(req.result);
                        Store.imgCache.set(id, url);
                        res(url);
                    } else res(null);
                };
                req.onerror = () => res(null);
            } catch(e) { res(null); }
        });
    },

    // Helpers
    moveMod(id, dir) {
        const idx = Store.current.modules.findIndex(m => m.id === id);
        const target = idx + dir;
        if (target >= 0 && target < Store.current.modules.length) {
            const temp = Store.current.modules[idx];
            Store.current.modules[idx] = Store.current.modules[target];
            Store.current.modules[target] = temp;
            Store.save();
            Renderer.renderPoster();
        }
    },
    // Reorder for DnD
    reorderModules(fromIdx, toIdx) {
        if (fromIdx < 0 || fromIdx >= Store.current.modules.length || toIdx < 0 || toIdx >= Store.current.modules.length) return;
        const item = Store.current.modules.splice(fromIdx, 1)[0];
        Store.current.modules.splice(toIdx, 0, item);
        Store.save();
        Renderer.renderPoster();
    }
};

// --- 3. APP CONTROLLER ---
const App = {
    confirmCallback: null,
    currentImageModId: null,
    currentImageKey: 'imageId',
    editingId: null,
    isDragging: false, // Flag to prevent click event

    async init() {
        await requireAuth();
        Store.init().then(() => {
            App.updateUI();
            Renderer.renderPoster();
            App.renderToolbox();
            App.fitToScreen();
            lucide.createIcons();
        });

        // Listeners
        ['title', 'subtitle', 'badge'].forEach(k => {
            document.getElementById(`global_${k}`).addEventListener('input', e => {
                Store.updateGlobal(k, e.target.value);
                Store.triggerSave();
            });
        });
        ['layout', 'pattern', 'gridSize'].forEach(k => {
            document.getElementById(`global_${k}`).addEventListener('change', e => {
                Store.updateGlobal(k, e.target.value);
                if (k === 'layout') {
                    App.fitToScreen();
                }
                Store.triggerSave();
            });
        });

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                Store.save(true);
            }
        });
    },

    renderToolbox() {
        const box = document.getElementById('module-toolbox');
        box.innerHTML = Object.entries(ModuleRegistry).map(([k, v]) => `
            <button onclick="App.addModule('${k}')" class="flex flex-col items-center justify-center p-2 min-w-[70px] bg-white border-2 border-brand-dark rounded-xl shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] hover:shadow-none hover:translate-y-0.5 hover:bg-slate-50 transition-all shrink-0 group">
                <i data-lucide="${v.icon}" class="w-5 h-5 text-brand-${v.color} mb-1 group-hover:scale-110 transition-transform"></i>
                <span class="font-heading font-bold text-[10px] text-slate-600 uppercase leading-none">${v.label}</span>
            </button>
        `).join('');
        lucide.createIcons();
    },

    updateUI() {
        const g = Store.current.global;
        document.getElementById('global_title').value = g.title || '';
        document.getElementById('global_subtitle').value = g.subtitle || '';
        document.getElementById('global_badge').value = g.badge || '';
        document.getElementById('global_layout').value = g.layout || 'landscape';
        document.getElementById('global_pattern').value = g.pattern || 'graph';
        document.getElementById('global_gridSize').value = g.gridSize || 'md';

        const sel = document.getElementById('project-select');
        sel.innerHTML = Store.state.posters.map(p => `<option value="${p.id}" ${p.id === Store.current.id ? 'selected' : ''}>${p.global.title}</option>`).join('');
    },

    // Logic
    addModule(type) {
        const cfg = ModuleRegistry[type];
        const mod = {
            id: crypto.randomUUID(), type, title: cfg.label,
            color: cfg.color, size: 'md', height: 'auto', fontSize: 'md',
            data: JSON.parse(JSON.stringify(cfg.default))
        };
        Store.current.modules.push(mod);
        Store.save();
        Renderer.renderPoster();

        // Automatically open the editor for the new module
        App.openEditor(mod.id);
    },

    // EDITING INTERACTION
    openEditor(id) {
        // Safety check: Don't open if dragging just finished
        if (App.isDragging) return;

        App.editingId = id;
        const m = Store.current.modules.find(x => x.id === id);
        if (!m) return;

        document.getElementById('editor-title').innerText = `Edit ${m.title}`;
        document.getElementById('editor-modal').classList.remove('hidden');
        document.getElementById('editor-modal').classList.add('flex');

        Editor.render(id);
    },
    closeEditor() {
        App.editingId = null;
        document.getElementById('editor-modal').classList.add('hidden');
        document.getElementById('editor-modal').classList.remove('flex');
    },

    deleteCurrent() {
        if (!App.editingId) return;
        App.showConfirm('Delete this layer?', () => {
            Store.current.modules = Store.current.modules.filter(m => m.id !== App.editingId);
            Store.save();
            Renderer.renderPoster();
            App.closeEditor();
        });
    },
    duplicateCurrent() {
        if (!App.editingId) return;
        const idx = Store.current.modules.findIndex(m => m.id === App.editingId);
        const original = Store.current.modules[idx];
        const copy = JSON.parse(JSON.stringify(original));
        copy.id = crypto.randomUUID();
        Store.current.modules.splice(idx + 1, 0, copy);
        Store.save();
        Renderer.renderPoster();
        App.closeEditor();
    },
    moveModule(dir) {
        if (!App.editingId) return;
        Store.moveMod(App.editingId, dir);
    },
    showConfirm(msg, callback) {
        document.getElementById('confirm-msg').innerText = msg;
        App.confirmCallback = callback;
        document.getElementById('confirm-modal').classList.remove('hidden');
        document.getElementById('confirm-modal').classList.add('flex');
    },
    closeConfirm() {
        document.getElementById('confirm-modal').classList.add('hidden');
        document.getElementById('confirm-modal').classList.remove('flex');
        App.confirmCallback = null;
    },
    handleConfirmYes() { if (App.confirmCallback) App.confirmCallback(); App.closeConfirm(); },
    toggleHelp() {
        const el = document.getElementById('help-modal');
        if (el.classList.contains('hidden')) { el.classList.remove('hidden'); el.classList.add('flex'); } else { el.classList.add('hidden'); el.classList.remove('flex'); }
    },
    toggleSettingsMenu(e) {
        e.stopPropagation();
        const menu = document.getElementById('settings-menu');
        if (menu.classList.contains('hidden')) {
            menu.classList.remove('hidden');
            // Close when clicking outside
            setTimeout(() => {
                document.addEventListener('click', App.closeSettingsMenuOnClickOutside, { once: true });
            }, 0);
        } else {
            App.closeSettingsMenu();
        }
    },
    closeSettingsMenu() {
        const menu = document.getElementById('settings-menu');
        if (menu) menu.classList.add('hidden');
    },
    closeSettingsMenuOnClickOutside(e) {
        const menu = document.getElementById('settings-menu');
        const btn = document.getElementById('settings-menu-btn');
        if (menu && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    },
    openImageSelector(modId, key = 'imageId') {
        App.currentImageModId = modId;
        App.currentImageKey = key;
        document.getElementById('image-modal').classList.remove('hidden');
        App.refreshImageLibrary();
    },
    closeImageLibrary() {
        document.getElementById('image-modal').classList.add('hidden');
        App.currentImageModId = null;
        App.currentImageKey = 'imageId';
    },
    handleImageUpload(input) { Store.uploadImage(input); input.value = ''; },
    async refreshImageLibrary() {
        const grid = document.getElementById('image-grid');
        grid.innerHTML = '<div class="col-span-full text-center p-4 text-slate-400 font-bold">Loading...</div>';
        const images = await Store.getAllImages();
        if (images.length === 0) { grid.innerHTML = '<div class="col-span-full text-center p-8 text-slate-400 font-bold border-2 border-dashed border-slate-300 rounded-xl">No images</div>'; return; }
        grid.innerHTML = images.map(img => `
            <div class="relative group aspect-square bg-slate-200 rounded-xl border-2 border-brand-dark overflow-hidden cursor-pointer shadow-sm hover:shadow-neo-sm transition-all" onclick="App.selectImage('${img.id}')">
                <img data-original-src="${img.id}" src="${img.url || ''}" class="w-full h-full object-cover">
                <button onclick="event.stopPropagation(); App.deleteImageAsset('${img.id}')" class="absolute top-1 right-1 p-1 bg-red-500 text-white rounded border border-brand-dark opacity-0 group-hover:opacity-100 transition-opacity"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>`).join('');
        lucide.createIcons();
        
        // Post-resolve images
        const imgs = grid.querySelectorAll('img[data-original-src]');
        for (const img of imgs) {
            const original = img.dataset.originalSrc;
            Store.getImage(original).then(src => { if (src) img.src = src; });
        }
    },
    selectImage(imgId) {
        if (App.currentImageModId) {
            const key = App.currentImageKey || 'imageId';
            Store.updateMod(App.currentImageModId, `data.${key}`, imgId);
            if (key === 'imageId') Store.updateMod(App.currentImageModId, 'data.url', null);
            Editor.render(App.currentImageModId);
            App.closeImageLibrary();
        }
    },
    deleteImageAsset(id) { if (confirm('Delete image?')) Store.deleteImage(id).then(App.refreshImageLibrary); },
    switchPoster(id) { Store.state.currentId = id; Store.loadCurrent(); App.updateUI(); Renderer.renderPoster(); App.fitToScreen(); },
    createNewPoster() {
        const newP = { id: crypto.randomUUID(), lastModified: Date.now(), zoom: 0.5, global: { title: 'UNTITLED', subtitle: 'New Project', badge: '1', layout: 'landscape', pattern: 'graph', gridSize: 'md' }, modules: [] };
        Store.state.posters.push(newP); App.switchPoster(newP.id);
    },
    cyclePoster(dir) {
        const idx = Store.state.posters.findIndex(p => p.id === Store.current.id);
        let next = idx + dir;
        if (next >= Store.state.posters.length) next = 0; if (next < 0) next = Store.state.posters.length - 1;
        App.switchPoster(Store.state.posters[next].id);
    },
    toggleFullScreen() { document.body.classList.toggle('zen-mode'); setTimeout(App.fitToScreen, 300); },
    toggleTheme() {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme_poster-studio', isDark ? 'dark' : 'light');
        lucide.createIcons();
    },
    changeZoom(d) { Store.current.zoom = Math.max(0.1, Math.min(2, (Store.current.zoom || 0.5) + d)); Renderer.applyZoom(); },
    fitToScreen() {
        const vp = document.getElementById('poster-viewport');
        if (!vp) return;
        const g = Store.current.global;
        const layout = g.layout || 'landscape';
        let width = 2560;
        let height = 1440;
        if (layout === 'portrait') {
            width = 1440;
            height = 2560;
        } else if (layout === 'square') {
            width = 1920;
            height = 1920;
        }
        const scale = Math.min((vp.clientWidth - 60) / width, (vp.clientHeight - 60) / height);
        Store.current.zoom = scale; Renderer.applyZoom();
    },
    openLibrary() {
        const list = document.getElementById('library-list');
        list.innerHTML = Store.state.posters.sort((a, b) => b.lastModified - a.lastModified).map(p => {
            const isActive = p.id === Store.current.id;
            return `
            <div class="p-4 border-3 ${isActive ? 'border-brand-blue bg-blue-50/50 dark:bg-blue-950/20' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400'} rounded-2xl flex justify-between items-center cursor-pointer transition-all" onclick="App.switchPoster('${p.id}'); document.getElementById('library-modal').classList.add('hidden')">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-brand-dark text-white font-heading font-black flex items-center justify-center shadow-neo-sm">${p.global.badge || '1'}</div>
                    <div>
                        <h4 class="font-heading font-bold text-base text-brand-dark dark:text-white leading-tight">${p.global.title}</h4>
                        <span class="text-xs text-slate-500 dark:text-slate-400 font-bold">${p.modules ? p.modules.length : 0} layers • ${p.global.layout || 'landscape'}</span>
                    </div>
                </div>
                <div class="flex gap-1 items-center" onclick="event.stopPropagation()">
                    <button onclick="App.renamePoster('${p.id}')" class="p-2 text-slate-400 hover:text-brand-orange transition-colors" title="Rename"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                    <button onclick="App.duplicatePoster('${p.id}')" class="p-2 text-slate-400 hover:text-brand-blue transition-colors" title="Duplicate/Clone"><i data-lucide="copy" class="w-4 h-4"></i></button>
                    ${Store.state.posters.length > 1 ? `<button onclick="App.deletePoster('${p.id}')" class="p-2 text-slate-400 hover:text-brand-red transition-colors" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
                </div>
            </div>
            `;
        }).join('');
        lucide.createIcons();
        document.getElementById('library-modal').classList.remove('hidden');
    },
    renamePoster(id) {
        const p = Store.state.posters.find(x => x.id === id);
        if (!p) return;
        const newTitle = prompt("Rename Project Title:", p.global.title);
        if (newTitle && newTitle.trim()) {
            p.global.title = newTitle.trim();
            p.lastModified = Date.now();
            Store.save();
            App.updateUI();
            Renderer.renderPoster();
            App.openLibrary(); // refresh list
        }
    },
    duplicatePoster(id) {
        const p = Store.state.posters.find(x => x.id === id);
        if (!p) return;
        const copy = JSON.parse(JSON.stringify(p));
        copy.id = crypto.randomUUID();
        copy.global.title = `${copy.global.title} (Copy)`;
        copy.lastModified = Date.now();
        Store.state.posters.push(copy);
        Store.save();
        App.updateUI();
        App.openLibrary(); // refresh list
    },
    async deletePoster(id) { 
        App.showConfirm('Delete Project?', async () => { 
            // Cloud Cleanup
            const { data: { user } } = await db.auth.getUser();
            if (!isSandbox() && user) {
                deleteFolder(`${user.id}/poster_studio/${id}`).catch(e => console.warn("Cloud folder delete failed", e));
            }

            Store.state.posters = Store.state.posters.filter(p => p.id !== id); 
            if (id === Store.current.id) {
                App.switchPoster(Store.state.posters[0].id); 
            } else {
                Store.save();
                App.updateUI();
            }
            App.openLibrary();
        }); 
    },
    exportPoster() { const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(Store.current)); a.download = `Poster_${Store.current.global.title}.json`; a.click(); },
    handleFileImport(input) { const f = input.files[0]; if (!f) return; const r = new FileReader(); r.onload = e => { try { const j = JSON.parse(e.target.result); j.id = crypto.randomUUID(); Store.state.posters.push(j); App.switchPoster(j.id); } catch (err) { alert('Invalid file'); } }; r.readAsText(f); },

    // --- DRAG AND DROP HANDLERS ---
    handleDragStart(e, idx) {
        App.isDragging = true;
        e.dataTransfer.setData('text/plain', idx);
        e.dataTransfer.effectAllowed = 'move';
        // Slight delay to allow ghost image to be generated from original
        setTimeout(() => e.target.classList.add('dragging'), 0);
    },
    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        // Use small timeout to ensure click event doesn't fire after drag
        setTimeout(() => App.isDragging = false, 100);
    },
    handleDragOver(e) {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
        const card = e.currentTarget;
        if (!card.classList.contains('drag-over')) card.classList.add('drag-over');
    },
    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    },
    handleDrop(e, targetIdx) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));

        if (sourceIdx !== parseInt(targetIdx)) {
            Store.reorderModules(sourceIdx, parseInt(targetIdx));
        }
    }
};

// --- 4. RENDERER (Canvas) ---
const Renderer = {
    renderPoster() {
        const g = Store.current.global;
        const area = document.getElementById('poster-area');
        if (!area) return;

        // Apply Layout and Pattern
        const layout = g.layout || 'landscape';
        const pattern = g.pattern || 'graph';
        const gridSize = g.gridSize || 'md';
        let width = 2560;
        let height = 1440;
        if (layout === 'portrait') {
            width = 1440;
            height = 2560;
        } else if (layout === 'square') {
            width = 1920;
            height = 1920;
        }
        area.style.width = `${width}px`;
        area.style.height = `${height}px`;

        // Update background pattern — clear all pattern classes first
        area.classList.remove('bg-graph-paper', 'bg-dots', 'bg-chalkboard', 'bg-plain');
        // Also clear inline background styles that might interfere
        area.style.backgroundImage = '';
        area.style.backgroundColor = '';

        const patternMap = { graph: 'bg-graph-paper', dots: 'bg-dots', chalkboard: 'bg-chalkboard', plain: 'bg-plain' };
        const patternClass = patternMap[pattern] || 'bg-graph-paper';
        area.classList.add(patternClass);

        // Apply grid size
        area.classList.remove('grid-sm', 'grid-md', 'grid-lg');
        area.classList.add(`grid-${gridSize}`);

        const header = `
            <div class="col-span-12 row-span-2 flex items-start justify-between pb-4 pointer-events-none" style="border-bottom: 4px solid var(--border-primary)">
                <div><h1 class="font-heading font-black text-8xl leading-none mb-4" style="color: var(--text-primary)">${g.title}</h1><p class="font-body font-bold text-4xl" style="color: var(--text-secondary)">${g.subtitle}</p></div>
                <div class="h-32 min-w-[180px] px-10 flex items-center justify-center bg-brand-yellow border-4 rounded-full shadow-neo transform rotate-2" style="border-color: var(--border-primary)">
                    <span class="font-heading font-black text-6xl text-brand-dark">${g.badge}</span>
                </div>
            </div>`;

        let contentHTML = '';

        if (Store.current.modules.length === 0) {
            contentHTML = `
            <div class="col-span-12 row-span-10 flex items-center justify-center pointer-events-none opacity-30">
                <div class="border-4 border-dashed rounded-3xl p-12 text-center" style="border-color: var(--border-primary)">
                    <i data-lucide="layout" class="w-24 h-24 mx-auto mb-4" style="color: var(--text-primary)"></i>
                    <h3 class="font-heading font-black text-4xl" style="color: var(--text-primary)">EMPTY POSTER</h3>
                    <p class="font-body font-bold text-2xl mt-2">Drop a layer from the bottom dock to begin</p>
                </div>
            </div>`;
        } else {
            contentHTML = Store.current.modules.map((m, idx) => {
                const cfg = ModuleRegistry[m.type];
                if (!cfg) return '';
                const spans = {
                    size: { xs: 'col-span-2', sm: 'col-span-4', md: 'col-span-6', lg: 'col-span-8', xl: 'col-span-10', full: 'col-span-12' },
                    height: { mini: 'row-span-1', short: 'row-span-2', auto: 'row-span-3', tall: 'row-span-6', grand: 'row-span-9', full: 'row-span-12' }
                };
                const fontSize = m.fontSize || 'md';
                const inner = cfg.render(m.data, m.color, fontSize);
                const titleSizeClass = CONFIG.sizes.title[fontSize] || CONFIG.sizes.title.md;

                const isAutoFit = fontSize === 'auto';
                return `
                    <div
                        draggable="true"
                        ondragstart="App.handleDragStart(event, '${idx}')"
                        ondragend="App.handleDragEnd(event)"
                        ondragover="App.handleDragOver(event)"
                        ondragleave="App.handleDragLeave(event)"
                        ondrop="App.handleDrop(event, '${idx}')"
                        onclick="App.openEditor('${m.id}')"
                        class="module-wrapper ${spans.size[m.size] || 'col-span-6'} ${spans.height[m.height] || 'row-span-3'} rounded-2xl overflow-hidden shadow-neo relative flex flex-col group" style="background-color: var(--surface-card); border: 4px solid var(--border-primary)">
                        <div class="bg-brand-${m.color} px-6 py-3 flex justify-between items-center relative z-10 shrink-0" style="border-bottom: 4px solid var(--border-primary)">
                            <h3 class="font-heading font-black text-white ${titleSizeClass} uppercase tracking-wide truncate pointer-events-none">${m.title}</h3>
                            <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded p-1 flex gap-1 cursor-grab active:cursor-grabbing hover:bg-black/30" onmousedown="event.stopPropagation()">
                                <i data-lucide="move" class="w-5 h-5 text-white"></i>
                            </div>
                        </div>
                        <div class="flex-1 overflow-hidden relative pointer-events-none" ${isAutoFit ? 'style="container-type: inline-size;"' : ''}>${inner}</div>
                        <div class="tape-strip pointer-events-none"></div>
                    </div>`;
            }).join('');
        }

        area.innerHTML = `<div class="p-16 h-full flex flex-col">${header}<div class="flex-1 grid grid-cols-12 grid-rows-12 gap-8 grid-flow-dense pt-6 min-h-0">${contentHTML}</div><div class="mt-auto pt-8 text-center opacity-40 font-heading font-bold text-xl uppercase tracking-[0.3em]" style="color: var(--text-primary)">KlassKit • Educational Resource</div></div>`;

        Renderer.applyZoom();
        Renderer.hydrateImages();
        lucide.createIcons();
    },
    applyZoom() {
        const z = Store.current.zoom || 0.5;
        const wrapper = document.getElementById('poster-wrapper');
        if (wrapper) wrapper.style.transform = `scale(${z})`;
        const zoomDisplay = document.getElementById('zoom-display');
        if (zoomDisplay) zoomDisplay.innerText = `${Math.round(z * 100)}%`;
    },
    async hydrateImages() {
        const imgs = document.querySelectorAll('img[data-idb-id]');
        for (const img of imgs) {
            const id = img.dataset.idbId;
            if (id && id.startsWith('http')) {
                img.src = await resolveMediaUrl(id);
            } else {
                const src = await Store.getImage(id);
                if (src) img.src = src;
            }
        }
    }
};

// --- 5. EDITOR (Modal) ---
const Editor = {
    render(id) {
        const m = Store.current.modules.find(x => x.id === id);
        if (!m) return;
        const cfg = ModuleRegistry[m.type];
        const con = document.getElementById('editor-content');
        if (!con) return;

        // Color Picker
        const colors = CONFIG.colors.map(c => `<button onclick="Store.updateMod('${id}','color','${c}'); Editor.render('${id}')" class="w-8 h-8 rounded-full bg-brand-${c} ${m.color === c ? 'border-4 border-brand-dark scale-110' : 'border-2 border-white opacity-50 ring-2 ring-transparent'}"></button>`).join('');

        // Compact Segment Control
        const mkSeg = (lbl, key, opts) => `
            <div class="mb-2"><label class="lbl">${lbl}</label><div class="flex gap-1 p-1 rounded-lg border-2" style="background-color: var(--bg-tertiary); border-color: var(--border-secondary)">
            ${opts.map((o) => `<button onclick="Store.updateMod('${id}','${key}','${o.v}'); Editor.render('${id}')" class="flex-1 py-1 text-[10px] font-black uppercase rounded-md border-2 transition-all ${(m[key] || o.def) === o.v ? 'shadow-neo-sm' : 'border-transparent'}" style="background-color: ${(m[key] || o.def) === o.v ? 'var(--text-primary)' : 'var(--surface-card)'}; color: ${(m[key] || o.def) === o.v ? 'var(--bg-primary)' : 'var(--text-secondary)'}; border-color: ${(m[key] || o.def) === o.v ? 'var(--border-primary)' : 'transparent'}">${o.l}</button>`).join('')}
            </div></div>`;

        con.innerHTML = `
            <div class="space-y-4">
                <div>
                    <label class="lbl">Layer Title</label>
                    <input type="text" value="${m.title}" class="w-full font-heading font-black text-xl text-brand-dark bg-transparent border-b-2 border-slate-200 hover:border-brand-dark focus:border-brand-blue outline-none py-1" oninput="Store.updateMod('${id}','title',this.value)">
                </div>

                <div class="p-3 rounded-xl border-2" style="background-color: var(--bg-primary); border-color: var(--border-secondary)">
                    <label class="lbl mb-1">Color</label>
                    <div class="flex gap-2 mb-3 overflow-x-auto pb-1 custom-scrollbar">${colors}</div>

                    <div class="grid grid-cols-2 gap-x-3">
                        ${mkSeg('Width', 'size', [
            { v: 'xs', l: 'XS' }, { v: 'sm', l: 'SM' }, { v: 'md', l: 'MD', def: true },
            { v: 'lg', l: 'LG' }, { v: 'xl', l: 'XL' }, { v: 'full', l: 'FULL' }
        ])}
                        ${mkSeg('Height', 'height', [
            { v: 'mini', l: 'XS' }, { v: 'short', l: 'SM' }, { v: 'auto', l: 'MD', def: true },
            { v: 'tall', l: 'LG' }, { v: 'grand', l: 'XL' }, { v: 'full', l: 'MAX' }
        ])}
                    </div>
                    ${mkSeg('Text Size', 'fontSize', [
                        { v: 'auto', l: 'Auto' }, { v: 'xs', l: 'XS' }, { v: 'sm', l: 'SM' }, { v: 'md', l: 'MD', def: true },
                        { v: 'lg', l: 'LG' }, { v: 'xl', l: 'XL' }, { v: '2xl', l: '2XL' }, { v: '3xl', l: '3XL' }
                    ])}
                </div>

                <div class="p-4 rounded-xl border-2 shadow-neo-sm" style="background-color: var(--surface-card); border-color: var(--border-primary)">
                    ${cfg.inputs(id, m.data)}
                </div>
            </div>`;

        const style = document.createElement('style');
        style.innerHTML = `.lbl { display:block; font-weight:900; font-size:10px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; } .inp { width:100%; background:transparent; border-bottom:2px dashed var(--border-secondary); outline:none; padding:4px 0; color:var(--text-primary); } .inp:focus { border-color:var(--border-primary); } .inp-area { width:100%; background:var(--bg-primary); border:2px solid var(--border-secondary); border-radius:8px; padding:8px; font-size:14px; outline:none; resize:none; color:var(--text-primary); } .inp-area:focus { border-color:var(--border-primary); background:var(--surface-card); }`;
        con.appendChild(style);
        lucide.createIcons();
    }
};

// Load saved theme preference
(function () {
    const savedTheme = localStorage.getItem('theme_poster-studio');
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    }
})();

// BOOT
window.onload = App.init;
