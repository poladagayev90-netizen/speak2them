import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const DEFAULT_THEME = 'dark';
const DEFAULT_PALETTE = 'violet';

// The accent combinations on offer. A palette only ever changes two hues — the
// accent (a real person) and the AI hue (AInur) — while every neutral stays
// put. That is deliberate: it means no choice a user makes can break contrast
// or make the app look like a different product. The values themselves live in
// src/index.css under [data-palette].
export const PALETTES = [
  { id: 'violet', label: 'Violet', note: 'SpeakLab’s own' },
  { id: 'ocean', label: 'Ocean', note: 'Cool and quiet' },
  { id: 'forest', label: 'Forest', note: 'Green and calm' },
  { id: 'mono', label: 'Mono', note: 'No colour at all' },
];
const PALETTE_IDS = PALETTES.map((p) => p.id);

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  palette: DEFAULT_PALETTE,
  toggleTheme: () => {},
  setPalette: () => {},
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

const getInitialPalette = () => {
  if (typeof window === 'undefined') return DEFAULT_PALETTE;
  const stored = window.localStorage.getItem(PALETTE_KEY);
  return PALETTE_IDS.includes(stored) ? stored : DEFAULT_PALETTE;
};

// Keep the browser chrome (status bar, address bar) in step with the theme.
// These are the --bg-primary values; a mismatch shows as a coloured seam above
// the app on Android.
const THEME_COLOR = { light: '#ffffff', dark: '#0a0a0b' };

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [palette, setPaletteState] = useState(getInitialPalette);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(THEME_KEY, theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[theme] || THEME_COLOR[DEFAULT_THEME]);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    window.localStorage.setItem(PALETTE_KEY, palette);
  }, [palette]);

  const value = useMemo(() => ({
    theme,
    palette,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    setPalette: (id) => setPaletteState(PALETTE_IDS.includes(id) ? id : DEFAULT_PALETTE),
  }), [theme, palette]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
