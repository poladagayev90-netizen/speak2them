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
      const body = await res.json().catch(() => ({}));
      console.error('generateQuiz server error:', res.status, body);
      // 400/422 carry a message written for the user; anything else is ours.
      const explained = res.status === 429 || res.status === 422;
      return { error: explained && body.error
        ? body.error
        : `Süni İntellekt serverində xəta baş verdi (${res.status})` };
    }

    const data = await res.json();
    return data.quiz;
  } catch (error) {
    console.error('Error generating AI quiz:', error);
    return { error: error.message || 'Quiz hazırlanarkən xəta baş verdi' };
  }
};
