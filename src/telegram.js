export const tg = window.Telegram?.WebApp || {};
export const tgUser = tg?.initDataUnsafe?.user;

// A reliable way to detect if we are actually running inside a Telegram Web App (Mini App)
// is to check if initData is populated or if the platform is not 'unknown'
export const isTelegramWebApp = Boolean(tg?.initData || (tg?.platform && tg?.platform !== 'unknown'));