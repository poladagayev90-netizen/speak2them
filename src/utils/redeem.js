import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';

export const SUPPORT_WHATSAPP = 'https://wa.me/994513549195';

// Server (redeemCode) xəta kodu → istifadəçiyə göstərilən mətn. Server nə
// qaytarırsa ona görə fərqli mesaj: "tapılmadı" ≠ "dolub".
export const REDEEM_ERROR_TEXT = {
  invalid_code: 'Kod formatı yanlışdır — hərfləri yoxlayıb yenidən yazın.',
  code_not_found: 'Bu kod tapılmadı. Hərf səhvi ola bilər — kodu olduğu kimi yazın.',
  code_inactive: 'Bu kod artıq aktiv deyil. Yeni kod üçün bizə yazın.',
  code_exhausted: 'Bu qrup dolub. Bizə yazın — sizi növbəti dalğaya əlavə edək.',
  already_applied_elsewhere: 'Siz artıq başqa kohorta müraciət etmisiniz. Əvvəlcə onu ləğv edin və ya adminlə əlaqə saxlayın.',
  rate_limited: 'Çox cəhd etdiniz. Bir az gözləyib yenidən yoxlayın.',
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
        errorText: REDEEM_ERROR_TEXT[data.error] || 'Xəta baş verdi. Yenidən cəhd edin.',
        showSupport: data.error === 'code_exhausted' || data.error === 'code_inactive',
      };
    }
    return { ok: true, data };
  } catch (e) {
    console.error('[redeemCourseCode]', e);
    return {
      ok: false,
      errorText: 'Şəbəkə xətası. İnternetinizi yoxlayıb yenidən cəhd edin.',
      showSupport: false,
    };
  }
}
