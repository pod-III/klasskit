/**
 * KlassKit Spreadsheet Tool (Class Sheet)
 * Core Logic & Calculation Engine
 */

(function () {
    'use strict';

    // Global Namespace
    const SpreadsheetApp = {
        State: {
            rowsCount: 25,
            colsCount: 10,
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
            savedSheets: []
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
        init() {
            this.Sheets.loadSavedSheetsList();
            this.UI.initTheme();
            this.Grid.render();
            this.UI.bindEvents();
            
            // Auto-load last active state if it exists
            const autosave = localStorage.getItem('kk_sheet_autosave');
            if (autosave) {
                try {
                    const parsed = JSON.parse(autosave);
                    this.Sheets.loadSheetData(parsed);
                    this.UI.showToast("Last session loaded", "success");
                } catch (e) {
                    this.Templates.load('scoreboard', false);
                }
            } else {
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
                th.appendChild(handle);

                // Apply custom width if saved
                if (state.colsWidths[colLetter]) {
                    th.style.width = state.colsWidths[colLetter] + 'px';
                } else {
                    th.style.width = '120px';
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

                    // Add cell click selection
                    td.addEventListener('click', (e) => this.selectCell(coord, e.shiftKey));
                    td.addEventListener('dblclick', () => this.enterEditMode(coord));

                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }

            document.getElementById('grid-dimensions').textContent = 
                `Grid: ${state.colsCount} Columns x ${state.rowsCount} Rows`;
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

            // Remove highlighted header colors
            const prevSelected = document.querySelector('.selected-cell');
            if (prevSelected) prevSelected.classList.remove('selected-cell');
            
            document.querySelectorAll('th.header-highlight').forEach(el => {
                el.classList.remove('header-highlight');
            });

            state.activeCell = coord;
            const cellElement = document.querySelector(`[data-coord="${coord}"]`);
            if (cellElement) {
                cellElement.classList.add('selected-cell');
                
                // Highlight row & col headers
                const match = coord.match(/^([A-Z]+)([0-9]+)$/);
                if (match) {
                    const colHeader = document.querySelector(`th[data-col="${match[1]}"]`);
                    const rowHeader = document.querySelector(`th[data-row="${match[2]}"]`);
                    if (colHeader) colHeader.classList.add('header-highlight');
                    if (rowHeader) rowHeader.classList.add('header-highlight');
                }
            }

            // Update Formula Bar
            document.getElementById('active-cell-indicator').textContent = coord;
            const rawVal = state.data[coord] || '';
            document.getElementById('formula-input').value = rawVal;
            
            // Sync active formatting toolbar buttons
            SpreadsheetApp.Formatting.syncToolbar(coord);
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
                    const match = td.getAttribute('data-coord').match(/^([A-Z]+)([0-9]+)$/);
                    if (match && match[1] === colLetter) {
                        td.style.width = currentWidth + 'px';
                    }
                });
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
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
                Object.keys(SpreadsheetApp.State.data).forEach(key => {
                    if (key.endsWith(rowStr)) {
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
                Object.keys(SpreadsheetApp.State.data).forEach(key => {
                    if (key.startsWith(colLetter)) {
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
            const coord = SpreadsheetApp.State.activeCell;
            if (!coord) return;

            if (!SpreadsheetApp.State.formatting[coord]) {
                SpreadsheetApp.State.formatting[coord] = {};
            }
            SpreadsheetApp.State.formatting[coord].bold = !SpreadsheetApp.State.formatting[coord].bold;
            
            const td = document.querySelector(`[data-coord="${coord}"]`);
            if (td) SpreadsheetApp.Grid.applyCellStyles(td, coord);
            this.syncToolbar(coord);
            SpreadsheetApp.Sheets.autosave();
        },

        toggleItalic() {
            const coord = SpreadsheetApp.State.activeCell;
            if (!coord) return;

            if (!SpreadsheetApp.State.formatting[coord]) {
                SpreadsheetApp.State.formatting[coord] = {};
            }
            SpreadsheetApp.State.formatting[coord].italic = !SpreadsheetApp.State.formatting[coord].italic;
            
            const td = document.querySelector(`[data-coord="${coord}"]`);
            if (td) SpreadsheetApp.Grid.applyCellStyles(td, coord);
            this.syncToolbar(coord);
            SpreadsheetApp.Sheets.autosave();
        },

        setAlign(alignType) {
            const coord = SpreadsheetApp.State.activeCell;
            if (!coord) return;

            if (!SpreadsheetApp.State.formatting[coord]) {
                SpreadsheetApp.State.formatting[coord] = {};
            }
            SpreadsheetApp.State.formatting[coord].align = alignType;
            
            const td = document.querySelector(`[data-coord="${coord}"]`);
            if (td) SpreadsheetApp.Grid.applyCellStyles(td, coord);
            this.syncToolbar(coord);
            SpreadsheetApp.Sheets.autosave();
        },

        setBackground(bgColorClass) {
            const coord = SpreadsheetApp.State.activeCell;
            if (!coord) return;

            if (!SpreadsheetApp.State.formatting[coord]) {
                SpreadsheetApp.State.formatting[coord] = {};
            }
            SpreadsheetApp.State.formatting[coord].bg = bgColorClass;
            
            const td = document.querySelector(`[data-coord="${coord}"]`);
            if (td) SpreadsheetApp.Grid.applyCellStyles(td, coord);
            SpreadsheetApp.Sheets.autosave();
        },

        adjustZoom(val) {
            const state = SpreadsheetApp.State;
            state.zoom = Math.min(150, Math.max(70, state.zoom + (val * 10)));
            document.getElementById('zoom-value').textContent = state.zoom + '%';

            // Apply zoom style rules to grid table
            const grid = document.getElementById('spreadsheet-grid');
            if (grid) {
                grid.style.transform = `scale(${state.zoom / 100})`;
                grid.style.transformOrigin = 'top left';
                
                // Adjust container size to account for scaled content
                const wrap = document.getElementById('grid-wrapper');
                // Calculate dynamic padding or size adjustments if needed
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
                            const val = SpreadsheetApp.State.data[coord] || '';
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
                colsWidths: state.colsWidths,
                sheetTitle: state.sheetTitle,
                zoom: state.zoom
            };
            localStorage.setItem('kk_sheet_autosave', JSON.stringify(saveObj));
            
            const indicator = document.getElementById('save-status');
            if (indicator) {
                indicator.textContent = 'Auto-Saved';
                indicator.className = 'text-green-500 font-bold';
                setTimeout(() => {
                    indicator.textContent = 'Saved Locally';
                    indicator.className = 'text-slate-400 dark:text-slate-500 font-bold';
                }, 2000);
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
        saveCurrentSheet() {
            const state = SpreadsheetApp.State;
            const titleInput = document.getElementById('sheet-title');
            if (titleInput && titleInput.value.trim() !== '') {
                state.sheetTitle = titleInput.value.trim();
            }

            const sheetData = {
                id: state.sheetId || 'sheet_' + Date.now(),
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
            
            this.loadSavedSheetsList();
            this.autosave();
            SpreadsheetApp.UI.showToast("Sheet saved successfully!", "success");
        },

        loadSavedSheetsList() {
            const listEl = document.getElementById('saved-sheets-list');
            if (!listEl) return;

            listEl.innerHTML = '';
            let saved = [];
            const savedStr = localStorage.getItem('kk_sheet_saved_list');
            if (savedStr) {
                try {
                    saved = JSON.parse(savedStr);
                } catch (e) {
                    saved = [];
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

        loadSheetById(id) {
            const savedStr = localStorage.getItem('kk_sheet_saved_list');
            if (!savedStr) return;

            try {
                const saved = JSON.parse(savedStr);
                const sheet = saved.find(s => s.id === id);
                if (sheet) {
                    if (confirm(`Load "${sheet.title}"? Unsaved changes in active sheet will be lost.`)) {
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

        deleteSheetById(id) {
            const savedStr = localStorage.getItem('kk_sheet_saved_list');
            if (!savedStr) return;

            if (confirm("Are you sure you want to delete this sheet? This action cannot be undone.")) {
                try {
                    const saved = JSON.parse(savedStr);
                    const filtered = saved.filter(s => s.id !== id);
                    localStorage.setItem('kk_sheet_saved_list', JSON.stringify(filtered));
                    
                    if (SpreadsheetApp.State.sheetId === id) {
                        SpreadsheetApp.State.sheetId = null;
                    }

                    this.loadSavedSheetsList();
                    SpreadsheetApp.UI.showToast("Sheet deleted", "success");
                } catch (e) {
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
            
            document.getElementById('sheet-title').value = state.sheetTitle;
            document.getElementById('zoom-value').textContent = state.zoom + '%';

            // Sync grid scale zoom
            const grid = document.getElementById('spreadsheet-grid');
            if (grid) grid.style.transform = `scale(${state.zoom / 100})`;

            SpreadsheetApp.Grid.render();
            SpreadsheetApp.Formulas.recalculateAll();
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
       6. EDUCATIONAL WORKBOOK TEMPLATES
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
                    state.colsCount = 6;
                    state.rowsCount = 10;
                    
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
                        state.data["F" + rowNum] = `=COUNT(B${rowNum}:D${rowNum})`;

                        state.formulas["E" + rowNum] = `=SUM(B${rowNum}:D${rowNum})`;
                        state.formulas["F" + rowNum] = `=COUNT(B${rowNum}:D${rowNum})`;

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

        toggleDropdown(dropdownId) {
            const el = document.getElementById(dropdownId);
            if (!el) return;

            const isHidden = el.classList.contains('hidden');
            
            // Close other dropdowns
            document.querySelectorAll('[id$="-dropdown"]').forEach(drop => {
                if (drop.id !== dropdownId) drop.classList.add('hidden');
            });

            if (isHidden) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        },

        showHelpModal() {
            const modal = document.getElementById('help-modal');
            if (!modal) return;
            
            modal.classList.remove('hidden');
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
                modal.classList.add('hidden');
            }, 300);
        },

        // Helper to trigger transient banner notifications
        showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            if (!container) {
                // Create container if missing
                const tCon = document.createElement('div');
                tCon.id = 'toast-container';
                tCon.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2.5 pointer-events-none';
                document.body.appendChild(tCon);
            }

            const toast = document.createElement('div');
            toast.className = `toast toast-${type} px-6 py-3 rounded-2xl bg-slate-900/95 dark:bg-slate-850/95 backdrop-blur-md text-white border-2 border-slate-700 shadow-xl flex items-center gap-2 pointer-events-auto transition-all`;
            
            // Map types to icons
            let icon = 'info';
            if (type === 'success') icon = 'check-circle';
            else if (type === 'warning') icon = 'alert-triangle';
            else if (type === 'error') icon = 'x-circle';

            toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span class="text-xs font-bold font-heading uppercase tracking-wide">${message}</span>`;
            document.getElementById('toast-container').appendChild(toast);
            
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
                formulaInput.addEventListener('input', () => {
                    if (state.activeCell) {
                        const val = formulaInput.value;
                        state.data[state.activeCell] = val;
                        
                        if (val.startsWith('=')) {
                            state.formulas[state.activeCell] = val;
                        } else {
                            delete state.formulas[state.activeCell];
                        }
                        
                        SpreadsheetApp.Formulas.recalculateAll();
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
                        state.data[state.activeCell] = '';
                        delete state.formulas[state.activeCell];
                        
                        // Update Formula bar
                        formulaInput.value = '';
                        
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
                    target.removeEventListener('mouseleave', onMouseLeave);
                };

                target.addEventListener('mousemove', onMouseMove);
                target.addEventListener('mouseleave', onMouseLeave);
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
