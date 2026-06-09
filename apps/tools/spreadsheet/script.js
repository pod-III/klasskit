/**
 * KlassKit Spreadsheet Tool (Class Sheet)
 * Core Logic & Calculation Engine
 */

(function () {
    'use strict';

    // Global Namespace
    const SpreadsheetApp = {
        // Debounce utility function
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        State: {
            rowsCount: 100,
            colsCount: 26,
            data: {},          // Raw inputs keyed by coordinate, e.g., "A1": "Hello" or "B2": "=SUM(B1:B3)"
            evaluated: {},     // Processed values keyed by coordinate, e.g., "B2": "150"
            formulas: {},      // Cell formulas keyed by coordinate, e.g., "B2": "=SUM(B1:B3)"
            formatting: {},    // Styles, e.g. "B2": { bold: true, italic: false, align: "center", bg: "bg-brand-pink/25" }
            colsWidths: {},    // Custom column widths
            activeCell: null,  // Currently selected cell coordinate, e.g. "A1"
            isEditing: false,
            zoom: 100,         // Zoom percentage
            sheetTitle: "Untitled Class Sheet",
            sheetId: null,     // Current loaded saved sheet ID
            savedSheets: [],
            
            // Excel-like Range Selection and Fill States
            selectionStart: null,
            selectionEnd: null,
            isSelecting: false,
            isFilling: false,
            fillSource: null,
            fillPreview: null,
            clipboardBuffer: null
        },

        // Helper to convert Column index (0) to letter ("A")
        colToLetter(index) {
            let letter = '';
            let temp = index;
            while (temp >= 0) {
                letter = String.fromCharCode((temp % 26) + 65) + letter;
                temp = Math.floor(temp / 26) - 1;
            }
            return letter;
        },

        // Helper to convert Column letter ("A") to index (0)
        letterToCol(letter) {
            let col = 0;
            const cleanLetter = letter.toUpperCase();
            for (let i = 0; i < cleanLetter.length; i++) {
                col = col * 26 + (cleanLetter.charCodeAt(i) - 64);
            }
            return col - 1;
        },

        // Initialize App on DOM Content Loaded
        async init() {
            // Require auth if not in sandbox mode
            if (window.requireAuth) {
                await requireAuth();
            }

            // Sync with cloud
            if (!isSandbox() && window.db) {
                await this.Sheets.loadFromCloud();
            }

            this.Sheets.loadSavedSheetsList();
            this.UI.initTheme();
            this.UI.bindEvents();

            // Setup debounced cloud save
            this.Sheets.debouncedSaveToCloud = SpreadsheetApp.debounce(async () => {
                if (isSandbox()) return;
                const state = SpreadsheetApp.State;
                if (!state.sheetId) return;

                const user = await getUser();
                if (!user) return;

                const indicator = document.getElementById('save-status');
                if (indicator) {
                    indicator.textContent = 'Syncing...';
                    indicator.className = 'text-blue-500 font-bold';
                }

                try {
                    await db.from('spreadsheets').upsert({
                        id: state.sheetId,
                        user_id: user.id,
                        title: state.sheetTitle,
                        data: state.data,
                        formulas: state.formulas,
                        formatting: state.formatting,
                        cols_widths: state.colsWidths,
                        zoom: state.zoom,
                        rows_count: state.rowsCount,
                        cols_count: state.colsCount,
                        updated_at: Date.now()
                    }, { onConflict: 'id,user_id' });

                    if (indicator) {
                        indicator.textContent = 'Cloud Synced';
                        indicator.className = 'text-green-500 font-bold';
                        setTimeout(() => {
                            if (indicator.textContent === 'Cloud Synced') {
                                indicator.textContent = 'Saved to Cloud';
                                indicator.className = 'text-slate-400 dark:text-slate-500 font-bold';
                            }
                        }, 2000);
                    }
                } catch (e) {
                    console.warn('[Cloud Auto-Save] failed', e);
                    if (indicator) {
                        indicator.textContent = 'Sync Error';
                        indicator.className = 'text-red-500 font-bold';
                    }
                }
            }, 3000);

            // Auto-load last active state if it exists
            let loaded = false;
            const autosave = localStorage.getItem('kk_sheet_autosave');
            if (autosave) {
                try {
                    const parsed = JSON.parse(autosave);
                    this.Sheets.loadSheetData(parsed);
                    if (parsed.sheetId) {
                        this.State.sheetId = parsed.sheetId;
                    }
                    loaded = true;
                    this.UI.showToast("Last session loaded", "success");
                } catch (e) {
                    console.warn("Failed to load autosave:", e);
                }
            }

            if (!loaded) {
                // Try loading the most recent sheet from the saved list
                const savedStr = localStorage.getItem('kk_sheet_saved_list');
                if (savedStr) {
                    try {
                        const saved = JSON.parse(savedStr);
                        if (saved.length > 0) {
                            // Sort by timestamp descending
                            saved.sort((a, b) => b.timestamp - a.timestamp);
                            this.Sheets.loadSheetData(saved[0]);
                            this.State.sheetId = saved[0].id;
                            loaded = true;
                            this.UI.showToast(`Loaded "${saved[0].title}"`, "success");
                        }
                    } catch (e) {
                        console.warn("Failed to load from saved list:", e);
                    }
                }
            }

            if (!loaded) {
                this.Templates.load('scoreboard', false);
            }
            
            // Render Lucide Icons
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    };

    /* =========================================================================
       1. GRID RENDERING MODULE
       ========================================================================= */
    SpreadsheetApp.Grid = {
        render() {
            const table = document.getElementById('spreadsheet-grid');
            if (!table) return;

            table.innerHTML = '';
            const state = SpreadsheetApp.State;

            // Ensure fill handle exists in the DOM
            let fillHandle = document.getElementById('fill-handle');
            if (!fillHandle) {
                fillHandle = document.createElement('div');
                fillHandle.id = 'fill-handle';
                fillHandle.className = 'absolute w-2.5 h-2.5 bg-brand-blue dark:bg-brand-orange border border-white dark:border-slate-800 cursor-crosshair z-20 hidden shadow-md';
                
                // Add handle fill mousedown event listener
                fillHandle.addEventListener('mousedown', (e) => this.handleFillMouseDown(e));
                
                const wrapper = document.getElementById('grid-wrapper');
                if (wrapper) {
                    wrapper.appendChild(fillHandle);
                }
            } else {
                fillHandle.classList.add('hidden'); // Hide until cell is selected
            }

            // 1. Column Headers Row (A, B, C...)
            const headerRow = document.createElement('tr');
            
            // Top-left corner header
            const corner = document.createElement('th');
            corner.className = 'corner-header';
            headerRow.appendChild(corner);

            for (let c = 0; c < state.colsCount; c++) {
                const colLetter = SpreadsheetApp.colToLetter(c);
                const th = document.createElement('th');
                th.className = 'col-header';
                th.setAttribute('data-col', colLetter);
                
                // Label
                const labelSpan = document.createElement('span');
                labelSpan.textContent = colLetter;
                th.appendChild(labelSpan);

                // Resize handler
                const handle = document.createElement('div');
                handle.className = 'col-resize-handle';
                handle.addEventListener('mousedown', (e) => this.initColResize(e, th, c));
                handle.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    this.autoFitColumn(c);
                });
                th.appendChild(handle);

                // Apply custom width if saved, otherwise use auto to fill width
                if (state.colsWidths[colLetter]) {
                    th.style.width = state.colsWidths[colLetter] + 'px';
                } else {
                    th.style.width = 'auto';
                }

                headerRow.appendChild(th);
            }
            table.appendChild(headerRow);

            // 2. Data Rows
            for (let r = 0; r < state.rowsCount; r++) {
                const rowNum = r + 1;
                const tr = document.createElement('tr');

                // Row Index Header (1, 2, 3...)
                const th = document.createElement('th');
                th.className = 'row-header';
                th.setAttribute('data-row', rowNum);
                th.textContent = rowNum;
                tr.appendChild(th);

                // Data Cells
                for (let c = 0; c < state.colsCount; c++) {
                    const colLetter = SpreadsheetApp.colToLetter(c);
                    const coord = colLetter + rowNum;
                    const td = document.createElement('td');
                    td.setAttribute('data-coord', coord);

                    // Cell content container
                    const valDiv = document.createElement('div');
                    valDiv.className = 'cell-value';
                    
                    // Retrieve stored evaluations or default empty
                    valDiv.textContent = state.evaluated[coord] || '';
                    td.appendChild(valDiv);

                    // Apply active formatting classes
                    this.applyCellStyles(td, coord);

                    // Add cell click selection (range drag listeners)
                    td.addEventListener('mousedown', (e) => this.handleMouseDown(e, coord));
                    td.addEventListener('mouseover', (e) => this.handleMouseOver(e, coord));
                    td.addEventListener('dblclick', () => this.enterEditMode(coord));

                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }

            document.getElementById('grid-dimensions').textContent = 
                `Grid: ${state.colsCount} Columns x ${state.rowsCount} Rows`;

            // Refresh selections if a cell is active
            if (state.activeCell) {
                this.updateSelectionVisuals();
            }
        },

        applyCellStyles(tdElement, coord) {
            const format = SpreadsheetApp.State.formatting[coord];
            tdElement.className = ''; // Reset formatting classes
            
            // Re-apply selection state if active
            if (SpreadsheetApp.State.activeCell === coord) {
                tdElement.classList.add('selected-cell');
            }

            if (!format) return;
            
            if (format.bold) tdElement.classList.add('cell-bold');
            if (format.italic) tdElement.classList.add('cell-italic');
            if (format.align) {
                tdElement.classList.add('cell-align-' + format.align);
            } else {
                tdElement.classList.add('cell-align-left'); // Default
            }
            if (format.bg) {
                tdElement.classList.add(format.bg);
            }
        },

        // Select a cell
        selectCell(coord, shiftKey = false) {
            const state = SpreadsheetApp.State;
            
            // Commit any existing edit
            if (state.isEditing && state.activeCell && state.activeCell !== coord) {
                this.commitEdit();
            }

            if (shiftKey && state.activeCell) {
                state.selectionEnd = coord;
            } else {
                state.activeCell = coord;
                state.selectionStart = coord;
                state.selectionEnd = coord;
            }
            
            this.updateSelectionVisuals();

            // Update Formula Bar value
            const formulaInput = document.getElementById('formula-input');
            if (formulaInput) {
                formulaInput.value = state.data[state.activeCell] || '';
            }
            
            // Sync active formatting toolbar buttons
            SpreadsheetApp.Formatting.syncToolbar(state.activeCell);
        },

        // Selection Visual Updater (Ranges & Header Highlights)
        updateSelectionVisuals() {
            const state = SpreadsheetApp.State;
            
            // Clear current highlights
            document.querySelectorAll('#spreadsheet-grid td').forEach(td => {
                td.classList.remove(
                    'selected-cell',
                    'range-selected-bg',
                    'range-border-top',
                    'range-border-bottom',
                    'range-border-left',
                    'range-border-right'
                );
            });
            
            document.querySelectorAll('th.header-highlight').forEach(el => {
                el.classList.remove('header-highlight');
            });

            if (!state.activeCell) {
                const fillHandle = document.getElementById('fill-handle');
                if (fillHandle) fillHandle.classList.add('hidden');
                return;
            }

            const start = state.selectionStart || state.activeCell;
            const end = state.selectionEnd || state.activeCell;

            const startMatch = start.match(/^([A-Z]+)([0-9]+)$/);
            const endMatch = end.match(/^([A-Z]+)([0-9]+)$/);
            if (!startMatch || !endMatch) return;

            const startCol = SpreadsheetApp.letterToCol(startMatch[1]);
            const startRow = parseInt(startMatch[2]) - 1;
            const endCol = SpreadsheetApp.letterToCol(endMatch[1]);
            const endRow = parseInt(endMatch[2]) - 1;

            const minCol = Math.min(startCol, endCol);
            const maxCol = Math.max(startCol, endCol);
            const minRow = Math.min(startRow, endRow);
            const maxRow = Math.max(startRow, endRow);

            const isMultiCell = (minCol !== maxCol) || (minRow !== maxRow);

            // 1. Highlight Headers
            for (let c = minCol; c <= maxCol; c++) {
                const colLetter = SpreadsheetApp.colToLetter(c);
                const colHeader = document.querySelector(`th[data-col="${colLetter}"]`);
                if (colHeader) colHeader.classList.add('header-highlight');
            }
            for (let r = minRow; r <= maxRow; r++) {
                const rowNum = r + 1;
                const rowHeader = document.querySelector(`th[data-row="${rowNum}"]`);
                if (rowHeader) rowHeader.classList.add('header-highlight');
            }

            // 2. Apply Selection Overlays & Borders
            for (let r = minRow; r <= maxRow; r++) {
                const rowNum = r + 1;
                for (let c = minCol; c <= maxCol; c++) {
                    const colLetter = SpreadsheetApp.colToLetter(c);
                    const coord = colLetter + rowNum;
                    const td = document.querySelector(`td[data-coord="${coord}"]`);
                    if (!td) continue;

                    if (isMultiCell) {
                        // Background shading (active cell remains white/unshaded)
                        if (coord !== state.activeCell) {
                            td.classList.add('range-selected-bg');
                        } else {
                            td.classList.add('selected-cell');
                        }

                        // Outline bounding box
                        if (r === minRow) td.classList.add('range-border-top');
                        if (r === maxRow) td.classList.add('range-border-bottom');
                        if (c === minCol) td.classList.add('range-border-left');
                        if (c === maxCol) td.classList.add('range-border-right');
                    } else {
                        // Single cell highlight
                        td.classList.add('selected-cell');
                    }
                }
            }

            // 3. Update Formula Indicator Address
            const activeIndicator = document.getElementById('active-cell-indicator');
            if (activeIndicator) {
                if (isMultiCell) {
                    const startLetter = SpreadsheetApp.colToLetter(minCol);
                    const endLetter = SpreadsheetApp.colToLetter(maxCol);
                    activeIndicator.textContent = `${startLetter}${minRow + 1}:${endLetter}${maxRow + 1}`;
                } else {
                    activeIndicator.textContent = state.activeCell;
                }
            }

            // 4. Reposition Fill Handle
            const brCoord = SpreadsheetApp.colToLetter(maxCol) + (maxRow + 1);
            const brTd = document.querySelector(`td[data-coord="${brCoord}"]`);
            const fillHandle = document.getElementById('fill-handle');
            if (fillHandle && brTd) {
                fillHandle.classList.remove('hidden');
                // Align handle at bottom-right corner of cell
                fillHandle.style.left = (brTd.offsetLeft + brTd.offsetWidth - 5) + 'px';
                fillHandle.style.top = (brTd.offsetTop + brTd.offsetHeight - 5) + 'px';

                // Synchronize color variables
                if (document.documentElement.classList.contains('dark')) {
                    fillHandle.style.backgroundColor = '#ff7e33';
                } else {
                    fillHandle.style.backgroundColor = '#1ea7fd';
                }
            }
        },

        // Range Mouse Drag Event Handlers
        handleMouseDown(e, coord) {
            if (e.button !== 0) return; // Left click only
            const state = SpreadsheetApp.State;

            // Commit active editor
            if (state.isEditing && state.activeCell && state.activeCell !== coord) {
                this.commitEdit();
            }

            state.isSelecting = true;

            if (e.shiftKey && state.activeCell) {
                state.selectionEnd = coord;
            } else {
                state.activeCell = coord;
                state.selectionStart = coord;
                state.selectionEnd = coord;
            }

            this.updateSelectionVisuals();

            // Sync Formula Input
            const formulaInput = document.getElementById('formula-input');
            if (formulaInput) {
                formulaInput.value = state.data[state.activeCell] || '';
            }

            // Sync Formatting Buttons
            SpreadsheetApp.Formatting.syncToolbar(state.activeCell);
        },

        handleMouseOver(e, coord) {
            const state = SpreadsheetApp.State;
            if (!state.isSelecting) return;

            state.selectionEnd = coord;
            this.updateSelectionVisuals();
        },

        handleMouseUp(e) {
            const state = SpreadsheetApp.State;
            state.isSelecting = false;
        },

        // Autofill Handle Dragging Handlers
        handleFillMouseDown(e) {
            e.preventDefault();
            e.stopPropagation();

            const state = SpreadsheetApp.State;
            if (!state.activeCell) return;

            state.isFilling = true;

            const start = state.selectionStart || state.activeCell;
            const end = state.selectionEnd || state.activeCell;

            const startMatch = start.match(/^([A-Z]+)([0-9]+)$/);
            const endMatch = end.match(/^([A-Z]+)([0-9]+)$/);
            if (!startMatch || !endMatch) return;

            const startCol = SpreadsheetApp.letterToCol(startMatch[1]);
            const startRow = parseInt(startMatch[2]) - 1;
            const endCol = SpreadsheetApp.letterToCol(endMatch[1]);
            const endRow = parseInt(endMatch[2]) - 1;

            state.fillSource = {
                minCol: Math.min(startCol, endCol),
                maxCol: Math.max(startCol, endCol),
                minRow: Math.min(startRow, endRow),
                maxRow: Math.max(startRow, endRow)
            };

            state.fillPreview = null;
        },

        handleFillMouseMove(e) {
            const state = SpreadsheetApp.State;
            if (!state.isFilling || !state.fillSource) return;

            const target = document.elementFromPoint(e.clientX, e.clientY);
            if (!target) return;

            const td = target.closest('td[data-coord]');
            if (!td) return;

            const coord = td.getAttribute('data-coord');
            const match = coord.match(/^([A-Z]+)([0-9]+)$/);
            if (!match) return;

            const hoverCol = SpreadsheetApp.letterToCol(match[1]);
            const hoverRow = parseInt(match[2]) - 1;

            const src = state.fillSource;

            // Determine if horizontal or vertical displacement is larger
            const horizDist = Math.abs(hoverCol - src.maxCol);
            const vertDist = Math.abs(hoverRow - src.maxRow);

            let preview = {
                minCol: src.minCol,
                maxCol: src.maxCol,
                minRow: src.minRow,
                maxRow: src.maxRow
            };

            if (vertDist >= horizDist) {
                // Dragging Vertically
                if (hoverRow > src.maxRow) {
                    preview.maxRow = hoverRow;
                } else if (hoverRow < src.minRow) {
                    preview.minRow = hoverRow;
                }
            } else {
                // Dragging Horizontally
                if (hoverCol > src.maxCol) {
                    preview.maxCol = hoverCol;
                } else if (hoverCol < src.minCol) {
                    preview.minCol = hoverCol;
                }
            }

            state.fillPreview = preview;
            this.updateFillPreviewVisuals();
        },

        updateFillPreviewVisuals() {
            const state = SpreadsheetApp.State;
            
            // Clear current previews
            document.querySelectorAll('#spreadsheet-grid td').forEach(td => {
                td.classList.remove(
                    'fill-preview-bg',
                    'fill-preview-border-top',
                    'fill-preview-border-bottom',
                    'fill-preview-border-left',
                    'fill-preview-border-right'
                );
            });

            if (!state.isFilling || !state.fillPreview) return;

            const p = state.fillPreview;
            const src = state.fillSource;

            for (let r = p.minRow; r <= p.maxRow; r++) {
                const rowNum = r + 1;
                for (let c = p.minCol; c <= p.maxCol; c++) {
                    const colLetter = SpreadsheetApp.colToLetter(c);
                    const coord = colLetter + rowNum;
                    const td = document.querySelector(`td[data-coord="${coord}"]`);
                    if (!td) continue;

                    const isSource = (r >= src.minRow && r <= src.maxRow &&
                                      c >= src.minCol && c <= src.maxCol);

                    if (!isSource) {
                        td.classList.add('fill-preview-bg');
                    }

                    // Outer border bounding outline
                    if (r === p.minRow) td.classList.add('fill-preview-border-top');
                    if (r === p.maxRow) td.classList.add('fill-preview-border-bottom');
                    if (c === p.minCol) td.classList.add('fill-preview-border-left');
                    if (c === p.maxCol) td.classList.add('fill-preview-border-right');
                }
            }
        },

        handleFillMouseUp(e) {
            const state = SpreadsheetApp.State;
            if (!state.isFilling) return;

            state.isFilling = false;

            // Clear preview styles
            document.querySelectorAll('#spreadsheet-grid td').forEach(td => {
                td.classList.remove(
                    'fill-preview-bg',
                    'fill-preview-border-top',
                    'fill-preview-border-bottom',
                    'fill-preview-border-left',
                    'fill-preview-border-right'
                );
            });

            if (!state.fillPreview || !state.fillSource) return;

            const src = state.fillSource;
            const p = state.fillPreview;

            const srcWidth = src.maxCol - src.minCol + 1;
            const srcHeight = src.maxRow - src.minRow + 1;

            // Perform Copy/Shift operations
            for (let r = p.minRow; r <= p.maxRow; r++) {
                for (let c = p.minCol; c <= p.maxCol; c++) {
                    // Skip copy if inside original source
                    if (r >= src.minRow && r <= src.maxRow && c >= src.minCol && c <= src.maxCol) {
                        continue;
                    }

                    let srcRowOffset, srcColOffset;
                    if (r > src.maxRow) {
                        srcRowOffset = (r - (src.maxRow + 1)) % srcHeight;
                    } else if (r < src.minRow) {
                        srcRowOffset = srcHeight - 1 - ((src.minRow - 1 - r) % srcHeight);
                    } else {
                        srcRowOffset = r - src.minRow;
                    }

                    if (c > src.maxCol) {
                        srcColOffset = (c - (src.maxCol + 1)) % srcWidth;
                    } else if (c < src.minCol) {
                        srcColOffset = srcWidth - 1 - ((src.minCol - 1 - c) % srcWidth);
                    } else {
                        srcColOffset = c - src.minCol;
                    }

                    const srcRowIndex = src.minRow + srcRowOffset;
                    const srcColIndex = src.minCol + srcColOffset;

                    const srcCoord = SpreadsheetApp.colToLetter(srcColIndex) + (srcRowIndex + 1);
                    const destCoord = SpreadsheetApp.colToLetter(c) + (r + 1);

                    const val = state.data[srcCoord] || '';
                    const rowOffset = r - srcRowIndex;
                    const colOffset = c - srcColIndex;

                    // Copy Formatting styles
                    if (state.formatting[srcCoord]) {
                        state.formatting[destCoord] = JSON.parse(JSON.stringify(state.formatting[srcCoord]));
                    } else {
                        delete state.formatting[destCoord];
                    }

                    if (val.startsWith('=')) {
                        const shifted = this.shiftFormulaReferences(val, rowOffset, colOffset);
                        state.data[destCoord] = shifted;
                        state.formulas[destCoord] = shifted;
                    } else {
                        state.data[destCoord] = val;
                        delete state.formulas[destCoord];
                    }
                }
            }

            // Adjust selection to expand over the entire filled area
            state.selectionStart = SpreadsheetApp.colToLetter(p.minCol) + (p.minRow + 1);
            state.selectionEnd = SpreadsheetApp.colToLetter(p.maxCol) + (p.maxRow + 1);

            this.updateSelectionVisuals();
            SpreadsheetApp.Formulas.recalculateAll();
            SpreadsheetApp.Sheets.autosave();

            state.fillSource = null;
            state.fillPreview = null;
        },

        // Shifts formula references when copying/dragging relative positions
        shiftFormulaReferences(formula, rowOffset, colOffset) {
            if (!formula || !formula.startsWith('=')) return formula;
            const cellRefPattern = /\b([A-Z]+)([0-9]+)\b/g;

            return formula.replace(cellRefPattern, (match, colLetter, rowStr) => {
                if (['SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX'].includes(colLetter)) {
                    return match;
                }

                let colIndex = SpreadsheetApp.letterToCol(colLetter);
                let rowIndex = parseInt(rowStr) - 1;

                colIndex += colOffset;
                rowIndex += rowOffset;

                if (colIndex < 0) colIndex = 0;
                if (rowIndex < 0) rowIndex = 0;

                return SpreadsheetApp.colToLetter(colIndex) + (rowIndex + 1);
            });
        },

        // Helper to retrieve list of coordinates inside selected range
        getSelectedCells() {
            const state = SpreadsheetApp.State;
            if (!state.activeCell) return [];

            const start = state.selectionStart || state.activeCell;
            const end = state.selectionEnd || state.activeCell;

            const startMatch = start.match(/^([A-Z]+)([0-9]+)$/);
            const endMatch = end.match(/^([A-Z]+)([0-9]+)$/);
            if (!startMatch || !endMatch) return [state.activeCell];

            const startCol = SpreadsheetApp.letterToCol(startMatch[1]);
            const startRow = parseInt(startMatch[2]) - 1;
            const endCol = SpreadsheetApp.letterToCol(endMatch[1]);
            const endRow = parseInt(endMatch[2]) - 1;

            const minCol = Math.min(startCol, endCol);
            const maxCol = Math.max(startCol, endCol);
            const minRow = Math.min(startRow, endRow);
            const maxRow = Math.max(startRow, endRow);

            const cells = [];
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    cells.push(SpreadsheetApp.colToLetter(c) + (r + 1));
                }
            }
            return cells;
        },

        // Copy active selection range to internal/system buffer
        copySelectedRange() {
            const state = SpreadsheetApp.State;
            const cells = this.getSelectedCells();
            if (cells.length === 0) return;

            const start = state.selectionStart || state.activeCell;
            const end = state.selectionEnd || state.activeCell;

            const startMatch = start.match(/^([A-Z]+)([0-9]+)$/);
            const endMatch = end.match(/^([A-Z]+)([0-9]+)$/);
            if (!startMatch || !endMatch) return;

            const startCol = SpreadsheetApp.letterToCol(startMatch[1]);
            const startRow = parseInt(startMatch[2]) - 1;
            const endCol = SpreadsheetApp.letterToCol(endMatch[1]);
            const endRow = parseInt(endMatch[2]) - 1;

            const minCol = Math.min(startCol, endCol);
            const maxCol = Math.max(startCol, endCol);
            const minRow = Math.min(startRow, endRow);
            const maxRow = Math.max(startRow, endRow);

            const width = maxCol - minCol + 1;
            const height = maxRow - minRow + 1;

            const grid = [];
            for (let r = 0; r < height; r++) {
                const row = [];
                for (let c = 0; c < width; c++) {
                    const srcCoord = SpreadsheetApp.colToLetter(minCol + c) + (minRow + r + 1);
                    row.push({
                        data: state.data[srcCoord] || '',
                        formatting: state.formatting[srcCoord] ? JSON.parse(JSON.stringify(state.formatting[srcCoord])) : null
                    });
                }
                grid.push(row);
            }

            state.clipboardBuffer = { width, height, grid };

            // Export as TSV structure to target external clipboard pasting
            const textLines = grid.map(row => row.map(cell => cell.data).join('\t'));
            navigator.clipboard.writeText(textLines.join('\n')).catch(() => {});
            
            SpreadsheetApp.UI.showToast("Copied range selection", "success");
        },

        // Paste clipboard contents starting at activeCell
        pasteClipboard() {
            const state = SpreadsheetApp.State;
            if (!state.activeCell) return;

            if (state.clipboardBuffer) {
                const { width, height, grid } = state.clipboardBuffer;
                
                const activeMatch = state.activeCell.match(/^([A-Z]+)([0-9]+)$/);
                const activeCol = SpreadsheetApp.letterToCol(activeMatch[1]);
                const activeRow = parseInt(activeMatch[2]) - 1;

                for (let r = 0; r < height; r++) {
                    const targetRow = activeRow + r;
                    if (targetRow >= state.rowsCount) continue;

                    for (let c = 0; c < width; c++) {
                        const targetCol = activeCol + c;
                        if (targetCol >= state.colsCount) continue;

                        const destCoord = SpreadsheetApp.colToLetter(targetCol) + (targetRow + 1);
                        const cellData = grid[r][c];

                        state.data[destCoord] = cellData.data;
                        if (cellData.data.startsWith('=')) {
                            state.formulas[destCoord] = cellData.data;
                        } else {
                            delete state.formulas[destCoord];
                        }

                        if (cellData.formatting) {
                            state.formatting[destCoord] = JSON.parse(JSON.stringify(cellData.formatting));
                        } else {
                            delete state.formatting[destCoord];
                        }
                    }
                }

                // Adjust selection to pasted region
                state.selectionStart = state.activeCell;
                state.selectionEnd = SpreadsheetApp.colToLetter(Math.min(state.colsCount - 1, activeCol + width - 1)) + 
                                     (Math.min(state.rowsCount, activeRow + height));
                
                this.updateSelectionVisuals();
                SpreadsheetApp.Formulas.recalculateAll();
                SpreadsheetApp.Sheets.autosave();
                SpreadsheetApp.UI.showToast("Pasted range", "success");
            } else {
                // Read text/tsv fallback from clipboard
                navigator.clipboard.readText().then(text => {
                    if (!text) return;
                    const rows = text.split(/\r?\n/);
                    const grid = rows.map(r => r.split('\t'));

                    // Guard against empty grid
                    if (grid.length === 0 || !grid[0]) return;

                    const activeMatch = state.activeCell.match(/^([A-Z]+)([0-9]+)$/);
                    const activeCol = SpreadsheetApp.letterToCol(activeMatch[1]);
                    const activeRow = parseInt(activeMatch[2]) - 1;

                    for (let r = 0; r < grid.length; r++) {
                        const targetRow = activeRow + r;
                        if (targetRow >= state.rowsCount) continue;

                        for (let c = 0; c < grid[r].length; c++) {
                            const targetCol = activeCol + c;
                            if (targetCol >= state.colsCount) continue;

                            const destCoord = SpreadsheetApp.colToLetter(targetCol) + (targetRow + 1);
                            const val = grid[r][c];

                            state.data[destCoord] = val;
                            if (val.startsWith('=')) {
                                state.formulas[destCoord] = val;
                            } else {
                                delete state.formulas[destCoord];
                            }
                        }
                    }
                    
                    state.selectionStart = state.activeCell;
                    state.selectionEnd = SpreadsheetApp.colToLetter(Math.min(state.colsCount - 1, activeCol + grid[0].length - 1)) + 
                                         (Math.min(state.rowsCount, activeRow + grid.length));

                    this.updateSelectionVisuals();
                    SpreadsheetApp.Formulas.recalculateAll();
                    SpreadsheetApp.Sheets.autosave();
                    SpreadsheetApp.UI.showToast("Pasted range", "success");
                }).catch(() => {});
            }
        },

        // Automatically fits column width to longest text width inside
        autoFitColumn(colIndex) {
            const colLetter = SpreadsheetApp.colToLetter(colIndex);
            const state = SpreadsheetApp.State;
            
            const span = document.createElement('span');
            span.style.fontFamily = 'Nunito, sans-serif';
            span.style.fontSize = '14px';
            span.style.fontWeight = 'bold';
            span.style.position = 'absolute';
            span.style.visibility = 'hidden';
            span.style.whiteSpace = 'nowrap';
            document.body.appendChild(span);
            
            let maxWidth = 80; // Minimum column width threshold
            
            // Add column header label measurement
            span.textContent = colLetter;
            maxWidth = Math.max(maxWidth, span.offsetWidth + 30);
            
            for (let r = 0; r < state.rowsCount; r++) {
                const coord = colLetter + (r + 1);
                const val = state.evaluated[coord] || '';
                span.textContent = val;
                
                const format = state.formatting[coord] || {};
                if (format.bold) {
                    span.style.fontWeight = '800';
                } else {
                    span.style.fontWeight = '400';
                }
                
                const cellWidth = span.offsetWidth + 20; 
                if (cellWidth > maxWidth) {
                    maxWidth = cellWidth;
                }
            }
            
            document.body.removeChild(span);
            
            const th = document.querySelector(`th[data-col="${colLetter}"]`);
            if (th) {
                th.style.width = maxWidth + 'px';
            }
            state.colsWidths[colLetter] = maxWidth;
            
            // Update column cell elements
            document.querySelectorAll(`#spreadsheet-grid td`).forEach(td => {
                const coord = td.getAttribute('data-coord');
                if (coord) {
                    const match = coord.match(/^([A-Z]+)([0-9]+)$/);
                    if (match && match[1] === colLetter) {
                        td.style.width = maxWidth + 'px';
                    }
                }
            });
            
            SpreadsheetApp.Sheets.autosave();
        },

        // Double-click to Edit Cell
        enterEditMode(coord) {
            const state = SpreadsheetApp.State;
            if (state.isEditing) return;

            const td = document.querySelector(`[data-coord="${coord}"]`);
            if (!td) return;

            state.isEditing = true;
            const valDiv = td.querySelector('.cell-value');
            const rawVal = state.data[coord] || '';

            // Create input overlay
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'cell-editor';
            input.value = rawVal;
            td.appendChild(input);
            input.focus();
            
            // Select text inside
            input.select();

            // Keyboard listeners for editor
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.commitEdit();
                    this.moveSelection('down');
                } else if (e.key === 'Tab') {
                    e.preventDefault();
                    this.commitEdit();
                    if (e.shiftKey) {
                        this.moveSelection('left');
                    } else {
                        this.moveSelection('right');
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelEdit();
                }
            });

            // Commit on blur
            input.addEventListener('blur', () => {
                if (state.isEditing) {
                    this.commitEdit();
                }
            });
        },

        // Commit active editor value
        commitEdit() {
            const state = SpreadsheetApp.State;
            if (!state.isEditing || !state.activeCell) return;

            const td = document.querySelector(`[data-coord="${state.activeCell}"]`);
            if (!td) return;

            const input = td.querySelector('.cell-editor');
            if (input) {
                const newVal = input.value;
                state.data[state.activeCell] = newVal;
                
                // Remove editor input
                input.remove();
                state.isEditing = false;

                // Update formula registry
                if (newVal.startsWith('=')) {
                    state.formulas[state.activeCell] = newVal;
                } else {
                    delete state.formulas[state.activeCell];
                }

                // Recalculate
                SpreadsheetApp.Formulas.recalculateAll();

                // Refresh visual outlines
                this.updateSelectionVisuals();

                // Save status
                SpreadsheetApp.Sheets.autosave();
            }
        },

        cancelEdit() {
            const state = SpreadsheetApp.State;
            if (!state.isEditing || !state.activeCell) return;

            const td = document.querySelector(`[data-coord="${state.activeCell}"]`);
            if (!td) return;

            const input = td.querySelector('.cell-editor');
            if (input) {
                input.remove();
            }
            state.isEditing = false;
            
            // Re-render active cell content
            const valDiv = td.querySelector('.cell-value');
            if (valDiv) {
                valDiv.textContent = state.evaluated[state.activeCell] || '';
            }
        },

        // Move cell selection using keys
        moveSelection(direction) {
            const state = SpreadsheetApp.State;
            if (!state.activeCell) return;

            const match = state.activeCell.match(/^([A-Z]+)([0-9]+)$/);
            if (!match) return;

            let colIndex = SpreadsheetApp.letterToCol(match[1]);
            let rowIndex = parseInt(match[2]) - 1;

            switch (direction) {
                case 'up':
                    if (rowIndex > 0) rowIndex--;
                    break;
                case 'down':
                    if (rowIndex < state.rowsCount - 1) rowIndex++;
                    break;
                case 'left':
                    if (colIndex > 0) colIndex--;
                    break;
                case 'right':
                    if (colIndex < state.colsCount - 1) colIndex++;
                    break;
            }

            const nextCoord = SpreadsheetApp.colToLetter(colIndex) + (rowIndex + 1);
            this.selectCell(nextCoord);
            
            // Auto scroll table if selection moves out of view
            const td = document.querySelector(`[data-coord="${nextCoord}"]`);
            const wrapper = document.getElementById('grid-wrapper');
            if (td && wrapper) {
                const tdRect = td.getBoundingClientRect();
                const wrapperRect = wrapper.getBoundingClientRect();

                if (tdRect.bottom > wrapperRect.bottom) {
                    wrapper.scrollTop += (tdRect.bottom - wrapperRect.bottom) + 10;
                } else if (tdRect.top < wrapperRect.top + 36) {
                    wrapper.scrollTop -= (wrapperRect.top + 36 - tdRect.top) + 10;
                }

                if (tdRect.right > wrapperRect.right) {
                    wrapper.scrollLeft += (tdRect.right - wrapperRect.right) + 15;
                } else if (tdRect.left < wrapperRect.left + 50) {
                    wrapper.scrollLeft -= (wrapperRect.left + 50 - tdRect.left) + 15;
                }
            }
        },

        // Column Width Resize Drag Event Handler
        initColResize(e, th, colIndex) {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startWidth = th.offsetWidth;
            const colLetter = SpreadsheetApp.colToLetter(colIndex);

            const onMouseMove = (moveEvent) => {
                const currentWidth = Math.max(50, startWidth + (moveEvent.clientX - startX));
                th.style.width = currentWidth + 'px';
                SpreadsheetApp.State.colsWidths[colLetter] = currentWidth;

                // Adjust all cell elements in this column dynamically
                document.querySelectorAll(`#spreadsheet-grid td[data-coord^="${colLetter}"]`).forEach(td => {
                    td.style.width = currentWidth + 'px';
                });
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                // Reposition fill handle after resize
                this.updateSelectionVisuals();
                SpreadsheetApp.Sheets.autosave();
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        },

        // Add Row to Bottom
        addRow() {
            SpreadsheetApp.State.rowsCount++;
            this.render();
            SpreadsheetApp.Formulas.recalculateAll();
            SpreadsheetApp.Sheets.autosave();
        },

        // Delete Row from Bottom
        deleteRow() {
            if (SpreadsheetApp.State.rowsCount > 1) {
                SpreadsheetApp.State.rowsCount--;
                // Clear any data in the deleted row
                const rowStr = (SpreadsheetApp.State.rowsCount + 1).toString();
                const rowRegex = new RegExp(`^[A-Z]+${rowStr}$`);
                Object.keys(SpreadsheetApp.State.data).forEach(key => {
                    if (rowRegex.test(key)) {
                        delete SpreadsheetApp.State.data[key];
                        delete SpreadsheetApp.State.evaluated[key];
                        delete SpreadsheetApp.State.formulas[key];
                        delete SpreadsheetApp.State.formatting[key];
                    }
                });
                this.render();
                SpreadsheetApp.Formulas.recalculateAll();
                SpreadsheetApp.Sheets.autosave();
            }
        },

        // Add Column to Right
        addColumn() {
            SpreadsheetApp.State.colsCount++;
            this.render();
            SpreadsheetApp.Formulas.recalculateAll();
            SpreadsheetApp.Sheets.autosave();
        },

        // Delete Column from Right
        deleteColumn() {
            if (SpreadsheetApp.State.colsCount > 1) {
                SpreadsheetApp.State.colsCount--;
                const colLetter = SpreadsheetApp.colToLetter(SpreadsheetApp.State.colsCount);
                // Clear data
                const colRegex = new RegExp(`^${colLetter}[0-9]+$`);
                Object.keys(SpreadsheetApp.State.data).forEach(key => {
                    if (colRegex.test(key)) {
                        delete SpreadsheetApp.State.data[key];
                        delete SpreadsheetApp.State.evaluated[key];
                        delete SpreadsheetApp.State.formulas[key];
                        delete SpreadsheetApp.State.formatting[key];
                    }
                });
                this.render();
                SpreadsheetApp.Formulas.recalculateAll();
                SpreadsheetApp.Sheets.autosave();
            }
        }
    };

    /* =========================================================================
       2. CELL FORMATTING MODULE
       ========================================================================= */
    SpreadsheetApp.Formatting = {
        syncToolbar(coord) {
            const format = SpreadsheetApp.State.formatting[coord] || {};
            
            // Bold btn
            const boldBtn = document.getElementById('btn-format-bold');
            if (boldBtn) {
                if (format.bold) {
                    boldBtn.classList.add('bg-slate-200', 'dark:bg-slate-700', 'text-brand-blue');
                } else {
                    boldBtn.classList.remove('bg-slate-200', 'dark:bg-slate-700', 'text-brand-blue');
                }
            }

            // Italic btn
            const italicBtn = document.getElementById('btn-format-italic');
            if (italicBtn) {
                if (format.italic) {
                    italicBtn.classList.add('bg-slate-200', 'dark:bg-slate-700', 'text-brand-blue');
                } else {
                    italicBtn.classList.remove('bg-slate-200', 'dark:bg-slate-700', 'text-brand-blue');
                }
            }

            // Align btns
            const aligns = ['left', 'center', 'right'];
            aligns.forEach(align => {
                const btn = document.getElementById(`btn-align-${align}`);
                if (btn) {
                    if (format.align === align || (!format.align && align === 'left')) {
                        btn.classList.add('bg-slate-200', 'dark:bg-slate-700', 'text-brand-blue');
                    } else {
                        btn.classList.remove('bg-slate-200', 'dark:bg-slate-700', 'text-brand-blue');
                    }
                }
            });
        },

        toggleBold() {
            const cells = SpreadsheetApp.Grid.getSelectedCells();
            if (cells.length === 0) return;

            const activeCoord = SpreadsheetApp.State.activeCell;
            const activeFormat = SpreadsheetApp.State.formatting[activeCoord] || {};
            const makeBold = !activeFormat.bold;

            cells.forEach(coord => {
                if (!SpreadsheetApp.State.formatting[coord]) {
                    SpreadsheetApp.State.formatting[coord] = {};
                }
                SpreadsheetApp.State.formatting[coord].bold = makeBold;
                
                const td = document.querySelector(`[data-coord="${coord}"]`);
                if (td) SpreadsheetApp.Grid.applyCellStyles(td, coord);
            });
            this.syncToolbar(activeCoord);
            SpreadsheetApp.Sheets.autosave();
        },

        toggleItalic() {
            const cells = SpreadsheetApp.Grid.getSelectedCells();
            if (cells.length === 0) return;

            const activeCoord = SpreadsheetApp.State.activeCell;
            const activeFormat = SpreadsheetApp.State.formatting[activeCoord] || {};
            const makeItalic = !activeFormat.italic;

            cells.forEach(coord => {
                if (!SpreadsheetApp.State.formatting[coord]) {
                    SpreadsheetApp.State.formatting[coord] = {};
                }
                SpreadsheetApp.State.formatting[coord].italic = makeItalic;
                
                const td = document.querySelector(`[data-coord="${coord}"]`);
                if (td) SpreadsheetApp.Grid.applyCellStyles(td, coord);
            });
            this.syncToolbar(activeCoord);
            SpreadsheetApp.Sheets.autosave();
        },

        setAlign(alignType) {
            const cells = SpreadsheetApp.Grid.getSelectedCells();
            if (cells.length === 0) return;

            cells.forEach(coord => {
                if (!SpreadsheetApp.State.formatting[coord]) {
                    SpreadsheetApp.State.formatting[coord] = {};
                }
                SpreadsheetApp.State.formatting[coord].align = alignType;
                
                const td = document.querySelector(`[data-coord="${coord}"]`);
                if (td) SpreadsheetApp.Grid.applyCellStyles(td, coord);
            });
            const activeCoord = SpreadsheetApp.State.activeCell;
            this.syncToolbar(activeCoord);
            SpreadsheetApp.Sheets.autosave();
        },

        setBackground(bgColorClass) {
            const cells = SpreadsheetApp.Grid.getSelectedCells();
            if (cells.length === 0) return;

            cells.forEach(coord => {
                if (!SpreadsheetApp.State.formatting[coord]) {
                    SpreadsheetApp.State.formatting[coord] = {};
                }
                SpreadsheetApp.State.formatting[coord].bg = bgColorClass;
                
                const td = document.querySelector(`[data-coord="${coord}"]`);
                if (td) SpreadsheetApp.Grid.applyCellStyles(td, coord);
            });
            SpreadsheetApp.Sheets.autosave();
        },

        adjustZoom(val) {
            const state = SpreadsheetApp.State;
            state.zoom = Math.min(150, Math.max(70, state.zoom + (val * 10)));
            document.getElementById('zoom-value').textContent = state.zoom + '%';

            // Apply zoom style rules to grid table
            const grid = document.getElementById('spreadsheet-grid');
            if (grid) {
                const scale = state.zoom / 100;
                grid.style.transform = `scale(${scale})`;
                grid.style.transformOrigin = 'top left';

                // Adjust container size to account for scaled content
                const wrap = document.getElementById('grid-wrapper');
                if (wrap) {
                    // Get the original dimensions
                    const originalWidth = grid.offsetWidth;
                    const originalHeight = grid.offsetHeight;

                    // Calculate scaled dimensions
                    const scaledWidth = originalWidth * scale;
                    const scaledHeight = originalHeight * scale;

                    // Set wrapper dimensions to accommodate scaled content
                    wrap.style.width = `${Math.max(wrap.clientWidth, scaledWidth)}px`;
                    wrap.style.height = `${Math.max(wrap.clientHeight, scaledHeight)}px`;
                }
            }
        }
    };

    /* =========================================================================
       3. CUSTOM FORMULA ENGINE
       ========================================================================= */
    SpreadsheetApp.Formulas = {
        // Range helper to fetch all cells within range strings e.g. "A1:B3"
        getCellsInRange(rangeStr) {
            const parts = rangeStr.toUpperCase().split(':');
            if (parts.length !== 2) return [rangeStr];
            const start = parts[0];
            const end = parts[1];
            
            const startMatch = start.match(/^([A-Z]+)([0-9]+)$/);
            const endMatch = end.match(/^([A-Z]+)([0-9]+)$/);
            if (!startMatch || !endMatch) return [];
            
            const startCol = SpreadsheetApp.letterToCol(startMatch[1]);
            const startRow = parseInt(startMatch[2]) - 1;
            const endCol = SpreadsheetApp.letterToCol(endMatch[1]);
            const endRow = parseInt(endMatch[2]) - 1;
            
            const minCol = Math.min(startCol, endCol);
            const maxCol = Math.max(startCol, endCol);
            const minRow = Math.min(startRow, endRow);
            const maxRow = Math.max(startRow, endRow);
            
            const cells = [];
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    cells.push(SpreadsheetApp.colToLetter(c) + (r + 1));
                }
            }
            return cells;
        },

        // Evaluate single expression
        evaluate(expr, cellCoord, evaluationStack = []) {
            if (!expr || typeof expr !== 'string') return expr;
            if (!expr.startsWith('=')) return expr;

            // Prevent circular references
            if (evaluationStack.includes(cellCoord)) {
                return '#CIRC!';
            }
            evaluationStack.push(cellCoord);

            const cleanExpr = expr.substring(1).trim().toUpperCase();

            // 1. Function Range parsing: SUM, AVERAGE, COUNT, MIN, MAX
            const funcMatch = cleanExpr.match(/^(SUM|AVERAGE|COUNT|MIN|MAX)\((.+)\)$/);
            if (funcMatch) {
                const funcName = funcMatch[1];
                const rangeStr = funcMatch[2];
                const cells = this.getCellsInRange(rangeStr);
                
                // Get evaluated values of those cells
                const values = cells.map(coord => {
                    // Check if it relies on another cell
                    const rawVal = SpreadsheetApp.State.data[coord] || '';
                    let evaluatedVal;
                    if (rawVal.startsWith('=')) {
                        evaluatedVal = this.evaluate(rawVal, coord, [...evaluationStack]);
                    } else {
                        evaluatedVal = rawVal;
                    }
                    
                    const num = parseFloat(evaluatedVal);
                    return isNaN(num) ? 0 : num;
                });

                if (cells.length === 0) return 0;

                switch (funcName) {
                    case 'SUM':
                        return values.reduce((sum, v) => sum + v, 0);
                    case 'AVERAGE':
                        return values.reduce((sum, v) => sum + v, 0) / values.length;
                    case 'COUNT':
                        // Counts numeric values only
                        return cells.filter(coord => {
                            const val = SpreadsheetApp.State.evaluated[coord] || '';
                            return val !== '' && !isNaN(parseFloat(val));
                        }).length;
                    case 'MIN':
                        return Math.min(...values);
                    case 'MAX':
                        return Math.max(...values);
                    default:
                        return '#ERROR!';
                }
            }

            // 2. Generic Arithmetic Expressions, e.g. B1+C3*2
            // Replace cell references with their numeric values
            const cellRefPattern = /\b([A-Z]+[0-9]+)\b/g;
            let finalArithmetic = cleanExpr;
            let refMatch;
            let hasError = false;

            // Iterate and replace coordinate string tokens with values
            finalArithmetic = finalArithmetic.replace(cellRefPattern, (match) => {
                const rawRefVal = SpreadsheetApp.State.data[match] || '';
                let evaluatedRefVal;
                
                if (rawRefVal.startsWith('=')) {
                    evaluatedRefVal = this.evaluate(rawRefVal, match, [...evaluationStack]);
                } else {
                    evaluatedRefVal = rawRefVal;
                }

                if (evaluatedRefVal === '#CIRC!') {
                    hasError = true;
                    return '#CIRC!';
                }

                const num = parseFloat(evaluatedRefVal);
                return isNaN(num) ? '0' : num.toString();
            });

            if (hasError || finalArithmetic.includes('#CIRC!')) {
                return '#CIRC!';
            }

            // Sanitise calculation sequence
            const allowedSymbols = /^[0-9\+\-\*\/\(\)\s\.]+$/;
            if (!allowedSymbols.test(finalArithmetic)) {
                return '#VALUE!';
            }

            try {
                // Secure calculation executor
                const result = new Function(`return (${finalArithmetic});`)();
                if (result === Infinity || result === -Infinity) {
                    return '#DIV/0!';
                }
                return isNaN(result) ? '#VALUE!' : Number(result.toFixed(4));
            } catch (e) {
                return '#ERROR!';
            }
        },

        // Recalculates all cell values
        recalculateAll() {
            const state = SpreadsheetApp.State;
            const tempEvaluated = {};

            // 1. Pre-copy literal strings/numbers
            Object.keys(state.data).forEach(coord => {
                const val = state.data[coord];
                if (!val.startsWith('=')) {
                    tempEvaluated[coord] = val;
                }
            });

            // 2. Evaluate all formula columns using iterative passes to resolve dependencies
            // 5 passes is more than enough for classroom spreadsheets
            const formulaCells = Object.keys(state.formulas);
            let passes = 5;
            
            while (passes > 0) {
                let changes = false;
                formulaCells.forEach(coord => {
                    const formula = state.formulas[coord];
                    const prevVal = tempEvaluated[coord];
                    
                    // Evaluate under sandbox
                    const newVal = this.evaluate(formula, coord);
                    tempEvaluated[coord] = newVal.toString();
                    
                    if (prevVal !== tempEvaluated[coord]) {
                        changes = true;
                    }
                });
                
                if (!changes) break; // Dependencies fully converged
                passes--;
            }

            // Push temp results to State
            state.evaluated = tempEvaluated;

            // Reflect evaluations in UI elements
            Object.keys(state.data).forEach(coord => {
                const cellValDiv = document.querySelector(`[data-coord="${coord}"] .cell-value`);
                if (cellValDiv) {
                    cellValDiv.textContent = state.evaluated[coord] || '';
                }
            });
        }
    };

    /* =========================================================================
       4. WORKSHEETS & SAVE MANAGER MODULE
       ========================================================================= */
    SpreadsheetApp.Sheets = {
        autosave() {
            const state = SpreadsheetApp.State;
            const saveObj = {
                rowsCount: state.rowsCount,
                colsCount: state.colsCount,
                data: state.data,
                formulas: state.formulas,
                formatting: state.formatting,
                colsWidths: JSON.parse(JSON.stringify(state.colsWidths)),
                sheetTitle: state.sheetTitle,
                zoom: state.zoom,
                sheetId: state.sheetId
            };
            localStorage.setItem('kk_sheet_autosave', JSON.stringify(saveObj));
            
            const indicator = document.getElementById('save-status');
            if (indicator) {
                indicator.textContent = 'Auto-Saved';
                indicator.className = 'text-green-500 font-bold';
                setTimeout(() => {
                    if (indicator.textContent === 'Auto-Saved') {
                        indicator.textContent = isSandbox() ? 'Saved Locally' : 'Saved to Cloud';
                        indicator.className = 'text-slate-400 dark:text-slate-500 font-bold';
                    }
                }, 2000);
            }

            // Trigger debounced cloud save
            if (this.debouncedSaveToCloud) {
                this.debouncedSaveToCloud();
            }
        },

        createNewSheet(confirmMsg = true) {
            if (confirmMsg && !confirm("Create a new empty sheet? Any unsaved changes will be cleared.")) {
                return;
            }

            const state = SpreadsheetApp.State;
            state.rowsCount = 25;
            state.colsCount = 10;
            state.data = {};
            state.formulas = {};
            state.evaluated = {};
            state.formatting = {};
            state.colsWidths = {};
            state.sheetTitle = "Untitled Class Sheet";
            state.sheetId = null;

            document.getElementById('sheet-title').value = state.sheetTitle;
            SpreadsheetApp.Grid.render();
            this.autosave();
            SpreadsheetApp.UI.showToast("New sheet created", "success");
        },

        // Saves current state into sheets library
        async saveCurrentSheet() {
            const state = SpreadsheetApp.State;
            const titleInput = document.getElementById('sheet-title');
            if (titleInput && titleInput.value.trim() !== '') {
                state.sheetTitle = titleInput.value.trim();
            }

            const sheetId = state.sheetId || 'sheet_' + Date.now();

            const sheetData = {
                id: sheetId,
                title: state.sheetTitle,
                timestamp: Date.now(),
                rowsCount: state.rowsCount,
                colsCount: state.colsCount,
                data: JSON.parse(JSON.stringify(state.data)),
                formulas: JSON.parse(JSON.stringify(state.formulas)),
                formatting: JSON.parse(JSON.stringify(state.formatting)),
                colsWidths: state.colsWidths,
                zoom: state.zoom
            };

            // Read existing lists
            let saved = [];
            const savedStr = localStorage.getItem('kk_sheet_saved_list');
            if (savedStr) {
                try {
                    saved = JSON.parse(savedStr);
                } catch (e) {
                    saved = [];
                }
            }

            // Check if updating
            const index = saved.findIndex(s => s.id === sheetData.id);
            if (index > -1) {
                saved[index] = sheetData;
            } else {
                saved.push(sheetData);
            }

            state.sheetId = sheetData.id;
            localStorage.setItem('kk_sheet_saved_list', JSON.stringify(saved));

            // Sync to Supabase
            if (!isSandbox() && window.db) {
                const user = await getUser();
                if (user) {
                    const indicator = document.getElementById('save-status');
                    if (indicator) {
                        indicator.textContent = 'Syncing...';
                        indicator.className = 'text-blue-500 font-bold';
                    }
                    try {
                        const { error } = await db.from('spreadsheets').upsert({
                            id: sheetData.id,
                            user_id: user.id,
                            title: sheetData.title,
                            data: sheetData.data,
                            formulas: sheetData.formulas,
                            formatting: sheetData.formatting,
                            cols_widths: sheetData.colsWidths,
                            zoom: sheetData.zoom,
                            rows_count: sheetData.rowsCount,
                            cols_count: sheetData.colsCount,
                            updated_at: sheetData.timestamp
                        }, { onConflict: 'id,user_id' });

                        if (error) throw error;

                        if (indicator) {
                            indicator.textContent = 'Cloud Synced';
                            indicator.className = 'text-green-500 font-bold';
                            setTimeout(() => {
                                indicator.textContent = 'Saved to Cloud';
                                indicator.className = 'text-slate-400 dark:text-slate-500 font-bold';
                            }, 2000);
                        }
                    } catch (err) {
                        console.error('[Cloud Save] Error:', err);
                        if (indicator) {
                            indicator.textContent = 'Sync Error';
                            indicator.className = 'text-red-500 font-bold';
                        }
                        SpreadsheetApp.UI.showToast("Cloud sync failed, saved locally", "error");
                    }
                }
            } else {
                this.autosave();
            }

            await this.loadSavedSheetsList();
            SpreadsheetApp.UI.showToast("Sheet saved successfully!", "success");
        },

        async loadSavedSheetsList() {
            const listEl = document.getElementById('saved-sheets-list');
            if (!listEl) return;

            listEl.innerHTML = '';
            let saved = [];

            // Always load from localStorage first to ensure UI shows latest save
            const savedStr = localStorage.getItem('kk_sheet_saved_list');
            if (savedStr) {
                try {
                    saved = JSON.parse(savedStr);
                } catch (e) {
                    saved = [];
                }
            }

            // Then sync from cloud if available (in background)
            if (!isSandbox() && window.db) {
                const user = await getUser();
                if (user) {
                    try {
                        const { data, error } = await db
                            .from('spreadsheets')
                            .select('*')
                            .eq('user_id', user.id);

                        if (error) throw error;

                        if (data) {
                            saved = data.map(row => ({
                                id: row.id,
                                title: row.title,
                                timestamp: row.updated_at,
                                rowsCount: row.rows_count,
                                colsCount: row.cols_count,
                                data: row.data,
                                formulas: row.formulas,
                                formatting: row.formatting,
                                colsWidths: row.cols_widths,
                                zoom: row.zoom
                            }));
                            localStorage.setItem('kk_sheet_saved_list', JSON.stringify(saved));
                        }
                    } catch (e) {
                        console.error('[Cloud List] Error:', e);
                        // Fall back to localStorage data already loaded above
                    }
                }
            }

            // Update badge
            const badge = document.getElementById('saved-sheets-badge');
            if (badge) badge.textContent = saved.length;

            if (saved.length === 0) {
                listEl.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-700 text-center">
                        <i data-lucide="folder-closed" class="w-12 h-12 mb-3 opacity-45"></i>
                        <p class="text-xs font-bold leading-normal uppercase">No saved sheets yet</p>
                        <span class="text-[9px] mt-1 normal-case font-medium">Click "Save Current" to register your grid configurations.</span>
                    </div>
                `;
                if (window.lucide) window.lucide.createIcons();
                return;
            }

            // Render list
            saved.sort((a, b) => b.timestamp - a.timestamp).forEach(sheet => {
                const div = document.createElement('div');
                div.className = 'flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-blue dark:hover:border-slate-500 transition-all group';
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'flex flex-col cursor-pointer flex-1 mr-2';
                infoDiv.addEventListener('click', () => this.loadSheetById(sheet.id));

                const titleSpan = document.createElement('span');
                titleSpan.className = 'text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]';
                titleSpan.textContent = sheet.title;
                infoDiv.appendChild(titleSpan);

                const dateSpan = document.createElement('span');
                dateSpan.className = 'text-[9px] text-slate-400 mt-0.5';
                const date = new Date(sheet.timestamp);
                dateSpan.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                infoDiv.appendChild(dateSpan);

                div.appendChild(infoDiv);

                // Actions Container
                const actions = document.createElement('div');
                actions.className = 'flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity';

                // Delete btn
                const delBtn = document.createElement('button');
                delBtn.className = 'p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-400 transition-all';
                delBtn.setAttribute('data-tooltip', 'Delete Sheet');
                delBtn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>';
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteSheetById(sheet.id);
                });
                actions.appendChild(delBtn);

                div.appendChild(actions);
                listEl.appendChild(div);
            });

            if (window.lucide) window.lucide.createIcons();
        },

        async loadSheetById(id) {
            const savedStr = localStorage.getItem('kk_sheet_saved_list');
            if (!savedStr) return;

            try {
                const saved = JSON.parse(savedStr);
                const sheet = saved.find(s => s.id === id);
                if (sheet) {
                    const confirmed = await showConfirmModal(`Load "${sheet.title}"? Unsaved changes in active sheet will be lost.`, {
                        title: "Load Sheet?",
                        confirmText: "Load",
                        cancelText: "Cancel",
                        icon: "file-up",
                        iconColor: "blue"
                    });
                    if (confirmed) {
                        this.loadSheetData(sheet);
                        SpreadsheetApp.State.sheetId = sheet.id;
                        SpreadsheetApp.UI.toggleSavedSheetsPanel(false);
                        SpreadsheetApp.UI.showToast(`Loaded "${sheet.title}"`, "success");
                    }
                }
            } catch (e) {
                SpreadsheetApp.UI.showToast("Error loading sheet", "error");
            }
        },

        async deleteSheetById(id) {
            const confirmed = await showConfirmModal("Are you sure you want to delete this sheet? This action cannot be undone.", {
                title: "Delete Sheet?",
                confirmText: "Delete",
                cancelText: "Keep",
                icon: "trash-2",
                iconColor: "red"
            });
            if (confirmed) {
                try {
                    if (!isSandbox() && window.db) {
                        const user = await getUser();
                        if (user) {
                            const { error } = await db
                                .from('spreadsheets')
                                .delete()
                                .eq('id', id)
                                .eq('user_id', user.id);

                            if (error) throw error;
                        }
                    }

                    // Also remove from local list
                    const savedStr = localStorage.getItem('kk_sheet_saved_list');
                    if (savedStr) {
                        const saved = JSON.parse(savedStr);
                        const filtered = saved.filter(s => s.id !== id);
                        localStorage.setItem('kk_sheet_saved_list', JSON.stringify(filtered));
                    }

                    if (SpreadsheetApp.State.sheetId === id) {
                        SpreadsheetApp.State.sheetId = null;
                    }

                    await this.loadSavedSheetsList();
                    SpreadsheetApp.UI.showToast("Sheet deleted", "success");
                } catch (e) {
                    console.error('[Cloud Delete] Error:', e);
                    SpreadsheetApp.UI.showToast("Error deleting sheet", "error");
                }
            }
        },

        loadSheetData(sheet) {
            const state = SpreadsheetApp.State;
            state.rowsCount = sheet.rowsCount || 25;
            state.colsCount = sheet.colsCount || 10;
            state.data = sheet.data || {};
            state.formulas = sheet.formulas || {};
            state.formatting = sheet.formatting || {};
            state.colsWidths = sheet.colsWidths || {};
            state.zoom = sheet.zoom || 100;
            state.sheetTitle = sheet.title || "Untitled Class Sheet";
            state.sheetId = sheet.id || null;

            document.getElementById('sheet-title').value = state.sheetTitle;
            document.getElementById('zoom-value').textContent = state.zoom + '%';

            // Sync grid scale zoom
            const grid = document.getElementById('spreadsheet-grid');
            if (grid) grid.style.transform = `scale(${state.zoom / 100})`;

            SpreadsheetApp.Grid.render();
            SpreadsheetApp.Formulas.recalculateAll();
        },

        async loadFromCloud() {
            if (isSandbox() || !window.db) return;
            const user = await getUser();
            if (!user) return;

            try {
                const { data: cloudSheets, error } = await db
                    .from('spreadsheets')
                    .select('*')
                    .eq('user_id', user.id);

                if (error) throw error;

                if (cloudSheets) {
                    const saved = cloudSheets.map(row => ({
                        id: row.id,
                        title: row.title,
                        timestamp: row.updated_at,
                        rowsCount: row.rows_count,
                        colsCount: row.cols_count,
                        data: row.data,
                        formulas: row.formulas,
                        formatting: row.formatting,
                        colsWidths: row.cols_widths,
                        zoom: row.zoom
                    }));
                    localStorage.setItem('kk_sheet_saved_list', JSON.stringify(saved));
                }
            } catch (e) {
                console.error('[Cloud Load] Error loading from cloud:', e);
            }
        }
    };

    /* =========================================================================
       5. CSV IMPORT & EXPORT MODULE
       ========================================================================= */
    SpreadsheetApp.CSV = {
        export() {
            const state = SpreadsheetApp.State;
            let csvContent = "";

            for (let r = 0; r < state.rowsCount; r++) {
                const row = [];
                for (let c = 0; c < state.colsCount; c++) {
                    const coord = SpreadsheetApp.colToLetter(c) + (r + 1);
                    // Export raw formula if present, otherwise cell value
                    let val = state.data[coord] || "";
                    
                    // Escape quote marks
                    val = val.replace(/"/g, '""');
                    if (val.search(/("|,|\n)/g) >= 0) {
                        val = `"${val}"`;
                    }
                    row.push(val);
                }
                csvContent += row.join(",") + "\r\n";
            }

            // Create download anchor link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            
            const fileName = state.sheetTitle.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.csv';
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            SpreadsheetApp.UI.showToast("CSV Exported", "success");
        },

        import(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                this.parseCSV(text);
                // Clear input
                event.target.value = '';
            };
            reader.readAsText(file);
        },

        parseCSV(text) {
            const state = SpreadsheetApp.State;
            const lines = text.split(/\r\n|\n/);
            if (lines.length === 0) return;

            // Confirm import
            if (!confirm("Load values from CSV? This will overwrite the top-left area of your grid.")) {
                return;
            }

            // Parse lines
            let csvGrid = [];
            lines.forEach(line => {
                if (line.trim() === '') return;
                
                const row = [];
                let inQuotes = false;
                let cell = '';
                
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        row.push(cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
                        cell = '';
                    } else {
                        cell += char;
                    }
                }
                row.push(cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
                csvGrid.push(row);
            });

            // Adjust grid dimensions if CSV is larger
            const csvRows = csvGrid.length;
            let csvCols = 0;
            csvGrid.forEach(r => { if (r.length > csvCols) csvCols = r.length; });

            state.rowsCount = Math.max(state.rowsCount, csvRows);
            state.colsCount = Math.max(state.colsCount, csvCols);

            // Clear active select
            state.activeCell = null;

            // Load values into top left
            for (let r = 0; r < csvRows; r++) {
                const rowNum = r + 1;
                for (let c = 0; c < csvGrid[r].length; c++) {
                    const coord = SpreadsheetApp.colToLetter(c) + rowNum;
                    const val = csvGrid[r][c] || '';
                    state.data[coord] = val;

                    if (val.startsWith('=')) {
                        state.formulas[coord] = val;
                    } else {
                        delete state.formulas[coord];
                    }
                }
            }

            // Re-render
            SpreadsheetApp.Grid.render();
            SpreadsheetApp.Formulas.recalculateAll();
            SpreadsheetApp.Sheets.autosave();
            SpreadsheetApp.UI.showToast("CSV Imported Successfully", "success");
        }
    };

    /* =========================================================================
       6. PRINT MODULE
       ========================================================================= */
    SpreadsheetApp.Print = {
        printSheet(mode = 'selected') {
            const state = SpreadsheetApp.State;

            // Add print mode class to body
            document.body.classList.remove('printing-selected', 'printing-all');

            if (mode === 'selected') {
                // Check if there's a selection
                if (!state.activeCell) {
                    SpreadsheetApp.UI.showToast("No cell selected", "error");
                    return;
                }

                // Check if there's a range selection
                const start = state.selectionStart || state.activeCell;
                const end = state.selectionEnd || state.activeCell;

                if (start !== end) {
                    document.body.classList.add('printing-selected');
                    // Mark rows to hide for print
                    this.markRowsForPrint();
                } else {
                    // Single cell selected, print entire sheet
                    document.body.classList.add('printing-all');
                }
            } else {
                document.body.classList.add('printing-all');
            }

            // Print the document
            window.print();

            // Remove the class after print dialog closes
            setTimeout(() => {
                document.body.classList.remove('printing-selected', 'printing-all');
                this.clearPrintRowMarks();
            }, 1000);

            // Close dropdown if open
            SpreadsheetApp.UI.toggleDropdown('print-dropdown', true);
        },

        markRowsForPrint() {
            const grid = document.getElementById('spreadsheet-grid');
            if (!grid) return;

            const rows = grid.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                let hasSelected = false;
                cells.forEach(cell => {
                    if (cell.classList.contains('selected-cell') || cell.classList.contains('range-selected-bg')) {
                        hasSelected = true;
                    }
                });
                if (!hasSelected && cells.length > 0) {
                    row.classList.add('print-hide-row');
                }
            });
        },

        clearPrintRowMarks() {
            const grid = document.getElementById('spreadsheet-grid');
            if (!grid) return;

            const rows = grid.querySelectorAll('tr');
            rows.forEach(row => {
                row.classList.remove('print-hide-row');
            });
        }
    };

    /* =========================================================================
       7. EDUCATIONAL WORKBOOK TEMPLATES
       ========================================================================= */
    SpreadsheetApp.Templates = {
        load(templateName, triggerConfirm = true) {
            if (triggerConfirm && !confirm(`Load ${templateName} template? Any unsaved edits will be replaced.`)) {
                return;
            }

            const state = SpreadsheetApp.State;
            
            // Clear current sheets metadata
            state.data = {};
            state.formulas = {};
            state.formatting = {};
            state.evaluated = {};
            state.colsWidths = {};
            state.sheetId = null;

            switch (templateName) {
                case 'scoreboard':
                    state.sheetTitle = "Class Scoreboard";
                    state.colsCount = 26;
                    state.rowsCount = 100;
                    
                    // Column Headers
                    state.data["A1"] = "Team Name";
                    state.data["B1"] = "Round 1";
                    state.data["C1"] = "Round 2";
                    state.data["D1"] = "Round 3";
                    state.data["E1"] = "Total Score";
                    state.data["F1"] = "Rank";

                    // Formatting headers
                    ["A1", "B1", "C1", "D1", "E1", "F1"].forEach(coord => {
                        state.formatting[coord] = { bold: true, align: 'center', bg: 'bg-brand-blue/25' };
                    });

                    // Row data
                    const teams = [
                        { name: "Dragons", bg: "bg-brand-orange/25" },
                        { name: "Sharks", bg: "bg-brand-blue/25" },
                        { name: "Giants", bg: "bg-brand-green/25" },
                        { name: "Panthers", bg: "bg-brand-pink/25" }
                    ];

                    teams.forEach((t, i) => {
                        const rowNum = i + 2;
                        state.data["A" + rowNum] = t.name;
                        state.data["B" + rowNum] = (10 + (i * 2)).toString();
                        state.data["C" + rowNum] = (15 - i).toString();
                        state.data["D" + rowNum] = (12 + (i * 3)).toString();
                        state.data["E" + rowNum] = `=SUM(B${rowNum}:D${rowNum})`;
                        state.data["F" + rowNum] = "";

                        state.formulas["E" + rowNum] = `=SUM(B${rowNum}:D${rowNum})`;

                        // Set formatting
                        state.formatting["A" + rowNum] = { bold: true, align: 'left', bg: t.bg };
                        state.formatting["B" + rowNum] = { align: 'center' };
                        state.formatting["C" + rowNum] = { align: 'center' };
                        state.formatting["D" + rowNum] = { align: 'center' };
                        state.formatting["E" + rowNum] = { bold: true, align: 'center', bg: 'bg-brand-yellow/30' };
                        state.formatting["F" + rowNum] = { align: 'center' };
                    });
                    break;

                case 'grades':
                    state.sheetTitle = "Grades Tracker";
                    state.colsCount = 7;
                    state.rowsCount = 12;

                    // Headers
                    state.data["A1"] = "Student Name";
                    state.data["B1"] = "Quiz 1 (10)";
                    state.data["C1"] = "Quiz 2 (10)";
                    state.data["D1"] = "Midterm (40)";
                    state.data["E1"] = "Final (40)";
                    state.data["F1"] = "Total Score";
                    state.data["G1"] = "Average";

                    ["A1", "B1", "C1", "D1", "E1", "F1", "G1"].forEach(coord => {
                        state.formatting[coord] = { bold: true, align: 'center', bg: 'bg-brand-pink/25' };
                    });

                    const students = ["Alice A.", "Bob B.", "Charlie C.", "David D.", "Emma E."];
                    students.forEach((name, i) => {
                        const row = i + 2;
                        state.data["A" + row] = name;
                        state.data["B" + row] = (7 + i).toString();
                        state.data["C" + row] = (9 - i).toString();
                        state.data["D" + row] = (30 + (i * 2)).toString();
                        state.data["E" + row] = (35 - i).toString();
                        state.data["F" + row] = `=SUM(B${row}:E${row})`;
                        state.data["G" + row] = `=AVERAGE(B${row}:C${row})`;

                        state.formulas["F" + row] = `=SUM(B${row}:E${row})`;
                        state.formulas["G" + row] = `=AVERAGE(B${row}:C${row})`;

                        state.formatting["A" + row] = { bold: true, align: 'left' };
                        state.formatting["B" + row] = { align: 'center' };
                        state.formatting["C" + row] = { align: 'center' };
                        state.formatting["D" + row] = { align: 'center' };
                        state.formatting["E" + row] = { align: 'center' };
                        state.formatting["F" + row] = { bold: true, align: 'center', bg: 'bg-brand-green/25' };
                        state.formatting["G" + row] = { align: 'center' };
                    });

                    // Class Average bottom row
                    state.data["A8"] = "Class Average";
                    state.data["B8"] = "=AVERAGE(B2:B6)";
                    state.data["C8"] = "=AVERAGE(C2:C6)";
                    state.data["D8"] = "=AVERAGE(D2:D6)";
                    state.data["E8"] = "=AVERAGE(E2:E6)";
                    state.data["F8"] = "=AVERAGE(F2:F6)";

                    state.formulas["B8"] = "=AVERAGE(B2:B6)";
                    state.formulas["C8"] = "=AVERAGE(C2:C6)";
                    state.formulas["D8"] = "=AVERAGE(D2:D6)";
                    state.formulas["E8"] = "=AVERAGE(E2:E6)";
                    state.formulas["F8"] = "=AVERAGE(F2:F6)";

                    state.formatting["A8"] = { bold: true, align: 'left', bg: 'bg-brand-yellow/30' };
                    for (let c = 1; c < 6; c++) {
                        const letter = SpreadsheetApp.colToLetter(c);
                        state.formatting[letter + "8"] = { bold: true, align: 'center', bg: 'bg-brand-yellow/30' };
                    }
                    break;

                case 'attendance':
                    state.sheetTitle = "Attendance Sheet";
                    state.colsCount = 8;
                    state.rowsCount = 10;

                    state.data["A1"] = "Student Name";
                    state.data["B1"] = "Mon";
                    state.data["C1"] = "Tue";
                    state.data["D1"] = "Wed";
                    state.data["E1"] = "Thu";
                    state.data["F1"] = "Fri";
                    state.data["G1"] = "Days Present";
                    state.data["H1"] = "% Present";

                    ["A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"].forEach(coord => {
                        state.formatting[coord] = { bold: true, align: 'center', bg: 'bg-brand-blue/25' };
                    });

                    const attStudents = ["John Smith", "Sara Connor", "Mike Myers", "Bruce Wayne", "Clark Kent"];
                    attStudents.forEach((name, i) => {
                        const row = i + 2;
                        state.data["A" + row] = name;
                        
                        // Fill attendance mocks (1 present, 0 absent)
                        state.data["B" + row] = "1";
                        state.data["C" + row] = (i === 1) ? "0" : "1";
                        state.data["D" + row] = "1";
                        state.data["E" + row] = (i === 3) ? "0" : "1";
                        state.data["F" + row] = "1";
                        
                        state.data["G" + row] = `=SUM(B${row}:F${row})`;
                        state.data["H" + row] = `=(G${row}/5)*100`;

                        state.formulas["G" + row] = `=SUM(B${row}:F${row})`;
                        state.formulas["H" + row] = `=(G${row}/5)*100`;

                        state.formatting["A" + row] = { bold: true, align: 'left' };
                        state.formatting["B" + row] = { align: 'center', bg: (state.data["B" + row] === "1") ? "bg-brand-green/25" : "bg-brand-pink/25" };
                        state.formatting["C" + row] = { align: 'center', bg: (state.data["C" + row] === "1") ? "bg-brand-green/25" : "bg-brand-pink/25" };
                        state.formatting["D" + row] = { align: 'center', bg: (state.data["D" + row] === "1") ? "bg-brand-green/25" : "bg-brand-pink/25" };
                        state.formatting["E" + row] = { align: 'center', bg: (state.data["E" + row] === "1") ? "bg-brand-green/25" : "bg-brand-pink/25" };
                        state.formatting["F" + row] = { align: 'center', bg: (state.data["F" + row] === "1") ? "bg-brand-green/25" : "bg-brand-pink/25" };
                        
                        state.formatting["G" + row] = { bold: true, align: 'center' };
                        state.formatting["H" + row] = { bold: true, align: 'center', bg: 'bg-brand-yellow/30' };
                    });
                    break;

                case 'vocab':
                    state.sheetTitle = "Vocab Bingo Board";
                    state.colsCount = 5;
                    state.rowsCount = 5;

                    const wordList = [
                        "Dinosaur", "Teacher", "Computer", "Student", "Elephant",
                        "Hamburger", "Beautiful", "Climbing", "Running", "Yellow",
                        "Delicious", "Notebook", "Pencil", "Translate", "Dictionary",
                        "Backpack", "Tomorrow", "Yesterday", "Classroom", "Learning",
                        "Sentence", "Vocabulary", "Grammar", "Pronounce", "Practice"
                    ];

                    const wordTypes = [
                        "noun", "noun", "noun", "noun", "noun",
                        "noun", "adj", "verb", "verb", "adj",
                        "adj", "noun", "noun", "verb", "noun",
                        "noun", "noun", "noun", "noun", "verb",
                        "noun", "noun", "noun", "verb", "verb"
                    ];

                    for (let r = 0; r < 5; r++) {
                        for (let c = 0; c < 5; c++) {
                            const index = r * 5 + c;
                            const coord = SpreadsheetApp.colToLetter(c) + (r + 1);
                            state.data[coord] = wordList[index];
                            
                            // Color style depending on word types
                            let bg = "";
                            if (wordTypes[index] === "noun") bg = "bg-brand-blue/25";
                            else if (wordTypes[index] === "verb") bg = "bg-brand-green/25";
                            else if (wordTypes[index] === "adj") bg = "bg-brand-yellow/30";

                            state.formatting[coord] = { bold: true, align: 'center', bg: bg };
                        }
                    }
                    break;
            }

            document.getElementById('sheet-title').value = state.sheetTitle;
            SpreadsheetApp.Grid.render();
            SpreadsheetApp.Formulas.recalculateAll();
            this.autosave();
            
            // Set cell selection to top left cell B2/A1
            SpreadsheetApp.Grid.selectCell("A1");
            
            SpreadsheetApp.UI.showToast(`Loaded ${state.sheetTitle} Template`, "success");
        }
    };

    /* =========================================================================
       7. UI INTERACTION & CONTROLS MODULE
       ========================================================================= */
    SpreadsheetApp.UI = {
        initTheme() {
            const savedTheme = localStorage.getItem('theme_hub');
            if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        },

        toggleTheme() {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme_hub', isDark ? 'dark' : 'light');
            this.showToast(isDark ? "Dark mode active" : "Light mode active", "info");
        },

        toggleSavedSheetsPanel(forceShow) {
            const panel = document.getElementById('saved-sheets-panel');
            const backdrop = document.getElementById('sidebar-backdrop');
            if (!panel || !backdrop) return;

            const isShown = panel.classList.contains('translate-x-0');
            const shouldShow = typeof forceShow === 'boolean' ? forceShow : !isShown;

            if (shouldShow) {
                panel.classList.remove('translate-x-full');
                panel.classList.add('translate-x-0');
                backdrop.classList.remove('opacity-0', 'pointer-events-none');
                backdrop.classList.add('opacity-100', 'pointer-events-auto');
                SpreadsheetApp.Sheets.loadSavedSheetsList();
            } else {
                panel.classList.remove('translate-x-0');
                panel.classList.add('translate-x-full');
                backdrop.classList.remove('opacity-100', 'pointer-events-auto');
                backdrop.classList.add('opacity-0', 'pointer-events-none');
            }
        },

        toggleDropdown(dropdownId, forceClose = false) {
            const el = document.getElementById(dropdownId);
            if (!el) return;

            const isHidden = el.classList.contains('hidden');

            // Close other dropdowns
            document.querySelectorAll('[id$="-dropdown"]').forEach(drop => {
                if (drop.id !== dropdownId) drop.classList.add('hidden');
            });

            if (forceClose) {
                el.classList.add('hidden');
            } else if (isHidden) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        },

        showHelpModal() {
            const modal = document.getElementById('help-modal');
            if (!modal) return;

            modal.classList.remove('pointer-events-none');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                modal.classList.add('opacity-100');
            }, 10);
        },

        hideHelpModal() {
            const modal = document.getElementById('help-modal');
            if (!modal) return;

            modal.classList.remove('opacity-100');
            modal.classList.add('opacity-0');
            setTimeout(() => {
                modal.classList.add('pointer-events-none');
            }, 300);
        },

        // Helper to trigger transient banner notifications
        showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const toast = document.createElement('div');
            toast.className = `toast toast-${type} px-6 py-3 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white border-2 border-slate-700 shadow-xl flex items-center gap-2 pointer-events-auto transition-all`;

            // Map types to icons
            let icon = 'info';
            if (type === 'success') icon = 'check-circle';
            else if (type === 'warning') icon = 'alert-triangle';
            else if (type === 'error') icon = 'x-circle';

            toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span class="text-xs font-bold font-heading uppercase tracking-wide">${message}</span>`;
            container.appendChild(toast);

            if (window.lucide) window.lucide.createIcons();

            // Self cleanup after 3 seconds
            setTimeout(() => {
                toast.style.animation = 'toast-out 0.4s ease forwards';
                setTimeout(() => toast.remove(), 400);
            }, 3000);
        },

        bindEvents() {
            const state = SpreadsheetApp.State;

            // Sheet title change listener
            const titleInput = document.getElementById('sheet-title');
            if (titleInput) {
                titleInput.addEventListener('blur', () => {
                    const trimVal = titleInput.value.trim();
                    state.sheetTitle = trimVal === '' ? "Untitled Class Sheet" : trimVal;
                    titleInput.value = state.sheetTitle;
                    SpreadsheetApp.Sheets.autosave();
                });
                titleInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        titleInput.blur();
                    }
                });
            }

            // Formula Bar input changes
            const formulaInput = document.getElementById('formula-input');
            if (formulaInput) {
                const debouncedRecalculate = SpreadsheetApp.debounce(() => {
                    SpreadsheetApp.Formulas.recalculateAll();
                    SpreadsheetApp.Sheets.autosave();
                }, 300);

                formulaInput.addEventListener('input', () => {
                    if (state.activeCell) {
                        const val = formulaInput.value;
                        state.data[state.activeCell] = val;

                        if (val.startsWith('=')) {
                            state.formulas[state.activeCell] = val;
                        } else {
                            delete state.formulas[state.activeCell];
                        }

                        debouncedRecalculate();
                    }
                });

                formulaInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        formulaInput.blur();
                        SpreadsheetApp.Grid.moveSelection('down');
                    }
                });
            }

            // Global Keydown Events for Cell Selection Navigation
            document.addEventListener('keydown', (e) => {
                if (state.isEditing) return; // Ignore when input editor is open
                
                // Ignore keybinds if user has focus inside headers, buttons or modals
                if (document.activeElement && 
                    (document.activeElement.tagName === 'INPUT' || 
                     document.activeElement.tagName === 'SELECT' || 
                     document.activeElement.tagName === 'TEXTAREA')) {
                    return;
                }

                if (!state.activeCell) return;

                // Handle Ctrl+C & Ctrl+V Copy/Paste Shortcuts
                if (e.ctrlKey && e.key.toLowerCase() === 'c') {
                    e.preventDefault();
                    SpreadsheetApp.Grid.copySelectedRange();
                    return;
                }
                if (e.ctrlKey && e.key.toLowerCase() === 'v') {
                    e.preventDefault();
                    SpreadsheetApp.Grid.pasteClipboard();
                    return;
                }
                if (e.ctrlKey && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    SpreadsheetApp.Sheets.saveCurrentSheet();
                    return;
                }

                switch (e.key) {
                    case 'ArrowUp':
                        e.preventDefault();
                        SpreadsheetApp.Grid.moveSelection('up');
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        SpreadsheetApp.Grid.moveSelection('down');
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        SpreadsheetApp.Grid.moveSelection('left');
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        SpreadsheetApp.Grid.moveSelection('right');
                        break;
                    case 'Tab':
                        e.preventDefault();
                        if (e.shiftKey) {
                            SpreadsheetApp.Grid.moveSelection('left');
                        } else {
                            SpreadsheetApp.Grid.moveSelection('right');
                        }
                        break;
                    case 'Enter':
                    case 'F2':
                        e.preventDefault();
                        SpreadsheetApp.Grid.enterEditMode(state.activeCell);
                        break;
                    case 'Backspace':
                    case 'Delete':
                        e.preventDefault();
                        const cellsToClear = SpreadsheetApp.Grid.getSelectedCells();
                        cellsToClear.forEach(coord => {
                            state.data[coord] = '';
                            delete state.formulas[coord];
                        });
                        
                        // Update Formula bar
                        if (formulaInput) {
                            formulaInput.value = state.data[state.activeCell] || '';
                        }
                        
                        SpreadsheetApp.Formulas.recalculateAll();
                        SpreadsheetApp.Sheets.autosave();
                        break;
                }
            });

            // Close dropdowns when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.relative')) {
                    document.querySelectorAll('[id$="-dropdown"]').forEach(drop => {
                        drop.classList.add('hidden');
                    });
                }
            });

            // Selection & Fill Drag Listeners on Document
            document.addEventListener('mousemove', (e) => {
                if (state.isFilling) {
                    SpreadsheetApp.Grid.handleFillMouseMove(e);
                }
            });

            document.addEventListener('mouseup', (e) => {
                if (state.isSelecting) {
                    SpreadsheetApp.Grid.handleMouseUp(e);
                }
                if (state.isFilling) {
                    SpreadsheetApp.Grid.handleFillMouseUp(e);
                }
            });

            // Setup Custom Dynamic Tooltips
            document.addEventListener('mouseover', (e) => {
                const target = e.target.closest('[data-tooltip]');
                const tooltip = document.getElementById('tooltip');
                if (!target || !tooltip) return;

                const text = target.getAttribute('data-tooltip');
                tooltip.textContent = text;
                tooltip.style.opacity = '1';

                const onMouseMove = (moveEvent) => {
                    const offset = 12;
                    tooltip.style.left = (moveEvent.clientX + offset) + 'px';
                    tooltip.style.top = (moveEvent.clientY + offset) + 'px';
                };

                const onMouseLeave = () => {
                    tooltip.style.opacity = '0';
                    target.removeEventListener('mousemove', onMouseMove);
                };

                target.addEventListener('mousemove', onMouseMove);
                target.addEventListener('mouseleave', onMouseLeave, { once: true });
            });
        }
    };

    // Attach to window namespace
    window.SpreadsheetApp = SpreadsheetApp;

    // Run Initializer
    document.addEventListener('DOMContentLoaded', () => {
        SpreadsheetApp.init();
    });

})();
