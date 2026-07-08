import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
});

// Must agree with the boot script in public/index.html, which applies the same
// value before first paint so the app never flashes the wrong theme.
const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem('theme') || 'light';
};

// Keep the browser chrome (status bar, address bar) in step with the theme.
const THEME_COLOR = { light: '#ffffff', dark: '#0b0a1c' };

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[theme] || THEME_COLOR.light);
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
