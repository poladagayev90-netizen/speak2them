import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Video as VideoIcon, ChevronRight, Lock, Mic } from 'lucide-react';
import { getTodayContent } from '../data/weeklyContent';
import { plainTopic } from '../utils/topicLabel';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LessonHint from '../components/LessonHint';
import useWarmupOffer from '../hooks/useWarmupOffer';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import { WARMUP_AVATAR } from '../utils/warmupCall';
import '../components/ai/ai.css';
import './WarmupCall.css';
import { VIDEOS_ENABLED } from '../utils/fetchTopicVideos';

// The AInur tab. It used to be a single push-to-talk screen with a hardcoded
// background that ignored the theme, no saved history and no report — the
// weakest surface in the app, on the tab named after the product's AI.
//
// It is now a hub. The card shape (icon block left, title and one line right)
// is the pattern Talkpal uses for its learning modes, and it works for the same
// reason: you can scan five options without reading five paragraphs.
//
// Only activities that genuinely work are listed. Debate and Taboo have their
// decks ready (150 topics, 500 words) but no AI opponent yet, so they appear as
// what they are — not yet available — rather than as buttons that disappoint.

const ACTIVITIES = [
  {
    id: 'describe',
    icon: ImageIcon,
    title: 'Describe pictures',
    blurb: 'Five photos. Say what you see, AInur asks for more.',
    minutes: 8,
    to: '/practice',
  },
  {
    id: 'describe-video',
    icon: VideoIcon,
    title: 'Describe videos',
    blurb: 'Five short clips. Tell AInur the story of what happened.',
    minutes: 8,
    to: '/practice?mode=video',
  },
  // «Free talk» (/practice?mode=free) is no longer listed (Polad 2026-11-10:
  // it made no sense here — open-ended talk is what real partners are for, and
  // it ran on the old text-to-speech voice, not a call). The route still works
  // for old links.
];

const SOON = [
  { id: 'debate', title: 'Debate', blurb: 'Argue a side against AInur.' },
  { id: 'roleplay', title: 'Roleplay', blurb: 'A café, an interview, an airport.' },
];

export default function AinurHub({ user }) {
  const navigate = useNavigate();
  const content = useMemo(() => getTodayContent(), []);
  // The one warm-up CALL (Gemini Live, in a call room) — this tab is where it
  // waits once the newcomer pressed «Not now» on Today (Polad 2026-11-08:
  // «sonra AInur panelində yer ala bilər»). Gone after the first real call.
  const warmupOffer = useWarmupOffer(user);
  const { t } = useFirstRunCopy(user?.guideLanguage);

  return (
    <div style={{ padding: 'var(--s-4)', paddingBottom: '120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', marginBottom: 'var(--s-5)' }}>
        <img src={WARMUP_AVATAR} alt="" className="ai-avatar" style={{ width: 52, height: 52 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            margin: 0, fontSize: 'var(--fs-h1)', fontWeight: 700,
            color: 'var(--text-primary)', lineHeight: 'var(--lh-tight)',
          }}>
            AInur
          </h1>
          <p style={{
            margin: '2px 0 0', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)',
            lineHeight: 'var(--lh-body)',
          }}>
            Speak any time. You get a report after every session.
          </p>
        </div>
      </div>

      {warmupOffer && (
        <Card tone="ai" className="wu-card" style={{ marginBottom: 'var(--s-5)' }}>
          <div className="wu-card-head">
            <img src={WARMUP_AVATAR} alt="" className="wu-card-avatar" />
            <div>
              <h2 className="wu-card-title">{t('warm.card.title')}</h2>
              <p className="wu-card-sub">{t('warm.card.sub')}</p>
            </div>
          </div>
          <Button variant="ai" full icon={<Mic size={18} aria-hidden="true" />} onClick={() => navigate('/warmup')}>
            {t('warm.card.start')}
          </Button>
        </Card>
      )}

      <p className="ui-section-label">Practice · {plainTopic(content.topic)}</p>

      {ACTIVITIES.filter((a) => VIDEOS_ENABLED || a.id !== 'describe-video').map((a) => {
        const Icon = a.icon;
        return (
          <Card
            key={a.id}
            tone="ai"
            padding="none"
            onClick={() => navigate(a.to)}
            style={{ marginBottom: 'var(--s-3)', display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}
          >
            {/* The illustration slot. A flat tinted block reads as deliberate at
                any size; a stock illustration per activity would not survive
                the next four we add. */}
            <div style={{
              width: 76, flexShrink: 0, display: 'grid', placeItems: 'center',
              background: 'var(--ai-soft)', color: 'var(--ai)',
            }}>
              <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div style={{ flex: 1, minWidth: 0, padding: 'var(--s-3) var(--s-4)' }}>
              <p style={{
                margin: 0, fontSize: 'var(--fs-h2)', fontWeight: 700,
                color: 'var(--text-primary)', lineHeight: 'var(--lh-tight)',
              }}>
                {a.title}
              </p>
              <p style={{
                margin: '4px 0 0', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)',
                lineHeight: 'var(--lh-body)',
              }}>
                {a.blurb}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>
                About {a.minutes} minutes
              </p>
            </div>
            <div style={{ display: 'grid', placeItems: 'center', paddingRight: 'var(--s-3)' }}>
              <ChevronRight size={20} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
            </div>
          </Card>
        );
      })}

      <LessonHint user={user} moduleId="describe" text="Not sure what to say about a photo?" />

      <p className="ui-section-label" style={{ marginTop: 'var(--s-6)' }}>Coming next</p>
      {SOON.map((a) => (
        <Card key={a.id} padding="md" style={{ marginBottom: 'var(--s-3)', opacity: 0.6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
            <Lock size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {a.title}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {a.blurb}
              </p>
            </div>
          </div>
        </Card>
      ))}

      {user?.teacherId && (
        <p style={{
          marginTop: 'var(--s-5)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-muted)',
          lineHeight: 'var(--lh-body)',
        }}>
          Your teacher can see the report from each session.
        </p>
      )}
    </div>
  );
}
