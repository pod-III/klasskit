/**
 * KlassKit Early Theme Initializer & Live Sync
 * Runs synchronously in <head> before first paint to prevent theme flash,
 * and keeps cross-tab & embedded iframes synchronized.
 */
(function (global) {
  var scriptEl = document.currentScript;
  var appKey = scriptEl ? scriptEl.getAttribute('data-theme-key') : null;

  function readStored(key) {
    if (!key) return null;
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return null;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return raw;
      }
    } catch (e) {
      return null;
    }
  }

  function applyMode(overrideDark) {
    var isDark;
    if (typeof overrideDark === 'boolean') {
      isDark = overrideDark;
    } else {
      var appTheme = readStored(appKey);
      var hubTheme = readStored('theme_hub');
      var resolved = appTheme || hubTheme;
      isDark = resolved === 'dark' || (
        resolved !== 'light' &&
        Boolean(global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    }
    document.documentElement.classList.toggle('dark', Boolean(isDark));
    return Boolean(isDark);
  }

  function applyColorTheme(overrideTheme) {
    var themeId = overrideTheme !== undefined ? overrideTheme : readStored('klasskit_colorTheme');
    if (themeId && themeId !== 'classic') {
      document.documentElement.setAttribute('data-theme', themeId);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    return themeId || 'classic';
  }

  applyMode();
  applyColorTheme();

  global.addEventListener('storage', function (e) {
    if (e.key === 'theme_hub' || (appKey && e.key === appKey)) {
      applyMode();
    } else if (e.key === 'klasskit_colorTheme') {
      applyColorTheme();
    }
  });

  global.addEventListener('message', function (e) {
    if (e.origin !== global.location.origin || !e.data || e.data.type !== 'klasskit:theme-sync') return;
    if (typeof e.data.dark === 'boolean') applyMode(e.data.dark);
    if (e.data.colorTheme !== undefined) applyColorTheme(e.data.colorTheme);
  });

  global.KlassKitTheme = {
    applyMode: applyMode,
    applyColorTheme: applyColorTheme
  };
})(window);
