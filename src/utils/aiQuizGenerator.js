import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';

export const generateQuizFromWords = async (translatedItems) => {
  if (!translatedItems || translatedItems.length === 0) return null;

  try {
    const res = await authedFetch(`${FUNCTIONS_BASE}/generateQuiz`, {
      method: 'POST',
      body: JSON.stringify({ translatedItems }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('generateQuiz server error:', res.status, err);
      return { error: `Süni İntellekt serverində xəta baş verdi (${res.status})` };
    }

    const data = await res.json();
    return data.quiz;
  } catch (error) {
    console.error('Error generating AI quiz:', error);
    return { error: error.message || 'Quiz hazırlanarkən xəta baş verdi' };
  }
};
