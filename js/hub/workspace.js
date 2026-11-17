// KlassKit Hub — Multi-Tab & Split-Screen Workspace (TabManager)

// --- TAB MANAGER ---
const TabManager = {
  tabs: [],
  activeTabId: null, // This is the "primary" or "left" tab when split
  splitScreenActive: false,
  rightTabId: null,
  groups: [],
  contextMenu: null,
  groupMenu: null,
  GROUP_COLORS: [
    { name: 'Blue',   value: 'blue',   hex: '#1ea7fd' },
    { name: 'Pink',   value: 'pink',   hex: '#ff4785' },
    { name: 'Green',  value: 'green',  hex: '#00d063' },
    { name: 'Orange', value: 'orange', hex: '#ff7e33' },
    { name: 'Purple', value: 'purple', hex: '#8b5cf6' },
    { name: 'Teal',   value: 'teal',   hex: '#14b8a6' },
    { name: 'Red',    value: 'red',    hex: '#ef4444' },
    { name: 'Amber',  value: 'amber',  hex: '#f59e0b' },
  ],

  getGroupColorHex(colorValue) {
    return this.GROUP_COLORS.find(c => c.value === colorValue)?.hex || '#1ea7fd';
  },

  getNextGroupColor() {
    const usedColors = this.groups.map(g => g.color);
    const unused = this.GROUP_COLORS.find(c => !usedColors.includes(c.value));
    return unused ? unused.value : this.GROUP_COLORS[this.groups.length % this.GROUP_COLORS.length].value;
  },

  init() {
    if (this._initialized) {
      this.updateWorkspaceBadge();
      return;
    }
    this._initialized = true;
    this.setupKeyboardShortcuts();
    this.loadGroupsFromStorage();
    this.loadTabsFromStorage();
    this.setupContextMenu();
    this.setupTouchDrag();
    this.updateWorkspaceBadge();
  },

  // ============================
  // TOUCH DRAG SYSTEM
  // ============================
  _touchDrag: {
    active: false,
    startX: 0,
    startY: 0,
    ghost: null,
    sourceType: null,  // 'tab' | 'group'
    sourceId: null,
    longPressTimer: null,
    longPressDelay: 300,
    currentDropTarget: null,
  },

  setupTouchDrag() {
    // Global touch move / end handlers (bound once)
    document.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    document.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
    document.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });
  },

  attachTouchDragToTab(tabIcon, tabId) {
    tabIcon.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const td = this._touchDrag;
      td.startX = touch.clientX;
      td.startY = touch.clientY;
      td.sourceType = 'tab';
      td.sourceId = tabId;
      td._sourceEl = tabIcon;

      // Clear any previous timer
      if (td.longPressTimer) clearTimeout(td.longPressTimer);
      td.longPressTimer = setTimeout(() => {
        td.longPressTimer = null;
        this._startTouchDrag(td.startX, td.startY, tabIcon);
      }, td.longPressDelay);
    }, { passive: false });
  },

  attachTouchDragToGroup(groupEl, groupId) {
    const header = groupEl.querySelector('.tab-group-header');
    if (!header) return;
    header.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      const touch = e.touches[0];
      const td = this._touchDrag;
      td.startX = touch.clientX;
      td.startY = touch.clientY;
      td.sourceType = 'group';
      td.sourceId = groupId;
      td._sourceEl = groupEl;

      if (td.longPressTimer) clearTimeout(td.longPressTimer);
      td.longPressTimer = setTimeout(() => {
        td.longPressTimer = null;
        this._startTouchDrag(td.startX, td.startY, groupEl);
      }, td.longPressDelay);
    }, { passive: false });
  },

  _startTouchDrag(x, y, sourceEl) {
    const td = this._touchDrag;
    td.active = true;

    // Haptic feedback if available
    if (navigator.vibrate) navigator.vibrate(30);

    // Prevent context menu / text selection while dragging
    document.body.classList.add('touch-dragging');

    // Create ghost
    const ghost = document.createElement('div');
    ghost.className = 'touch-drag-ghost';
    ghost.innerHTML = sourceEl.querySelector('.side-panel-tab-icon')?.outerHTML
                   || sourceEl.querySelector('.tab-group-name')?.outerHTML
                   || '<span>⋮</span>';
    ghost.style.left = `${x - 24}px`;
    ghost.style.top = `${y - 24}px`;
    document.body.appendChild(ghost);
    td.ghost = ghost;

    // Mark source
    sourceEl.classList.add('dragging');

    Utils.refreshIcons(ghost);
  },

  _onTouchMove(e) {
    const td = this._touchDrag;
    if (!td.longPressTimer && !td.active) return;

    const touch = e.touches[0];

    // If not yet dragging, check if finger moved too much → cancel long press
    if (td.longPressTimer && !td.active) {
      const dx = Math.abs(touch.clientX - td.startX);
      const dy = Math.abs(touch.clientY - td.startY);
      if (dx > 10 || dy > 10) {
        clearTimeout(td.longPressTimer);
        td.longPressTimer = null;
      }
      return;
    }

    if (!td.active) return;
    e.preventDefault(); // Prevent scroll while dragging

    // Move ghost
    if (td.ghost) {
      td.ghost.style.left = `${touch.clientX - 24}px`;
      td.ghost.style.top = `${touch.clientY - 24}px`;
    }

    // Find drop target under finger
    if (td.ghost) td.ghost.style.pointerEvents = 'none';
    const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
    if (td.ghost) td.ghost.style.pointerEvents = '';

    // Clear old highlight
    if (td.currentDropTarget && td.currentDropTarget !== elUnder) {
      td.currentDropTarget.classList.remove('drag-over');
    }

    // Highlight new target
    const dropTarget = elUnder?.closest('.side-panel-tab, .tab-group-header, .tab-ungrouped-dropzone');
    if (dropTarget) {
      dropTarget.classList.add('drag-over');
      td.currentDropTarget = dropTarget;
    } else {
      td.currentDropTarget = null;
    }
  },

  _onTouchEnd(e) {
    const td = this._touchDrag;

    // Clear long-press timer
    if (td.longPressTimer) {
      clearTimeout(td.longPressTimer);
      td.longPressTimer = null;
    }

    if (!td.active) return;
    td.active = false;

    // Remove ghost
    if (td.ghost) {
      td.ghost.remove();
      td.ghost = null;
    }

    // Remove source styling
    if (td._sourceEl) {
      td._sourceEl.classList.remove('dragging');
    }

    // Resolve drop
    const target = td.currentDropTarget;
    if (target) {
      target.classList.remove('drag-over');

      if (td.sourceType === 'tab') {
        if (target.classList.contains('side-panel-tab')) {
          // Drop tab on tab
          const targetTabId = target.dataset.tabId;
          if (targetTabId && targetTabId !== td.sourceId) {
            const draggedTab = this.tabs.find(t => t.id === td.sourceId);
            const targetTab = this.tabs.find(t => t.id === targetTabId);
            if (draggedTab && targetTab && draggedTab.groupId === targetTab.groupId) {
              this.reorderTabs(td.sourceId, targetTabId);
            } else if (draggedTab) {
              this.moveTabToGroup(td.sourceId, targetTab?.groupId || null);
            }
            AudioEngine.click();
          }
        } else if (target.classList.contains('tab-group-header')) {
          // Drop tab on group header
          const groupEl = target.closest('.tab-group');
          const groupId = groupEl?.dataset.groupId;
          if (groupId) {
            this.moveTabToGroup(td.sourceId, groupId);
            AudioEngine.click();
          }
        } else if (target.classList.contains('tab-ungrouped-dropzone')) {
          // Drop tab to ungrouped
          this.moveTabToGroup(td.sourceId, null);
          AudioEngine.click();
        }
      } else if (td.sourceType === 'group') {
        if (target.classList.contains('tab-group-header')) {
          const groupEl = target.closest('.tab-group');
          const targetGroupId = groupEl?.dataset.groupId;
          if (targetGroupId && targetGroupId !== td.sourceId) {
            this.reorderGroups(td.sourceId, targetGroupId);
            AudioEngine.click();
          }
        }
      }
    }

    // Clean up all drag-over states
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.body.classList.remove('touch-dragging');
    td.currentDropTarget = null;
    td._sourceEl = null;
  },

  saveTabsToStorage() {
    const tabsData = this.tabs.map(({ id, gameId, title, icon, color, pinned, groupId }) => ({ id, gameId, title, icon, color, pinned, groupId }));
    const effectiveActive = this.activeTabId || this.lastActiveTabId || null;
    Storage.set(CONFIG.storageKeys.tabs, { tabs: tabsData, activeTabId: effectiveActive });
  },

  saveGroupsToStorage() {
    Storage.set(CONFIG.storageKeys.tabGroups, this.groups);
  },

  loadGroupsFromStorage() {
    const saved = Storage.get(CONFIG.storageKeys.tabGroups);
    this.groups = Array.isArray(saved) ? saved : [];
    // Migrate old 'text-blue' format to just 'blue'
    this.groups.forEach(g => {
      if (g.color && g.color.startsWith('text-')) {
        g.color = g.color.replace('text-', '').split('-')[0];
      }
    });
  },

  loadTabsFromStorage() {
    const savedData = Storage.get(CONFIG.storageKeys.tabs);
    if (!savedData?.tabs?.length) return;

    UI.toggleModal('game-modal', true);
    savedData.tabs.forEach(tabData => {
      const game = State.getGameById(tabData.gameId);
      if (!game) return;
      if (game.pro && !State.isPro()) return;
      if (game.adminOnly && !State.isAdmin()) return;
      const tab = this.createTabSilent(game, tabData.id, false, tabData.groupId);
      if (tabData.pinned) this.togglePinTab(tab.id, true);
    });

    const targetTab = (savedData.activeTabId && this.tabs.find(t => t.id === savedData.activeTabId))
      ? savedData.activeTabId : this.tabs[0]?.id;
    this.renderGroups();
    if (targetTab) this.switchToTab(targetTab);
    this.updateEmptyState();
  },

  createGroup(name, color = null) {
    const id = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const assignedColor = color || this.getNextGroupColor();
    const group = { id, name: name || 'New Group', color: assignedColor, collapsed: false };
    this.groups.push(group);
    this.saveGroupsToStorage();
    this.renderGroups();
    AudioEngine.click();
    return group;
  },

  changeGroupColor(groupId, newColor) {
    const group = this.groups.find(g => g.id === groupId);
    if (group) {
      group.color = newColor;
      this.saveGroupsToStorage();
      this.renderGroups();
    }
  },

  reorderGroups(draggedGroupId, targetGroupId) {
    const draggedIdx = this.groups.findIndex(g => g.id === draggedGroupId);
    const targetIdx = this.groups.findIndex(g => g.id === targetGroupId);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const [moved] = this.groups.splice(draggedIdx, 1);
    this.groups.splice(targetIdx, 0, moved);
    this.saveGroupsToStorage();
    this.renderGroups();
  },

  deleteGroup(groupId) {
    const index = this.groups.findIndex(g => g.id === groupId);
    if (index === -1) return;
    this.groups.splice(index, 1);

    // Close all tabs that belong to this group
    const tabsInGroup = this.tabs.filter(t => t.groupId === groupId);
    tabsInGroup.forEach(tab => {
      tab.iconElement?.remove();
      tab.panel?.remove();
    });
    this.tabs = this.tabs.filter(t => t.groupId !== groupId);

    // If active tab was in the deleted group, switch to another
    if (this.activeTabId && !this.tabs.find(t => t.id === this.activeTabId)) {
      this.activeTabId = this.tabs.length > 0 ? this.tabs[this.tabs.length - 1].id : null;
      if (this.activeTabId) {
        this.switchToTab(this.activeTabId);
      } else {
        this.updateEmptyState();
        this.closeModal();
      }
    }

    this.saveGroupsToStorage();
    this.saveTabsToStorage();
    this.renderGroups();
    AudioEngine.click();
  },

  renameGroup(groupId, name) {
    const group = this.groups.find(g => g.id === groupId);
    if (group) {
      group.name = name || group.name;
      this.saveGroupsToStorage();
      this.renderGroups();
    }
  },

  toggleGroupCollapsed(groupId) {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;
    group.collapsed = !group.collapsed;
    this.saveGroupsToStorage();
    const el = document.getElementById(groupId);
    if (el) el.classList.toggle('collapsed', group.collapsed);
    // CSS handles chevron rotation; keep icon as chevron-down always
    Utils.refreshIcons();
    AudioEngine.click();
  },

  moveTabToGroup(tabId, groupId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    tab.groupId = groupId || null;
    this.saveTabsToStorage();
    this.renderGroups();
    AudioEngine.click();
  },

  renderGroups() {
    const container = document.getElementById('side-panel-tabs');
    if (!container) return;

    // Remember scroll position
    const scrollTop = container.scrollTop;

    // Clear container but keep references to iconElements
    container.innerHTML = '';

    // First render ungrouped tabs
    const ungroupedTabs = this.tabs.filter(t => !t.groupId);
    ungroupedTabs.forEach(tab => {
      if (tab.iconElement) {
        container.appendChild(tab.iconElement);
      } else {
        this.createTabIcon(tab);
      }
    });

    // Then render each group
    this.groups.forEach(group => {
      const colorHex = this.getGroupColorHex(group.color);

      const groupEl = document.createElement('div');
      groupEl.id = group.id;
      groupEl.className = `tab-group${group.collapsed ? ' collapsed' : ''}`;
      groupEl.dataset.groupId = group.id;
      groupEl.draggable = true;
      groupEl.style.setProperty('--group-color', colorHex);

      const header = document.createElement('button');
      header.className = 'tab-group-header';
      header.type = 'button';
      header.setAttribute('data-title', group.name);
      header.innerHTML = `
        <span class="tab-group-color-dot" style="background:${colorHex}"></span>
        <span class="tab-group-name">${this.escapeHtml(group.name)}</span>
        <span class="tab-group-chevron"><i data-lucide="chevron-down"></i></span>
        <span class="tab-group-count">${this.tabs.filter(t => t.groupId === group.id).length}</span>
      `;
      header.addEventListener('click', () => this.toggleGroupCollapsed(group.id));

      // --- Group dragging ---
      groupEl.addEventListener('dragstart', (e) => {
        // Only start group drag from the header
        if (!e.target.closest('.tab-group-header') && !e.target.classList?.contains('tab-group')) {
          // Let tab drag bubble naturally
          return;
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/group-id', group.id);
        e.dataTransfer.setData('text/plain', ''); // prevent tab handler from acting
        setTimeout(() => groupEl.classList.add('dragging'), 0);
      });

      groupEl.addEventListener('dragend', () => {
        groupEl.classList.remove('dragging');
        container.querySelectorAll('.tab-group').forEach(el => el.classList.remove('drag-over'));
        container.querySelectorAll('.tab-group-header').forEach(el => el.classList.remove('drag-over'));
      });

      // Drop on group header: accept tabs AND groups
      header.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        header.classList.add('drag-over');
      });
      header.addEventListener('dragleave', () => header.classList.remove('drag-over'));
      header.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        header.classList.remove('drag-over');
        const draggedGroupId = e.dataTransfer.getData('application/group-id');
        const draggedTabId = e.dataTransfer.getData('text/plain');
        if (draggedGroupId && draggedGroupId !== group.id) {
          // Reorder groups
          this.reorderGroups(draggedGroupId, group.id);
          AudioEngine.click();
        } else if (draggedTabId && draggedTabId !== '') {
          // Move tab into group
          this.moveTabToGroup(draggedTabId, group.id);
        }
      });

      // Context menu for group
      header.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showGroupContextMenu(e.clientX, e.clientY, group.id);
      });

      const tabsContainer = document.createElement('div');
      tabsContainer.className = 'tab-group-tabs';

      const groupTabs = this.tabs.filter(t => t.groupId === group.id);
      groupTabs.forEach(tab => {
        if (tab.iconElement) {
          tabsContainer.appendChild(tab.iconElement);
        } else {
          this.createTabIcon(tab);
          if (tab.iconElement) tabsContainer.appendChild(tab.iconElement);
        }
      });

      groupEl.appendChild(header);
      groupEl.appendChild(tabsContainer);
      container.appendChild(groupEl);

      // Touch drag support for groups
      this.attachTouchDragToGroup(groupEl, group.id);
    });

    // Add an ungrouped drop zone at the bottom so you can drop tabs out of groups
    const dropZone = document.createElement('div');
    dropZone.className = 'tab-ungrouped-dropzone';
    dropZone.innerHTML = '<i data-lucide="inbox" class="w-3 h-3 opacity-40"></i>';
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const draggedTabId = e.dataTransfer.getData('text/plain');
      if (draggedTabId && draggedTabId !== '') {
        this.moveTabToGroup(draggedTabId, null);
      }
    });
    container.appendChild(dropZone);

    Utils.refreshIcons(container);
    container.scrollTop = scrollTop;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  setupContextMenu() {
    // Tab context menu
    this.contextMenu = document.createElement('div');
    this.contextMenu.id = 'tab-context-menu';
    this.contextMenu.className = 'fixed z-[100] bg-white dark:bg-slate-800 border-2 border-dark dark:border-slate-600 rounded-xl shadow-hard p-2 hidden flex-col gap-1 min-w-[180px]';
    document.body.appendChild(this.contextMenu);

    // Group submenu ("Add to Group")
    this.groupMenu = document.createElement('div');
    this.groupMenu.id = 'tab-group-submenu';
    this.groupMenu.className = 'fixed z-[101] bg-white dark:bg-slate-800 border-2 border-dark dark:border-slate-600 rounded-xl shadow-hard p-2 hidden flex-col gap-1 min-w-[160px]';
    document.body.appendChild(this.groupMenu);

    // Hide menus on click elsewhere
    document.addEventListener('click', () => {
      this.hideContextMenu();
    });
  },

  showTabContextMenu(x, y, tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    const menu = this.contextMenu;
    const hasGroups = this.groups.length > 0;

    menu.innerHTML = '';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.remove('hidden');
    menu.classList.add('flex');

    const addItem = (label, icon, action) => {
      const btn = document.createElement('button');
      btn.className = 'w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors';
      btn.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${label}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        action();
        this.hideContextMenu();
      });
      menu.appendChild(btn);
    };

    addItem('Pin / Unpin', 'pin', () => this.togglePinTab(tabId));
    addItem('Reload', 'rotate-cw', () => this.reloadTab(tabId));
    addItem('Open in New Tab', 'external-link', () => {
      const game = State.getGameById(tab.gameId);
      if (!game) return;
      if (game.pro && !State.isPro()) {
        UI.showToast("This app is exclusive to PRO users", "warning");
        return;
      }
      if (game.adminOnly && !State.isAdmin()) {
        UI.showToast("This app is exclusive to ADMIN users", "warning");
        return;
      }
      window.open(game.path, '_blank', 'noopener,noreferrer');
    });
    addItem('Close Tab', 'x', () => this.closeTab(tabId));

    if (hasGroups) {
      const separator = document.createElement('div');
      separator.className = 'h-px bg-slate-200 dark:bg-slate-700 my-1';
      menu.appendChild(separator);

      addItem('Add to Group...', 'folder-plus', () => {
        this.showGroupSubmenu(x + menu.offsetWidth + 4, y, tabId);
      });

      if (tab.groupId) {
        addItem('Remove from Group', 'folder-minus', () => this.moveTabToGroup(tabId, null));
      }
    }

    const separator2 = document.createElement('div');
    separator2.className = 'h-px bg-slate-200 dark:bg-slate-700 my-1';
    menu.appendChild(separator2);

    addItem('New Group...', 'folder-plus', async () => {
      this.hideContextMenu();
      const name = await InputPopup.show('New Group', '', 'Group name');
      if (name) {
        const group = this.createGroup(name);
        this.moveTabToGroup(tabId, group.id);
      }
    });

    Utils.refreshIcons(menu);

    // Boundary check
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height}px`;
  },

  showGroupSubmenu(x, y, tabId) {
    const menu = this.groupMenu;
    menu.innerHTML = '';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.remove('hidden');
    menu.classList.add('flex');

    this.groups.forEach(group => {
      const btn = document.createElement('button');
      btn.className = 'w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors';
      btn.innerHTML = `<span class="w-3 h-3 rounded-full" style="background:${this.getGroupColorHex(group.color)}"></span><span>${this.escapeHtml(group.name)}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveTabToGroup(tabId, group.id);
        this.hideContextMenu();
      });
      menu.appendChild(btn);
    });

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${x - rect.width - 200}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height}px`;
  },

  showGroupContextMenu(x, y, groupId) {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;

    const menu = this.contextMenu;
    menu.innerHTML = '';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.remove('hidden');
    menu.classList.add('flex');

    const addItem = (label, icon, action) => {
      const btn = document.createElement('button');
      btn.className = 'w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors';
      btn.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${label}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        action();
        this.hideContextMenu();
      });
      menu.appendChild(btn);
    };

    addItem('Rename Group', 'pencil', async () => {
      this.hideContextMenu();
      const name = await InputPopup.show('Rename Group', group.name, 'Group name');
      if (name) this.renameGroup(groupId, name);
    });

    // Color picker row
    const colorRow = document.createElement('div');
    colorRow.className = 'px-3 py-2';
    const colorLabel = document.createElement('div');
    colorLabel.className = 'text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2';
    colorLabel.textContent = 'Color';
    colorRow.appendChild(colorLabel);
    const colorGrid = document.createElement('div');
    colorGrid.className = 'flex flex-wrap gap-1.5';
    this.GROUP_COLORS.forEach(c => {
      const swatch = document.createElement('button');
      swatch.className = `w-5 h-5 rounded-full border-2 transition-all hover:scale-125 ${group.color === c.value ? 'border-dark dark:border-white scale-110 ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-800' : 'border-transparent'}`;
      swatch.style.background = c.hex;
      swatch.title = c.name;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.changeGroupColor(groupId, c.value);
        this.hideContextMenu();
      });
      colorGrid.appendChild(swatch);
    });
    colorRow.appendChild(colorGrid);
    menu.appendChild(colorRow);

    const sep = document.createElement('div');
    sep.className = 'h-px bg-slate-200 dark:bg-slate-700 my-1';
    menu.appendChild(sep);

    addItem('Delete Group', 'trash-2', async () => {
      const tabCount = this.tabs.filter(t => t.groupId === groupId).length;
      const msg = tabCount > 0
        ? `Delete this group and close ${tabCount} tab${tabCount > 1 ? 's' : ''} inside it?`
        : 'Delete this empty group?';
      const confirmed = await showConfirmModal(msg, {
        title: 'Delete Group?',
        confirmText: 'Delete',
        cancelText: 'Keep',
        icon: 'trash-2',
        iconColor: 'red'
      });
      if (confirmed) this.deleteGroup(groupId);
    });

    Utils.refreshIcons(menu);

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height}px`;
  },

  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.classList.add('hidden');
      this.contextMenu.classList.remove('flex');
    }
    if (this.groupMenu) {
      this.groupMenu.classList.add('hidden');
      this.groupMenu.classList.remove('flex');
    }
  },

  reloadTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab?.iframe) return;
    tab.loading = true;
    tab.iconElement?.classList.add('loading');
    tab.iframe.contentWindow.location.reload();
    setTimeout(() => {
      tab.loading = false;
      tab.iconElement?.classList.remove('loading');
    }, 1000);
  },

  createTab(game) {
    const existingTab = this.tabs.find(tab => tab.gameId === game.id);
    if (existingTab) {
      this.switchToTab(existingTab.id);
      return existingTab;
    }
    if (this.tabs.length >= CONFIG.maxTabs) {
      this.showMaxTabsWarning();
      return null;
    }
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return this.createTabSilent(game, tabId, true);
  },

  createTabSilent(game, tabId, switchTo = false, groupId = null) {
    const tab = { id: tabId, gameId: game.id, title: game.title, icon: game.icon, color: game.color, loading: true, pinned: false, groupId: groupId || null };
    this.createTabIcon(tab);
    this.createTabPanel(tab);
    this.tabs.push(tab);
    if (switchTo) this.switchToTab(tabId);
    this.loadGame(tab, game.path);
    this.saveTabsToStorage();
    this.updateEmptyState();
    return tab;
  },

  createTabIcon(tab) {
    const sidePanelTabs = document.getElementById('side-panel-tabs');
    if (!sidePanelTabs) return;

    const tabIcon = document.createElement('div');
    tabIcon.id = `tab-icon-${tab.id}`;
    tabIcon.className = `side-panel-tab${tab.loading ? ' loading' : ''}`;
    tabIcon.dataset.tabId = tab.id;
    tabIcon.dataset.color = tab.color;
    tabIcon.setAttribute('data-title', tab.title);
    tabIcon.setAttribute('role', 'tab');
    tabIcon.setAttribute('tabindex', '0');
    tabIcon.setAttribute('aria-selected', 'false');
    tabIcon.setAttribute('aria-label', `Switch to ${tab.title}`);
    tabIcon.draggable = true;
    tabIcon.innerHTML = `
      <i data-lucide="${tab.icon}" class="side-panel-tab-icon" aria-hidden="true"></i>
      <button class="side-panel-tab-close" data-tab-id="${tab.id}" data-title="Close Tab" aria-label="Close ${tab.title}" type="button">
        <i data-lucide="x" aria-hidden="true"></i>
      </button>
    `;

    tabIcon.addEventListener('click', (e) => {
      if (!e.target.closest('.side-panel-tab-close')) {
        this.switchToTab(tab.id);
        AudioEngine.click();
      }
    });

    tabIcon.addEventListener('keydown', (e) => {
      if (e.target === tabIcon && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        this.switchToTab(tab.id);
        AudioEngine.click();
      }
    });

    tabIcon.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.togglePinTab(tab.id);
    });

    // Right-click context menu
    tabIcon.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showTabContextMenu(e.clientX, e.clientY, tab.id);
    });

    // Drag and Drop implementation
    tabIcon.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tab.id);
      setTimeout(() => tabIcon.classList.add('dragging'), 0);
    });

    tabIcon.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      tabIcon.classList.add('drag-over');
    });

    tabIcon.addEventListener('dragleave', () => {
      tabIcon.classList.remove('drag-over');
    });

    tabIcon.addEventListener('drop', (e) => {
      e.preventDefault();
      tabIcon.classList.remove('drag-over');
      const draggedTabId = e.dataTransfer.getData('text/plain');
      if (draggedTabId && draggedTabId !== tab.id) {
        const draggedTab = this.tabs.find(t => t.id === draggedTabId);
        if (draggedTab && draggedTab.groupId === tab.groupId) {
          // Same group: reorder
          this.reorderTabs(draggedTabId, tab.id);
        } else if (draggedTab) {
          // Different group or ungrouped: move to this tab's group
          this.moveTabToGroup(draggedTabId, tab.groupId);
        }
        AudioEngine.click();
      }
    });

    tabIcon.addEventListener('dragend', () => {
      tabIcon.classList.remove('dragging');
      document.querySelectorAll('.side-panel-tab').forEach(el => el.classList.remove('drag-over'));
      document.querySelectorAll('.tab-group-header').forEach(el => el.classList.remove('drag-over'));
    });

    // Touch drag support
    this.attachTouchDragToTab(tabIcon, tab.id);

    const closeBtn = tabIcon.querySelector('.side-panel-tab-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeTab(closeBtn.dataset.tabId);
      });
    }

    // If tab has a group, append to group container; otherwise append to side panel
    if (tab.groupId) {
      const groupEl = document.getElementById(tab.groupId);
      const tabsContainer = groupEl?.querySelector('.tab-group-tabs');
      if (tabsContainer) {
        tabsContainer.appendChild(tabIcon);
      } else {
        sidePanelTabs.appendChild(tabIcon);
      }
    } else {
      sidePanelTabs.appendChild(tabIcon);
    }
    Utils.refreshIcons();
    tab.iconElement = tabIcon;
  },

  togglePinTab(tabId, forceState = null) {
    const tabIndex = this.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.tabs[tabIndex];
    tab.pinned = forceState !== null ? forceState : !tab.pinned;

    if (tab.iconElement) {
      tab.iconElement.classList.toggle('pinned', tab.pinned);
    }

    // Move pinned tabs to the front natively (but keep active state etc)
    this.reorderAllTabsByPinStatus();
    this.saveTabsToStorage();
    if (forceState === null) AudioEngine.click();
  },

  reorderAllTabsByPinStatus() {
    // Sort within each group context: ungrouped first, then by group order
    const groupOrder = new Map();
    this.groups.forEach((g, i) => groupOrder.set(g.id, i));

    this.tabs.sort((a, b) => {
      // First by group: ungrouped first, then groups in order
      const aGroupIdx = a.groupId ? (groupOrder.get(a.groupId) ?? 999) : -1;
      const bGroupIdx = b.groupId ? (groupOrder.get(b.groupId) ?? 999) : -1;
      if (aGroupIdx !== bGroupIdx) return aGroupIdx - bGroupIdx;

      // Then by pin status within same group
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return 0;
    });

    this.renderGroups();
  },

  reorderTabs(draggedId, targetId) {
    const draggedIndex = this.tabs.findIndex(t => t.id === draggedId);
    const targetIndex = this.tabs.findIndex(t => t.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const draggedTab = this.tabs[draggedIndex];
    const targetTab = this.tabs[targetIndex];

    // Only reorder if in same group
    if (draggedTab.groupId !== targetTab.groupId) return;

    // Rearrange in array
    this.tabs.splice(draggedIndex, 1);
    const newTargetIndex = this.tabs.findIndex(t => t.id === targetId);
    this.tabs.splice(newTargetIndex, 0, draggedTab);

    // Maintain pin rule within group
    this.reorderAllTabsByPinStatus();

    this.saveTabsToStorage();
  },

  createTabPanel(tab) {
    const tabContentArea = document.getElementById('tab-content-area');
    if (!tabContentArea) return;

    const panel = document.createElement('div');
    panel.id = `tab-panel-${tab.id}`;
    panel.className = 'tab-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-icon-${tab.id}`);
    panel.innerHTML = `
      <div class="tab-loading">
        <div class="spinner"></div>
        <div class="loading-text">Loading ${tab.title.toUpperCase()}...</div>
      </div>
    `;

    const iframe = document.createElement('iframe');
    iframe.id = `iframe-${tab.id}`;
    iframe.title = tab.title;
    iframe.setAttribute('aria-label', `${tab.title} game content`);

    panel.appendChild(iframe);
    tabContentArea.appendChild(panel);
    tab.panel = panel;
    tab.iframe = iframe;
  },

  loadGame(tab, path) {
    if (!tab.iframe) return;

    tab.iframe.src = path;
    tab.iframe.onload = () => {
      tab.loading = false;
      tab.panel.classList.add('loaded');
      tab.iconElement?.classList.remove('loading');
      if (typeof App !== 'undefined' && App.bridgeIframeKeyboard) {
        App.bridgeIframeKeyboard(tab.iframe);
      }
      if (this.activeTabId === tab.id) tab.iframe.focus();
    };

    tab.iframe.onerror = () => {
      tab.loading = false;
      const loadingDiv = tab.panel.querySelector('.tab-loading');
      if (loadingDiv) {
        loadingDiv.innerHTML = `
          <i data-lucide="alert-circle" style="width:4rem;height:4rem;color:#ef4444"></i>
          <div class="loading-text" style="color:#ef4444">FAILED TO LOAD</div>
          <p style="color:#ef4444;font-size:0.875rem;margin-top:1rem">Path: ${path}</p>
          <button class="btn-chunky bg-blue text-white px-6 py-3 rounded-xl mt-4" onclick="TabManager.retryLoad('${tab.id}')">
            <i data-lucide="rotate-cw" class="w-5 h-5 inline mr-2"></i>RETRY
          </button>
        `;
        Utils.refreshIcons();
      }
    };

    setTimeout(() => {
      if (tab.loading) {
        tab.loading = false;
        tab.panel.classList.add('loaded');
        tab.iconElement?.classList.remove('loading');
      }
    }, CONFIG.loadTimeout);
  },

  retryLoad(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    const game = tab && State.getGameById(tab.gameId);
    if (!tab || !game) return;

    tab.loading = true;
    tab.iconElement?.classList.add('loading');
    tab.panel.classList.remove('loaded');
    tab.panel.innerHTML = `
      <div class="tab-loading">
        <div class="spinner"></div>
        <div class="loading-text">Loading ${tab.title.toUpperCase()}...</div>
      </div>
    `;

    const iframe = document.createElement('iframe');
    iframe.id = `iframe-${tab.id}`;
    iframe.title = tab.title;
    tab.panel.appendChild(iframe);
    tab.iframe = iframe;
    this.loadGame(tab, game.path);
  },

  switchToTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    const prevActiveTabId = this.activeTabId;
    if (this.splitScreenActive && tabId === this.rightTabId && prevActiveTabId && prevActiveTabId !== tabId) {
      this.rightTabId = prevActiveTabId;
    }

    this.activeTabId = tabId;
    this.lastActiveTabId = tabId;
    this.tabs.forEach(t => {
      const isActive = t.id === tabId;
      t.iconElement?.classList.toggle('active', isActive);
      t.iconElement?.setAttribute('aria-selected', String(isActive));
      t.panel?.classList.toggle('active', isActive);
      if (!isActive && t.iframe) {
        // Preserve iframe but stop JS execution
        t.iframe.style.display = 'none';
      } else if (isActive) {
        t.iframe.style.display = 'block';
      }
    });

    const game = State.getGameById(tab.gameId);
    if (game) {
      // Privilege check: auto-close tab if user lost access
      if ((game.pro && !State.isPro()) || (game.adminOnly && !State.isAdmin())) {
        this.closeTab(tabId);
        return;
      }
      State.activeGame = game;
      HistoryManager.trackTabOpen(game.id);
    }

    if (window.location.hash !== `#${tab.gameId}`) {
      history.pushState(null, null, `#${tab.gameId}`);
    }

    tab.iconElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    this.updateSplitScreenClasses();
    this.toggleSidePanelMobile(false);
    this.saveTabsToStorage();
  },

  toggleSplitScreen() {
    if (this.tabs.length < 2) {
      UI.showToast('Open at least 2 activities to use Split Screen', 'info', 3000);
      return;
    }

    this.splitScreenActive = !this.splitScreenActive;
    AudioEngine.click();

    if (this.splitScreenActive) {
      // Find the most recently used other tab, or just the first other tab
      const otherTabs = this.tabs.filter(t => t.id !== this.activeTabId);
      this.rightTabId = otherTabs[0].id; // Simple for now: just grab the first other tab
    } else {
      this.rightTabId = null;
    }

    this.updateSplitScreenClasses();
  },

  updateEmptyState() {
    const emptyState = document.getElementById('workspace-empty-state');
    if (emptyState) {
      if (this.tabs.length === 0) {
        emptyState.classList.remove('hidden');
      } else {
        emptyState.classList.add('hidden');
      }
    }
    this.updateWorkspaceBadge();
  },

  updateWorkspaceBadge() {
    const count = this.tabs.length;
    document.querySelectorAll('.workspace-tab-badge').forEach(badge => {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
      badge.classList.toggle('flex', count > 0);
    });
    const workspaceBtn = document.getElementById('workspace-btn');
    if (workspaceBtn) {
      workspaceBtn.classList.toggle('border-pink', count > 0);
      workspaceBtn.title = count > 0
        ? `Open Workspace (${count} running ${count === 1 ? 'tab' : 'tabs'})`
        : 'Open Workspace';
    }
  },

  updateSplitScreenClasses() {
    const area = document.getElementById('tab-content-area');
    if (!area) return;

    if (this.splitScreenActive && this.tabs.length >= 2) {
      area.classList.add('split-mode');

      this.tabs.forEach(tab => {
        if (!tab.panel) return;

        const isLeft = tab.id === this.activeTabId;
        const isRight = tab.id === this.rightTabId;

        tab.panel.classList.toggle('split-left', isLeft);
        tab.panel.classList.toggle('split-right', isRight);

        if (isLeft || isRight) {
          tab.panel.classList.add('active');
          if (tab.iframe) tab.iframe.style.display = 'block';
        } else {
          tab.panel.classList.remove('active', 'split-left', 'split-right');
          if (tab.iframe) tab.iframe.style.display = 'none';
        }
      });
    } else {
      this.splitScreenActive = false; // Reset if tabs fell below 2
      area.classList.remove('split-mode');

      this.tabs.forEach(tab => {
        if (!tab.panel) return;
        const isActive = tab.id === this.activeTabId;
        tab.panel.classList.remove('split-left', 'split-right');
        tab.panel.classList.toggle('active', isActive);
        if (tab.iframe) tab.iframe.style.display = isActive ? 'block' : 'none';
      });
    }

    // Attempt to resize or trigger a window resize event so games adapt
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  },

  closeTab(tabId) {
    const tabIndex = this.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.tabs[tabIndex];
    const wasActive = this.activeTabId === tabId;
    const hadGroup = tab.groupId;

    tab.iconElement?.remove();
    tab.panel?.remove();
    this.tabs.splice(tabIndex, 1);

    if (this.tabs.length === 0) {
      this.splitScreenActive = false;
      this.activeTabId = null;
      this.lastActiveTabId = null;
      this.updateEmptyState();
      // Auto-close workspace when no tabs remain
      this.closeModal();
      return;
    }

    if (tabId === this.rightTabId) {
      this.rightTabId = null;
      this.splitScreenActive = false;
    }

    this.saveTabsToStorage();
    if (wasActive) {
      const newIndex = Math.min(tabIndex, this.tabs.length - 1);
      this.switchToTab(this.tabs[newIndex].id);
    } else {
      this.updateSplitScreenClasses();
    }

    // Update group count if tab was in a group
    if (hadGroup) {
      const groupEl = document.getElementById(hadGroup);
      const countBadge = groupEl?.querySelector('.tab-group-count');
      if (countBadge) countBadge.textContent = this.tabs.filter(t => t.groupId === hadGroup).length;
    }

    this.updateWorkspaceBadge();
    AudioEngine.click();
  },

  closeCurrentTab() {
    if (this.activeTabId) this.closeTab(this.activeTabId);
  },

  returnToHome() {
    this.closeModal();
    AudioEngine.click();
  },

  closeModal() {
    this.toggleSidePanelMobile(false);
    this.cancelConfirmation();
    UI.toggleModal('game-modal', false);
    const infoOverlay = document.getElementById('info-overlay');
    if (infoOverlay) {
      infoOverlay.classList.add('hidden');
      infoOverlay.classList.remove('flex');
    }
    if (this.activeTabId) this.lastActiveTabId = this.activeTabId;
    this.activeTabId = null;
    State.activeGame = null;
    history.pushState("", document.title, window.location.pathname + window.location.search);
    this.saveTabsToStorage();
  },

  confirmCloseAllTabs() {
    if (this.tabs.length === 0) return;
    const confirmModal = document.getElementById('confirm-modal');
    const countSpan = document.getElementById('confirm-count');
    if (!confirmModal) return;
    UI.rememberFocus('confirm-modal');
    if (countSpan) countSpan.textContent = this.tabs.length;
    confirmModal.classList.remove('hidden');
    confirmModal.classList.add('flex');
    confirmModal.setAttribute('aria-hidden', 'false');
    Utils.refreshIcons();
    requestAnimationFrame(() => confirmModal.querySelector('[data-action="confirmCancel"]')?.focus());
  },

  cancelConfirmation(restoreFocus = true) {
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal) {
      const wasVisible = !confirmModal.classList.contains('hidden');
      confirmModal.classList.add('hidden');
      confirmModal.classList.remove('flex');
      confirmModal.setAttribute('aria-hidden', 'true');
      if (wasVisible && restoreFocus) UI.restoreFocus('confirm-modal');
    }
  },

  closeAllTabsConfirmed() {
    this.cancelConfirmation(false);
    if (this.tabs.length === 0) return;

    const tabsToKeep = [];

    this.tabs.forEach(tab => {
      if (tab.pinned) {
        tabsToKeep.push(tab);
      } else {
        tab.iconElement?.remove();
        tab.panel?.remove();
      }
    });

    this.tabs = tabsToKeep;

    // If active tab was closed, switch to the last pinned one or null
    if (!this.tabs.find(t => t.id === this.activeTabId)) {
      this.activeTabId = this.tabs.length > 0 ? this.tabs[this.tabs.length - 1].id : null;
    }

    if (this.tabs.length === 0) {
      State.activeGame = null;
      Storage.remove(CONFIG.storageKeys.tabs);
      this.activeTabId = null;
      this.lastActiveTabId = null;
      this.updateEmptyState();
    } else {
      if (this.activeTabId) this.switchToTab(this.activeTabId);
      this.saveTabsToStorage();
      this.renderGroups();
      this.updateWorkspaceBadge();
    }

    AudioEngine.click();
  },

  reloadCurrentTab() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab?.iframe) return;
    tab.loading = true;
    tab.iconElement?.classList.add('loading');
    tab.iframe.contentWindow.location.reload();
    setTimeout(() => {
      tab.loading = false;
      tab.iconElement?.classList.remove('loading');
    }, 1000);
  },

  getCurrentTab() {
    return this.tabs.find(t => t.id === this.activeTabId);
  },

  showMaxTabsWarning() {
    const existingWarning = document.querySelector('.max-tabs-warning');
    if (existingWarning) existingWarning.remove();

    const warning = document.createElement('div');
    warning.className = 'max-tabs-warning';
    warning.innerHTML = `<i data-lucide="alert-triangle" class="w-5 h-5 inline mr-2"></i>Maximum ${CONFIG.maxTabs} tabs open. Close a tab to open another.`;
    document.body.appendChild(warning);
    Utils.refreshIcons();

    setTimeout(() => {
      warning.style.opacity = '0';
      warning.style.transform = 'translateX(-50%) translateY(-20px)';
      warning.style.transition = 'all 0.3s ease';
      setTimeout(() => warning.remove(), 300);
    }, 3000);
  },

  setupKeyboardShortcuts() {
    // Handled centrally by App.handleGlobalKeydown() to preserve modal/drawer Escape priority.
  },



  toggleSidePanelMobile(force = null) {
    const panel = document.getElementById('side-panel');
    const backdrop = document.getElementById('side-panel-backdrop');
    if (!panel) return;
    const shouldOpen = force === null ? !panel.classList.contains('open') : Boolean(force);
    if (force === null) AudioEngine.click();
    panel.classList.toggle('open', shouldOpen);
    if (backdrop) backdrop.classList.toggle('active', shouldOpen);
  },

  switchToNextTab(direction = 1) {
    if (this.tabs.length === 0) return;
    const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
    if (currentIndex === -1) {
      this.switchToTab(this.tabs[0].id);
      return;
    }
    let newIndex = currentIndex + direction;
    if (newIndex >= this.tabs.length) newIndex = 0;
    else if (newIndex < 0) newIndex = this.tabs.length - 1;
    this.switchToTab(this.tabs[newIndex].id);
    AudioEngine.click();
  }
};

