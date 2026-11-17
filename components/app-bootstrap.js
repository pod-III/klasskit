/**
 * KlassKit Shared App Bootstrap
 * Centralizes Soft Brutalism Tailwind theme tokens, light/dark sync,
 * auth guard invocation, and Lucide icon hydration for activity modules.
 */
(function (global) {
  'use strict';

  const BRAND_COLORS = {
    pink: '#ff4785',
    orange: '#ff7e33',
    green: '#00d063',
    blue: '#1ea7fd',
    dark: '#1e293b',
    chalk: '#f8fafc',
  };

  function readStoredTheme(key) {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return null;
      try { return JSON.parse(raw); } catch (_) { return raw; }
    } catch (_) {
      return null;
    }
  }

  function resolveIsDark(toolKey) {
    const toolTheme = readStoredTheme(toolKey) || readStoredTheme('klasskit-theme');
    const hubTheme = readStoredTheme('theme_hub');
    if (toolTheme) return toolTheme === 'dark';
    if (hubTheme) return hubTheme === 'dark';
    return Boolean(global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function applyTheme(toolKey) {
    const isDark = resolveIsDark(toolKey);
    document.documentElement.classList.toggle('dark', isDark);
    return isDark;
  }

  function syncTheme(toolKey, onChange) {
    const isDark = applyTheme(toolKey);
    if (typeof onChange === 'function') onChange(isDark);

    global.addEventListener('storage', (e) => {
      if (e.key === 'theme_hub' || (toolKey && e.key === toolKey) || e.key === 'klasskit-theme') {
        const nextDark = applyTheme(toolKey);
        if (typeof onChange === 'function') onChange(nextDark);
      }
    });

    return isDark;
  }

  function configureTailwind(overrides = {}) {
    if (!global.tailwind) return;

    const customColors = overrides.colors || {};
    const customShadows = overrides.boxShadow || {};
    const customFonts = overrides.fontFamily || {};

    global.tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            ...BRAND_COLORS,
            brand: { ...BRAND_COLORS },
            ...customColors,
          },
          fontFamily: {
            heading: ['Fredoka', 'sans-serif'],
            body: ['Nunito', 'sans-serif'],
            ...customFonts,
          },
          boxShadow: {
            'hard-sm': 'var(--shadow-hard-sm)',
            'hard': 'var(--shadow-md)',
            'hard-md': 'var(--shadow-hard-md)',
            'hard-lg': 'var(--shadow-lg)',
            'neo-sm': 'var(--shadow-hard-sm)',
            'neo': 'var(--shadow-hard-md)',
            'neo-lg': 'var(--shadow-lg)',
            ...customShadows,
          },
          ...(overrides.extend || {}),
        },
      },
    };
  }

  async function ensureAuth() {
    if (typeof global.requireAuth === 'function') {
      return global.requireAuth();
    }
    return null;
  }

  function refreshIcons() {
    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      global.lucide.createIcons();
    }
  }

  global.KlassKitBootstrap = {
    BRAND_COLORS,
    readStoredTheme,
    resolveIsDark,
    applyTheme,
    syncTheme,
    configureTailwind,
    ensureAuth,
    refreshIcons,
  };
})(window);
