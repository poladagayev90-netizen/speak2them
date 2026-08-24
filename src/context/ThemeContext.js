import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const DEFAULT_THEME = 'dark';

// There used to be four selectable palettes here (violet / ocean / forest /
// mono). They are gone: the app has ONE hue family now — a deep purple for a
// real person, a lighter one for AInur — and three of those four palettes put
// a colour on screen the design does not contain. The stored 'palette' key is
// cleared once on boot so an old choice cannot leave a stale data-palette
// attribute on <html>.
const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  toggleTheme: () => {},
});

// A stored theme outlives a change of default, so bumping the default alone
// would never reach existing users. Each time the default changes, bump this
// key: everyone is reset once, and their own choice wins from then on.
const THEME_KEY = 'theme';
const PALETTE_KEY = 'palette';
const DEFAULT_MIGRATION_KEY = 'themeDefault:dark';

// Must agree with the boot script in public/index.html, which runs this same
// logic before first paint so the app never flashes the wrong theme.
const getInitialTheme = () => {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const ls = window.localStorage;
  if (!ls.getItem(DEFAULT_MIGRATION_KEY)) {
    ls.setItem(DEFAULT_MIGRATION_KEY, '1');
    ls.setItem(THEME_KEY, DEFAULT_THEME);
    return DEFAULT_THEME;
  }
  return ls.getItem(THEME_KEY) || DEFAULT_THEME;
};

// Keep the browser chrome (status bar, address bar) in step with the theme.
// These are the --bg-primary values; a mismatch shows as a coloured seam above
// the app on Android.
const THEME_COLOR = { light: '#f5f4f9', dark: '#171331' };

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(THEME_KEY, theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[theme] || THEME_COLOR[DEFAULT_THEME]);
  }, [theme]);

  // One-off cleanup for anyone who picked a palette while the switcher existed:
  // the attribute no longer has any CSS behind it, but leaving it on <html>
  // would keep the dead key alive in localStorage forever.
  useEffect(() => {
    document.documentElement.removeAttribute('data-palette');
    window.localStorage.removeItem(PALETTE_KEY);
  }, []);

  const value = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
