export const tg = window.Telegram?.WebApp || {};
export const tgUser = tg?.initDataUnsafe?.user;

// Check URL parameters to definitively know if we are in Telegram Web App,
// since the script is now conditionally loaded.
export const isTelegramWebApp = 
  window.location.hash.includes('tgWebAppData') || 
  window.location.search.includes('tgWebAppData') ||
  Boolean(tg?.initData || (tg?.platform && tg?.platform !== 'unknown'));