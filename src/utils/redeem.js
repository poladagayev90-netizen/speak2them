import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';

export const SUPPORT_WHATSAPP = 'https://wa.me/994513549195';

// Server (redeemCode) xəta kodu → istifadəçiyə göstərilən mətn. Server nə
// qaytarırsa ona görə fərqli mesaj: "tapılmadı" ≠ "dolub".
export const REDEEM_ERROR_TEXT = {
  invalid_code: 'That code format is not valid. Check it and try again.',
  code_not_found: 'That code was not found. Check the spelling and enter it exactly.',
  code_inactive: 'That code is no longer active. Contact us for a new one.',
  code_exhausted: 'This group is full. Contact us and we will add you to the next intake.',
  already_applied_elsewhere: 'You have already applied to another cohort. Cancel that one first, or contact an admin.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
};

// redeemCode-u çağırıb nəticəni UI-ya hazır formada qaytarır. Redeem səhifəsi
// və trial-bitmə ekranı eyni məntiqi paylaşır.
export async function redeemCourseCode(code) {
  try {
    const res = await authedFetch(`${FUNCTIONS_BASE}/redeemCode`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.error,
        errorText: REDEEM_ERROR_TEXT[data.error] || 'Something went wrong. Please try again.',
        showSupport: data.error === 'code_exhausted' || data.error === 'code_inactive',
      };
    }
    return { ok: true, data };
  } catch (e) {
    console.error('[redeemCourseCode]', e);
    return {
      ok: false,
      errorText: 'Network error. Check your connection and try again.',
      showSupport: false,
    };
  }
}
