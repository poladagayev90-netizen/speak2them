import React from 'react';

// Təsdiqlənmiş müəllim nişanı. YEGANƏ şərti `user.teacherVerified` sahəsidir —
// `role === 'teacher'` DEYİL: rol qeydiyyatda istifadəçinin öz seçimidir
// (firestore.rules bir dəfəlik yazmağa icazə verir), ona görə ona bağlı nişanı
// hər kəs beş saniyəyə alardı. teacherVerified yalnız serverdən (admin təsdiqi)
// yazılır və rules ilə clientə bağlıdır.
//
// Ölçülər PremiumBadge ilə BİRƏ-BİR eynidir: bir sətirdə ikisi yan-yana düşəndə
// (premium müəllim) mətn sıçramasın. Fərq yalnız rəngdədir — ikisi də bənövşəyi
// ailədəndir, Tutor bir ton açıqdır.
export default function TutorBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      background: 'var(--ai-fill)',
      color: 'var(--text-on-ai)',
      fontSize: '10px',
      fontWeight: 700,
      padding: '2px 7px',
      borderRadius: '20px',
      marginLeft: '6px',
      whiteSpace: 'nowrap',
    }}>
      🎓 Tutor
    </span>
  );
}
