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
