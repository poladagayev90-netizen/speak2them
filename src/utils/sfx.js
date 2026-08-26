import { isInCall } from './presence';

// Kiçik səs effektləri — FAYL YOXDUR, hamısı Web Audio ilə sintez olunur.
// Səbəb: mp3/wav bundle-a yüklənir və şəbəkədən çəkilir; bir neçə millisaniyəlik
// "tıq" səsi üçün bu, mənasız yükdür. Osilator ilə eyni nəticə sıfır bayta alınır.
export const SFX_KEY = 'speaklab_sfx';

export const sfxEnabled = () => {
  try { return localStorage.getItem(SFX_KEY) !== '0'; } catch { return true; }
};
export const setSfxEnabled = (on) => {
  try { localStorage.setItem(SFX_KEY, on ? '1' : '0'); } catch { /* private mode */ }
};

let ctx = null;
let unlockBound = false;

// Brauzer istifadəçi toxunuşuna qədər səsi bloklayır. Kontekst ilk toxunuşda
// bərpa olunur; toxunuş olmayıbsa səs sadəcə buraxılır (xəta atılmır).
function audio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (!unlockBound) {
    unlockBound = true;
    const resume = () => { ctx && ctx.resume && ctx.resume().catch(() => {}); };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }
  return ctx.state === 'running' ? ctx : null;
}

// ZƏNG ZAMANI SƏS YOXDUR. Tətbiqin bütün mənası səsli danışıqdır — personajın
// addım səsi partnyorun eşitdiyi yazıya da düşərdi.
function blocked() {
  return !sfxEnabled() || isInCall();
}

function tone({ from, to, ms, gain, type = 'sine' }) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const vol = ac.createGain();
  const t = ac.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
  // Ani başlanğıc/bitiş "klik" verir — qısa fade ilə yumşaldılır.
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  vol.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(vol).connect(ac.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

// Addım — alçaq və çox qısa; təkrarlandığı üçün ən sakit səsdir.
export function sfxStep() {
  if (blocked()) return;
  tone({ from: 150, to: 90, ms: 60, gain: 0.018, type: 'triangle' });
}

// Peyda olma — yuxarı qalxan qısa "pop".
export function sfxPop() {
  if (blocked()) return;
  tone({ from: 320, to: 720, ms: 130, gain: 0.05 });
}

// Danışma — iki notlu şən "blip".
export function sfxBlip() {
  if (blocked()) return;
  tone({ from: 660, to: 660, ms: 80, gain: 0.04, type: 'square' });
  setTimeout(() => tone({ from: 920, to: 920, ms: 90, gain: 0.035, type: 'square' }), 95);
}

// Toxunuş reaksiyası — aşağı-yuxarı əyilən "boing". Tullanma ilə eyni vaxtda
// getdiyi üçün qısa və kəskindir.
export function sfxBoing() {
  if (blocked()) return;
  tone({ from: 220, to: 620, ms: 110, gain: 0.055, type: 'triangle' });
  setTimeout(() => tone({ from: 620, to: 300, ms: 130, gain: 0.04, type: 'triangle' }), 100);
}

// Gülüş — üç sürətli qalxan not. Təkrar toxunuşlarda işlədilir.
export function sfxGiggle() {
  if (blocked()) return;
  [0, 90, 180].forEach((delay, i) => {
    setTimeout(() => tone({
      from: 700 + i * 160, to: 780 + i * 160, ms: 70, gain: 0.032, type: 'square',
    }), delay);
  });
}

// Küncdən boylanma — yumşaq, qısa "swoosh" əvəzi alçaq not.
export function sfxPeek() {
  if (blocked()) return;
  tone({ from: 420, to: 560, ms: 150, gain: 0.03, type: 'sine' });
}

// ── Zəng-içi oyun səsləri ────────────────────────────────────────────────────
// Yuxarıdakı blanket "zəngdə səs yoxdur" qaydası MASKOT üçündür: fasiləsiz
// gedən addım/gülüş döngəsi həm partnyorun eşitdiyinə, həm də analizin oxuduğu
// yazıya düşürdü. Zəng-İÇİ OYUN bunun qəsdən qoyulmuş yeganə istisnasıdır —
// "kilidləndi" tıqqıltısı və qalibiyyət akkordu olmadan oyun oyun kimi
// hiss olunmur, halbuki onu zəngin içinə qoymağın bütün mənası budur.
//
// İstisna DAR saxlanılır və mikrofona sızma riski buna görə əhəmiyyətsizdir:
//   - hər səs 200 ms-dən qısadır, DÖNGƏ YOXDUR (maskotdan fərq budur);
//   - gain maskot səslərinin üçdə biridir (0.012–0.05 deyil, 0.010–0.030);
//   - hamısı 300–1200 Hz aralığındadır, yəni Whisper üçün söz deyil, klikdir;
//   - Agora-nın exec-ləşdirdiyi AEC qısa blipləri onsuz da kəsir.
// Panelin öz susdurma düyməsi var və qlobal `sfxEnabled` hələ də hökmdür.
const gameBlocked = () => !sfxEnabled();

// Oyun açıldı — iki qalxan not, "başlayırıq".
export function sfxGameOpen() {
  if (gameBlocked()) return;
  tone({ from: 420, to: 560, ms: 90, gain: 0.028, type: 'triangle' });
  setTimeout(() => tone({ from: 620, to: 830, ms: 120, gain: 0.026, type: 'triangle' }), 95);
}

// Öz cavabını kilidlədin — alçaq, qəti "thunk". Toxunuşun özü ilə eyni anda
// getdiyi üçün ən qısa səsdir.
export function sfxLockIn() {
  if (gameBlocked()) return;
  tone({ from: 300, to: 150, ms: 90, gain: 0.030, type: 'triangle' });
}

// Partnyor kilidlədi — daha yumşaq və daha yüksək, yəni "sən deyilsən".
export function sfxPeerLock() {
  if (gameBlocked()) return;
  tone({ from: 520, to: 660, ms: 80, gain: 0.018, type: 'sine' });
}

// Son saniyələr — çox sakit tıqqıltı. Saniyədə bir dəfə, cəmi 5 dəfə: daha
// uzun getsə söhbətin üstünə minər.
export function sfxTick() {
  if (gameBlocked()) return;
  tone({ from: 900, to: 900, ms: 35, gain: 0.012, type: 'square' });
}

// Cavab açılır — aşağı-yuxarı qısa "ta-daa" girişi.
export function sfxReveal() {
  if (gameBlocked()) return;
  tone({ from: 700, to: 400, ms: 110, gain: 0.024, type: 'sine' });
  setTimeout(() => tone({ from: 520, to: 780, ms: 160, gain: 0.026, type: 'sine' }), 110);
}

// Sən qazandın — üç qalxan not (major triada).
export function sfxWin() {
  if (gameBlocked()) return;
  [523, 659, 784].forEach((f, i) => {
    setTimeout(() => tone({ from: f, to: f, ms: 130, gain: 0.026, type: 'triangle' }), i * 85);
  });
}

// Uduzdun — iki yumşaq enən not. QƏSDƏN zumbur deyil: partnyorunla dost
// oyunudur, cəza səsi masanı soyudur.
export function sfxLose() {
  if (gameBlocked()) return;
  tone({ from: 440, to: 440, ms: 120, gain: 0.020, type: 'sine' });
  setTimeout(() => tone({ from: 350, to: 330, ms: 170, gain: 0.018, type: 'sine' }), 120);
}

// Növbəti sual — yüngül qalxan "swoosh".
export function sfxNextCard() {
  if (gameBlocked()) return;
  tone({ from: 380, to: 640, ms: 120, gain: 0.020, type: 'sine' });
}
