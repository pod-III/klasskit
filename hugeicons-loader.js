(function() {
  'use strict';

  if (!window.customElements || !window.customElements.get('iconify-icon')) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/iconify-icon@2.2.0/dist/iconify-icon.min.js';
    s.async = true;
    document.head.appendChild(s);
  }

  const map = {
    'activity':'activity-01','alert-circle':'alert-circle','alert-triangle':'alert-01',
    'align-left':'text-align-left-01','arrow-left':'arrow-left-01','arrow-right':'arrow-right-01',
    'arrow-up':'arrow-up-01','arrow-down':'arrow-down-01','atom':'atom-01',
    'bar-chart':'bar-chart-01','bar-chart-2':'bar-chart-01','bar-chart-3':'bar-chart-02',
    'bell':'notification-01','bell-ring':'notification-03','book':'book-01','book-open':'book-open-01',
    'brain':'brain-01','brain-circuit':'brain-01','briefcase':'briefcase-01','brush':'brush-01',
    'bug':'bug-01','calendar':'calendar-01','calendar-check':'calendar-check-01',
    'calendar-days':'calendar-03','check':'tick-01','check-check':'tick-double-01',
    'check-circle':'checkmark-circle-01','check-square':'checkmark-square-01',
    'chevron-down':'arrow-down-02','chevron-left':'arrow-left-02','chevron-right':'arrow-right-02',
    'chevron-up':'arrow-up-02','clipboard-check':'task-check-01','cloud':'cloud-01',
    'code':'code-01','columns':'columns-01','columns-4':'columns-01','construction':'construction-01',
    'database':'database-01','download':'download-01','eye':'view','eye-off':'view-off',
    'file':'file-01','file-check':'file-check-01','file-check-2':'file-check-01',
    'file-question':'file-question-01','file-search':'file-search-01','file-text':'file-01',
    'folder':'folder-01','folder-kanban':'folder-01','folder-open':'folder-open-01',
    'gamepad':'game-controller-01','gamepad-2':'game-controller-01','glasses':'glasses-01',
    'graduation-cap':'graduation-cap-01','grid-2x2':'grid-01','grid-3x3':'grid-01',
    'hammer':'hammer-01','hard-drive':'hard-drive-01','heart':'heart','history':'history-01',
    'home':'home-01','image':'image-01','inbox':'inbox-01','info':'information-circle-01',
    'keyboard':'keyboard-01','layers':'layers-01','layout':'layout-01','layout-dashboard':'dashboard-01',
    'layout-grid':'grid-01','layout-list':'list-view','layout-template':'template-01','library':'library-01',
    'lightbulb':'lightbulb-01','link':'link-01','list':'list-view','loader':'loading-01',
    'loader-2':'loading-02','lock':'lock','lock-keyhole':'lock','log-out':'logout-01','mail':'mail-01',
    'mail-open':'mail-open-01','map':'map-01','maximize':'maximize-01','maximize-2':'maximize-01',
    'megaphone':'megaphone-01','menu':'menu-01','message-square':'message-01',
    'message-square-text':'message-text-01','mic':'microphone-01','minimize':'minimize-01',
    'minimize-2':'minimize-01','minus':'minus-01','monitor':'monitor-01','monitor-play':'monitor-01',
    'moon':'moon-01','more-horizontal':'more-horizontal','more-vertical':'more-vertical',
    'notebook-pen':'notebook-01','package':'package-01','pen-tool':'pen-tool-01','pencil':'pencil-01',
    'pin':'pin-01','pin-off':'pin-off-01','play':'play-01','plus':'add-01','puzzle':'puzzle-01',
    'refresh-cw':'refresh-01','rotate-cw':'reload-01','route':'route-01','save':'save-01',
    'scan-eye':'scan-01','scroll-text':'scroll-01','search':'search-01','send':'send-01',
    'settings':'settings-01','settings-2':'settings-02','shield':'shield-01',
    'shield-check':'shield-check-01','shuffle':'shuffle-01','sliders':'slider-01',
    'smartphone':'smartphone-01','sparkles':'sparkle-01','spell-check':'text-check-01',
    'star':'star','stethoscope':'stethoscope-01','sun':'sun-01','syringe':'syringe-01',
    'table':'table-01','tablet':'tablet-01','tag':'tag-01','target':'target-01',
    'terminal':'terminal-01','thermometer':'thermometer-01','timer':'timer-01','trash':'delete-01',
    'trash-2':'delete-01','trophy':'trophy-01','tv':'tv-01','undo':'undo-01','unlink':'unlink-01',
    'upload':'upload-01','user':'user-02','user-check':'user-check-01','user-minus':'user-minus-01',
    'user-pen':'user-edit-01','user-plus':'user-add-01','user-round':'user-circle','user-x':'user-remove-01',
    'users':'user-multiple','view':'view','view-off':'view-off','volume-2':'volume-high',
    'volume-x':'volume-mute-01','wallet':'wallet-01','wand':'magic-wand-01','wifi':'wifi-01',
    'wifi-off':'wifi-off-01','wrench':'wrench-01','x':'cancel-01','zap':'zap-01',
    'book-a':'book-01','clipboard-list':'clipboard-list-01','clock':'clock-01',
    'columns-2':'columns-01','dices':'dice-01','edit-3':'pencil-edit-01',
    'film':'video-01','ghost':'ghost-01','grid':'grid-01','help-circle':'help-circle',
    'image':'image-01','languages':'translate','library':'library-01',
    'lock-keyhole':'lock','message-square-text':'message-text-01',
    'monitor':'monitor-01','move-horizontal':'move-horizontal-01',
    'music':'music-note-01','pie-chart':'pie-chart-01','shapes':'shapes-01',
    'smile':'emoji-01'
  };

  function createHugeicons(opts) {
    let els;
    if (opts && opts.nodes) {
      els = opts.nodes.length !== undefined ? opts.nodes : [opts.nodes];
    } else {
      els = document.querySelectorAll('[data-lucide],[data-hugeicons]');
    }
    els.forEach(function(el) {
      if (el.tagName.toLowerCase() === 'iconify-icon') return;
      var name = el.getAttribute('data-lucide') || el.getAttribute('data-hugeicons');
      if (!name) return;
      var mapped = map[name] || name;
      var icon = document.createElement('iconify-icon');
      icon.setAttribute('icon', 'hugeicons:' + mapped);
      icon.className = el.className;
      if (el.id) icon.id = el.id;
      if (el.style.cssText) icon.style.cssText = el.style.cssText;
      el.replaceWith(icon);
    });
  }

  window.hugeiconsMap = map;
  window.createHugeicons = createHugeicons;
  window.lucide = { createIcons: createHugeicons };
  window.updateHugeicon = function(el, name) {
    var mapped = map[name] || name;
    if (el.tagName.toLowerCase() === 'iconify-icon') {
      el.setAttribute('icon', 'hugeicons:' + mapped);
    } else {
      el.setAttribute('data-lucide', name);
      createHugeicons({ nodes: [el] });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createHugeicons);
  } else {
    createHugeicons();
  }
})();
