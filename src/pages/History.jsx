import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';import { Clock, ChevronLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import GuidedTour from '../components/GuidedTour';
import AnalysisHomework from '../components/AnalysisHomework';
import { getFeedbackLanguage } from '../utils/feedbackLanguage';
import { toAnalysisView, analysisErrorMessage } from '../utils/analysisView';
import '../styles/analysisReport.css';

const PROFILE_TOUR_STEPS = [
  {
    target: '#tour-analyze',
    title: 'Analyze Data',
    content: 'After a call you can review your grammar, word choice and overall score here.',
    disableBeacon: true,
  }
];

export default function History({ user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      const base = [collection(db, 'callAnalysis'), where('userId', '==', user.uid)];
      const run = async (ordered) => getDocs(
        ordered
          ? query(...base, orderBy('timestamp', 'desc'), limit(50))
          : query(...base, limit(50))
      );
      try {
        let snap;
        try {
          snap = await run(true);
        } catch (e) {
          // The composite index (userId, timestamp desc) may not exist yet —
          // fall back to an unordered read; the local sort below covers it.
          if (e.code !== 'failed-precondition') throw e;
          console.warn('[History] composite index missing, falling back');
          snap = await run(false);
        }
        const results = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          // Tickets still in the queue carry no analysis yet. Failed ones stay:
          // hiding them left the user waiting for a result that never arrives.
          .filter(d => d.status !== 'queued' && d.status !== 'processing');
        results.sort((a, b) => {
          const tA = a.timestamp?.seconds || 0;
          const tB = b.timestamp?.seconds || 0;
          return tB - tA;
        });
        setHistory(results);

        // Home-dakı "analiziniz hazırdır" kartı bu açara baxır — səhifəyə
        // girmək ən yenisini "görülmüş" sayır, kart özbaşına qayıtmır.
        const newestDone = results.find(d => d.status === 'done');
        if (newestDone?.timestamp?.seconds) {
          localStorage.setItem(`analysisSeen_v1_${user.uid}`, String(newestDone.timestamp.seconds * 1000));
        }
      } catch (e) {
        console.error('Error fetching history:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user]);

  // A CSS variable cannot take an "22" alpha suffix the way a hex literal can,
  // so the score badge uses the paired bg/fg tokens instead of tinting one colour.
  const scoreTone = (s) => (s >= 80 ? 'success' : s >= 60 ? 'warning' : 'danger');

  if (selectedAnalysis) {
    return <AnalysisDetail analysis={selectedAnalysis} onClose={() => setSelectedAnalysis(null)} lang={getFeedbackLanguage()} />;
  }

  return (
    <div className="history-page" style={{ padding: '20px 16px', paddingBottom: '100px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={24} />
        </button>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0 16px' }}>{'Analysis history'}</h2>
      </div>

      <GuidedTour user={user} steps={PROFILE_TOUR_STEPS} tourKey="tourDone_profile" />

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>{'Loading...'}</div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📊</div>
          <p style={{ color: 'var(--text-secondary)' }}>{'No analyses yet.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {history.map((call, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedAnalysis(call)}
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: '16px',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
                  {call.peerName || 'Anonim'}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} />
                  {call.durationSeconds ? `${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s` : 'Unknown'}
                  {call.timestamp && ` • ${new Date(call.timestamp.seconds * 1000).toLocaleDateString()}`}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                {call.overallScore ? (
                  <div style={{
                    background: `var(--${scoreTone(call.overallScore)}-bg)`,
                    color: `var(--${scoreTone(call.overallScore)}-fg)`,
                    padding: '8px 12px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '18px'
                  }}>
                    {call.overallScore}
                  </div>
                ) : call.error ? (
                  <div style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 700 }}>{'Error'}</div>
                ) : null}
                <button
                  id={idx === 0 ? "tour-analyze" : undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedAnalysis(call);
                  }}
                  style={{
                    border: '1px solid var(--accent)',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    borderRadius: '10px',
                    padding: '7px 10px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {'View analysis'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ANALİZ HESABATI — çap olunmuş sənəd görünüşü
// ═══════════════════════════════════════════════════════════════════
// Bu ekran qəsdən tətbiqin qalanına bənzəmir: ağ kağız, serif başlıqlar,
// nömrələnmiş bölmələr, cədvəllər. Səbəb — müəllim bunu valideynə göstərir
// və çap edir; "tətbiq ekranı" deyil, RƏSMİ HESABAT təsiri dəyəri satır.
// Şagird və müəllim EYNİ komponenti görür (TeacherStudent bunu import edir).
export function AnalysisDetail({ analysis, onClose, lang }) {
  // The report body is written in the learner's own language, so its section
  // labels follow that language -- not the (English) interface.
  const isTr = (lang || getFeedbackLanguage()) === 'tr';

  if (analysis.error) return (
    <div className="analysis-doc">
      <div className="analysis-doc-header">
        <button className="analysis-doc-back" onClick={onClose} aria-label={'Back'}>
          <ChevronLeft size={22} />
        </button>
        <div className="analysis-doc-title">{'Analysis'}</div>
      </div>
      <div className="analysis-doc-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>❌</div>
        <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{'Analysis failed'}</p>
        <p className="doc-note">{analysisErrorMessage(analysis.error)}</p>
      </div>
    </div>
  );

  const view = toAnalysisView(analysis);
  const scoreColor = (s) => (s >= 80 ? '#10B981' : s >= 60 ? '#E65100' : '#EF4444');

  // Chrome az-AZ tarixi "2026 M07 25" kimi verir (ICU boşluğu) — ay adları
  // əl ilə yazılır ki, sənədin başlığı hər cihazda düzgün görünsün.
  const MONTHS = {
    az: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'],
    tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  };
  const dateLabel = (() => {
    if (!analysis.timestamp?.seconds) return '';
    const d = new Date(analysis.timestamp.seconds * 1000);
    const names = isTr ? MONTHS.tr : MONTHS.az;
    return `${d.getDate()} ${names[d.getMonth()]} ${d.getFullYear()}`;
  })();

  // Bölmələr avtomatik nömrələnir — hansı blokların görünəcəyi analizin
  // məzmunundan asılıdır, ona görə nömrə sabit yazıla bilməz.
  let sectionNo = 0;
  const section = (label) => {
    sectionNo += 1;
    return <div className="analysis-doc-section">{sectionNo}. {label}</div>;
  };

  // Markdown → sənəd tipoqrafiyası. Ölçülər CSS-dədir (analysisReport.css),
  // burada yalnız element eşlənməsi var.
  const mdComponents = {
    h1: ({ children }) => <h2>{children}</h2>,
    h2: ({ children }) => <h2>{children}</h2>,
    h3: ({ children }) => <h3>{children}</h3>,
    p: ({ children }) => <p>{children}</p>,
    ul: ({ children }) => <ul>{children}</ul>,
    ol: ({ children }) => <ul>{children}</ul>,
    li: ({ children }) => <li>{children}</li>,
    strong: ({ children }) => <strong>{children}</strong>,
    em: ({ children }) => <em>{children}</em>,
    a: ({ children }) => <span>{children}</span>,
  };

  const scoreTiles = [
    { label: 'Overall score', value: view.overallScore },
    { label: 'Fluency', value: view.scores.fluency },
    { label: 'Grammar', value: view.scores.grammar },
    { label: 'Vocabulary', value: view.scores.vocabulary },
  ].filter((x) => Number.isFinite(x.value));

  // Bölmə başlıqları sənəd üslubunda BÖYÜK HƏRFLƏ və dilə uyğun.
  const SEC = {
    summary: isTr ? 'GENEL DEĞERLENDİRME' : 'ÜMUMİ DƏYƏRLƏNDİRMƏ',
    scores: isTr ? 'PUANLAR' : 'BALLAR',
    mistakes: isTr ? 'DÜZELTMELER' : 'DÜZƏLİŞLƏR',
    strengths: isTr ? 'GÜÇLÜ YÖNLER' : 'GÜCLÜ TƏRƏFLƏR',
    tips: isTr ? 'ÖNERİLER' : 'TÖVSİYƏLƏR',
    vocab: isTr ? 'KELİME HAZİNESİ' : 'LÜĞƏT',
    homework: isTr ? 'ALIŞTIRMALAR' : 'TAPŞIRIQLAR',
  };
  const TH = {
    wrong: isTr ? 'Söylediğin' : 'Dediyin',
    right: isTr ? 'Doğrusu' : 'Düzgünü',
    why: isTr ? 'Açıklama' : 'İzah',
    word: isTr ? 'Kelime' : 'Word',
    example: isTr ? 'Örnek cümle' : 'Nümunə cümlə',
  };

  return (
    <div className="analysis-doc">
      <div className="analysis-doc-header">
        <button className="analysis-doc-back" onClick={onClose} aria-label={'Back'}>
          <ChevronLeft size={22} />
        </button>
        <div className="analysis-doc-title">SpeakLab · {'Analysis'}</div>
        {dateLabel && <div className="analysis-doc-meta">{dateLabel}</div>}
      </div>

      {/* 1. İcmal — AI-nin markdown hesabatı */}
      {view.reportMarkdown ? (
        <>
          {section(SEC.summary)}
          <div className="analysis-doc-card">
            <ReactMarkdown components={mdComponents}>{view.reportMarkdown}</ReactMarkdown>
          </div>
        </>
      ) : view.recap ? (
        <>
          {section(SEC.summary)}
          <div className="analysis-doc-card"><p>{view.recap}</p></div>
        </>
      ) : null}

      {/* 2. Ballar */}
      {scoreTiles.length > 0 && (
        <>
          {section(SEC.scores)}
          <div className="analysis-doc-scores">
            {scoreTiles.map((s) => (
              <div key={s.label} className="analysis-doc-score">
                <div className="analysis-doc-score-label">{s.label}</div>
                <div className="analysis-doc-score-value" style={{ color: scoreColor(s.value) }}>{s.value}</div>
              </div>
            ))}
          </div>
          {view.speakingPace?.wpm > 0 && (
            <p className="doc-note" style={{ marginTop: 12 }}>
              {'Speaking pace'}: <strong>{view.speakingPace.wpm} wpm</strong> ({view.speakingPace.label})
            </p>
          )}
        </>
      )}

      {/* 3. Düzəlişlər. Yeni analizlərdə səhvlər MÖVZUYA görə qruplaşdırılır:
          hər mövzunun adı + bir qızıl qayda + həmin naxışın real nümunələri.
          Köhnə sənədlərdə mövzu yoxdur — onlar düz cədvəllə göstərilir. */}
      {view.errorThemes.length > 0 ? (
        <>
          {section(SEC.mistakes)}
          {view.errorThemes.map((theme, ti) => (
            <div key={ti} style={{ marginBottom: 28 }}>
              <h3 style={{
                fontFamily: "'PT Serif', Georgia, serif", fontSize: 17,
                fontWeight: 700, margin: '0 0 10px',
              }}>
                {String.fromCharCode(65 + ti)}. {theme.title}
              </h3>
              {theme.rule && (
                <div className="analysis-doc-critical">
                  <span className="analysis-doc-critical-label">
                    {isTr ? 'Kritik Kural' : 'Kritik Qayda'}
                  </span>
                  {theme.rule}
                </div>
              )}
              <div className="analysis-doc-table-wrap">
                <table className="analysis-doc-table">
                  <thead>
                    <tr>
                      <th style={{ width: '32%' }}>{TH.wrong}</th>
                      <th style={{ width: '32%' }}>{TH.right}</th>
                      <th>{TH.why}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {theme.items.map((f, i) => (
                      <tr key={i}>
                        <td><span className="doc-wrong">{f.original}</span></td>
                        <td><span className="doc-right">{f.corrected}</span></td>
                        <td><span className="doc-note">{f.reason}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      ) : view.feedback.length > 0 ? (
        <>
          {section(SEC.mistakes)}
          <div className="analysis-doc-table-wrap">
            <table className="analysis-doc-table">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>{TH.wrong}</th>
                  <th style={{ width: '32%' }}>{TH.right}</th>
                  <th>{TH.why}</th>
                </tr>
              </thead>
              <tbody>
                {view.feedback.map((f, i) => (
                  <tr key={i}>
                    <td><span className="doc-wrong">{f.original}</span></td>
                    <td><span className="doc-right">{f.corrected}</span></td>
                    <td><span className="doc-note">{f.reason}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {section(SEC.mistakes)}
          <div className="analysis-doc-card" style={{ textAlign: 'center' }}>
            <span className="doc-right" style={{ fontSize: 15 }}>{'No grammar mistakes found'}</span>
          </div>
        </>
      )}

      {/* 4. Güclü tərəflər */}
      {view.strengths.length > 0 && (
        <>
          {section(SEC.strengths)}
          <ul className="analysis-doc-list">
            {view.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}

      {/* 5. Tövsiyələr */}
      {view.tips.length > 0 && (
        <>
          {section(SEC.tips)}
          <ul className="analysis-doc-list numbered">
            {view.tips.map((tip, i) => <li key={i}>{tip}</li>)}
          </ul>
        </>
      )}

      {/* 6. Lüğət cədvəli */}
      {view.vocabulary.length > 0 && (
        <>
          {section(SEC.vocab)}
          <div className="analysis-doc-table-wrap">
            <table className="analysis-doc-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>{TH.word}</th>
                  <th>{TH.example}</th>
                </tr>
              </thead>
              <tbody>
                {view.vocabulary.map((v, i) => (
                  <tr key={i}>
                    <td><span className="analysis-doc-word">{v.word}</span></td>
                    <td><span className="analysis-doc-example">{v.example}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Köhnə sənədlərin sahələri */}
      {view.legacyVocabularyUsed.length > 0 && (
        <>
          {section(SEC.vocab)}
          <p className="doc-note">{view.legacyVocabularyUsed.join(' · ')}</p>
        </>
      )}
      {view.legacyExamples.length > 0 && (
        <ul className="analysis-doc-list">
          {view.legacyExamples.map((s, i) => <li key={i}><em>{s}</em></li>)}
        </ul>
      )}

      {/* 7. İnteraktiv tapşırıqlar — sənədin davamı. Düzəlişlər yuxarıdakı
          cədvəldə olduğu üçün burada təkrarlanmır (showCorrections=false). */}
      {view.homework && (
        <>
          {section(SEC.homework)}
          <div className="homework-scope">
            <AnalysisHomework homework={view.homework} showCorrections={false} showBanner={false} />
          </div>
        </>
      )}

      <div className="analysis-doc-footer">
        SpeakLab · {isTr ? 'Yapay zekâ destekli konuşma analizi' : 'Süni intellekt dəstəkli danışıq analizi'}
      </div>
    </div>
  );
}
