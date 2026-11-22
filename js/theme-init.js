/**
 * KlassKit Early Theme Initializer
 * Runs synchronously in <head> before first paint to prevent theme flash.
 */
(function () {
  try {
    var rawMode = localStorage.getItem('theme_hub');
    var mode = rawMode;
    try {
      mode = rawMode ? JSON.parse(rawMode) : null;
    } catch (e) {}

    if (mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }

    var rawColor = localStorage.getItem('klasskit_colorTheme');
    var colorTheme = rawColor;
    try {
      colorTheme = rawColor ? JSON.parse(rawColor) : null;
    } catch (e) {}

    if (colorTheme && colorTheme !== 'classic') {
      document.documentElement.setAttribute('data-theme', colorTheme);
    }
  } catch (e) {}
})();
