// The emoji panel's set (ChatComposer). A short, hand-picked list instead of a
// library: the whole Unicode table is ~3,600 glyphs and a megabyte of data for
// a practice chat that needs greetings, reactions and a few study things.
// Emoji are CONTENT here (what the learner types), not UI icons.
export const EMOJI_GROUPS = [
  {
    key: 'smileys',
    label: 'Smileys',
    list: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '🤗',
      '🤭', '🤔', '🤨', '😐', '😶', '🙄', '😏', '😌', '😴', '😮', '😯', '😲', '🥺', '😢', '😭', '😤', '😡', '🤯', '😳', '🥳',
      '😎', '🤓', '🧐', '😬', '🤐', '😷', '🤒', '🥱', '😵', '🫡'],
  },
  {
    key: 'gestures',
    label: 'Hands',
    list: ['👍', '👎', '👌', '✌️', '🤞', '🤝', '🙏', '👏', '🙌', '👋', '🤙', '💪', '✋', '👊', '🫶', '👀', '🧠', '🗣️', '👂', '🙋'],
  },
  {
    key: 'hearts',
    label: 'Hearts',
    list: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤', '💯', '✨', '🔥', '⭐', '🌟', '🎉', '🎊', '🏆', '🥇', '✅', '❌', '❓'],
  },
  {
    key: 'study',
    label: 'Study',
    list: ['📚', '📖', '✏️', '📝', '🎧', '🎤', '💬', '🗓️', '⏰', '☕', '🍵', '🍕', '🌍', '✈️', '🏠', '🎬', '🎵', '⚽', '🐱', '🐶'],
  },
];

const RECENT_KEY = 'chatRecentEmoji';
export function recentEmoji() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 16); } catch { return []; }
}
export function rememberEmoji(e) {
  try {
    const next = [e, ...recentEmoji().filter((x) => x !== e)].slice(0, 16);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* private mode — no recent row, nothing else breaks */ }
}
