import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import './ai.css';

/**
 * The first thing on the home screen, and the answer to the problem the whole
 * release is about: a learner opens SpeakLab, nobody is online, and there is
 * nothing to do. There is now always something to do.
 *
 * Cyan ring because this leads to AInur. The live-partner card below it keeps
 * the violet — colour tells you who is on the other end before you read a word.
 *
 * The line about the teacher is not a detail. The learner is being recorded,
 * analysed, and reported on to a real person; that has to be said plainly on
 * the way in, not buried in a settings page.
 */
export default function TodayTaskCard({ topic, hasTeacher }) {
  const navigate = useNavigate();

  return (
    <Card tone="ai" padding="md" style={{ marginBottom: 'var(--s-3)' }}>
      <p className="ui-section-label" style={{ color: 'var(--ai)' }}>
        <Sparkles size={12} strokeWidth={2} style={{ verticalAlign: '-1px', marginRight: 4 }} />
        Today with AInur
      </p>

      <h2 style={{
        margin: '0 0 var(--s-1)',
        fontSize: 'var(--fs-h1)',
        fontWeight: 700,
        lineHeight: 'var(--lh-tight)',
        color: 'var(--text-primary)',
      }}>
        Describe pictures
      </h2>

      <p style={{
        margin: '0 0 var(--s-4)',
        fontSize: 'var(--fs-sm)',
        lineHeight: 'var(--lh-body)',
        color: 'var(--text-secondary)',
      }}>
        Five pictures on {topic || 'today’s topic'}. AInur listens and asks you
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
