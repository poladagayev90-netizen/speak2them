import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { onWebUpdateReady } from './utils/appUpdate';
import './App.css';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

// A new version no longer reloads the page by itself — that could happen in
// the middle of a call. UpdateBanner offers it, and applies it when the app
// comes back to the screen with nothing running (utils/appUpdate.js).
serviceWorkerRegistration.register({
  onUpdate: () => onWebUpdateReady(),
});
