import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const DEFAULT_THEME = 'dark';

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  toggleTheme: () => {},
});

// A stored theme outlives a change of default, so bumping the default alone
// would never reach existing users. Each time the default changes, bump this
// key: everyone is reset once, and their own choice wins from then on.
const THEME_KEY = 'theme';
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
const THEME_COLOR = { light: '#ffffff', dark: '#0b0a1c' };

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[theme] || THEME_COLOR[DEFAULT_THEME]);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme(current => (current === 'dark' ? 'light' : 'dark')),
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
