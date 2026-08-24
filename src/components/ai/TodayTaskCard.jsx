import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { plainTopic } from '../../utils/topicLabel';
import Card from '../ui/Card';
import Button from '../ui/Button';
import './ai.css';

/**
 * The first thing on the home screen, and the answer to the problem the whole
 * release is about: a learner opens SpeakLab, nobody is online, and there is
 * nothing to do. There is now always something to do.
 *
 * The lighter purple because this leads to AInur; the live-partner card below
 * it takes the deeper one — colour tells you who is on the other end before you
 * read a word.
 *
 * The line about the teacher is not a detail. The learner is being recorded,
 * analysed, and reported on to a real person; that has to be said plainly on
 * the way in, not buried in a settings page.
 */
export default function TodayTaskCard({ topic, hasTeacher }) {
  const navigate = useNavigate();

  return (
    <Card tone="ai" padding="md" style={{ marginBottom: 'var(--s-3)' }}>
      {/* Her face, not a coloured chip. The card is the first thing on the
          screen and it is asking a learner to talk to someone -- a picture of
          who that is does more than any label. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', marginBottom: 'var(--s-3)' }}>
        <img
          src="/ainur_avatar.png"
          alt=""
          className="ai-avatar"
          style={{ width: 60, height: 60 }}
        />
        <div style={{ minWidth: 0 }}>
          <p className="ui-section-label" style={{ color: 'var(--ai)', margin: 0 }}>
            <Sparkles size={12} strokeWidth={2} style={{ verticalAlign: '-1px', marginRight: 4 }} />
            Today with AInur
          </p>
          <h2 style={{
            margin: '2px 0 0',
            fontSize: 'var(--fs-h1)',
            fontWeight: 700,
            lineHeight: 'var(--lh-tight)',
            color: 'var(--text-primary)',
          }}>
            Describe pictures
          </h2>
        </div>
      </div>

      <p style={{
        margin: '0 0 var(--s-4)',
        fontSize: 'var(--fs-sm)',
        fontWeight: 600,
        lineHeight: 'var(--lh-body)',
        color: 'var(--text-secondary)',
      }}>
        Five pictures on {plainTopic(topic) || 'today’s topic'}. AInur listens and asks you
        questions. About 8 minutes.
        {hasTeacher ? ' Your report goes to your teacher.' : ''}
      </p>

      <Button
        variant="ai"
        size="lg"
        full
        onClick={() => navigate('/practice')}
        iconRight={<ArrowRight size={20} strokeWidth={2} />}
      >
        Start
      </Button>
    </Card>
  );
}
