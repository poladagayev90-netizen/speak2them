import { getFeedbackLanguage, getReportLanguage, setFeedbackLanguage, LANG_STORAGE_KEY } from './feedbackLanguage';

beforeEach(() => localStorage.clear());

describe('report vs content language', () => {
  it('ru is a report language but never a content language', () => {
    setFeedbackLanguage('ru');
    expect(getReportLanguage()).toBe('ru');
    // Meanings and concept names exist in az/tr only.
    expect(['az', 'tr']).toContain(getFeedbackLanguage());
  });

  it('az and tr are both', () => {
    setFeedbackLanguage('tr');
    expect(getReportLanguage()).toBe('tr');
    expect(getFeedbackLanguage()).toBe('tr');
  });

  it('an unknown code falls back to az', () => {
    expect(setFeedbackLanguage('de')).toBe('az');
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('az');
  });
});
