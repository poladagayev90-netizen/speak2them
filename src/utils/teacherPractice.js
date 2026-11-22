// «Not ready? Practise with a teacher — free» — the Today card that took the
// AInur warm-up card's place (Polad 2026-11-22: «AInur ilə isinməni
// askıya al, tətbiqə girəndə görsənməsin, müəllimlə praktika et ilə
// dəyişdirilsin»). The warm-up itself is kept: the flag is
// TODAY_WARMUP_CARD in utils/warmupCall.js, and the AInur tab still offers it.
//
// Same audience the warm-up card had: a learner before their first real call
// who has not put the offer aside. Not for teachers, not for a learner who
// already has a teacher (`users.teacherId`, individual lessons — they have
// one). «Not now» reuses `users.warmupDismissedAt` (dismissWarmup): it is one
// «before your first partner» offer, put aside once. The admin always sees it,
// to test.
//
// The contact path is the existing one: the team's WhatsApp (constants.js
// whatsappLink), as on /intro. Polad is the only host (docs/domain/planner.md
// «newcomerHosts»), and the time is arranged there by hand. No price, no
// package — the card never mentions money beyond «free».
export function teacherCardVisible(user, { admin = false } = {}) {
  if (!user) return false;
  if (user.warmupDismissedAt) return false;
  if (admin) return true;
  if (user.role === 'teacher') return false;
  if (user.teacherId) return false;
  if (Number(user.callCount) > 0) return false;
  return true;
}

// The first WhatsApp line, prefilled. Team-facing, so in Azerbaijani like
// introWhatsAppText (utils/intro.js).
export const teacherPracticeText = (user) => `Salam! Mən ${user?.name || 'SpeakLab istifadəçisiyəm'}`
  + `${user?.level ? ` (${user.level})` : ''}. Müəllimlə pulsuz praktika etmək istəyirəm.`;
