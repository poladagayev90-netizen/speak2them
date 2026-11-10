// A teacher's student code, made from their name (Polad 2026-11-10: opening
// /teacher asked "Welcome, teacher — create a code" before anything else; now
// the code is made for them, e.g. POLAD2005, and can be changed later under
// Invite & profile). Pure, so it is tested; uniqueness is the server's job
// (createInviteCode answers `code-taken`, and the caller tries another number).

// Azerbaijani / Turkish / Russian letters a name may carry → the A–Z the
// server accepts (/^[A-Z0-9]{4,12}$/). Anything else is dropped.
const MAP = {
  Ə: 'E', ə: 'E', Ş: 'S', ş: 'S', Ç: 'C', ç: 'C', Ğ: 'G', ğ: 'G', I: 'I', ı: 'I',
  İ: 'I', i: 'I', Ö: 'O', ö: 'O', Ü: 'U', ü: 'U',
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'E', Ж: 'ZH', З: 'Z', И: 'I',
  Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T',
  У: 'U', Ф: 'F', Х: 'KH', Ц: 'TS', Ч: 'CH', Ш: 'SH', Щ: 'SH', Ы: 'Y', Э: 'E',
  Ю: 'YU', Я: 'YA',
};

export const CODE_NAME_MAX = 8;

// The first word of the name, transliterated, up to 8 letters; "TEACHER"
// when nothing usable is left (an emoji name, an empty profile).
export function codeStem(name) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const out = [...first].map((ch) => {
    if (MAP[ch]) return MAP[ch];
    const up = ch.toUpperCase();
    if (MAP[up]) return MAP[up];
    return /[A-Z0-9]/.test(up) ? up : '';
  }).join('').slice(0, CODE_NAME_MAX);
  return out.length >= 2 ? out : 'TEACHER';
}

// stem + four digits, always 6–12 characters. `rand` is injectable for tests.
export function suggestTeacherCode(name, rand = Math.random) {
  const n = 1000 + Math.floor(rand() * 9000);
  return `${codeStem(name)}${n}`;
}
