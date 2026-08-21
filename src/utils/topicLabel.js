// Topic names in weeklyContent.js carry a trailing emoji ("Travel ✈️"). That is
// fine as a heading in the topic modal, where it is the subject of the screen.
// It is not fine dropped into the middle of a sentence — "Five pictures on
// Education 📚." puts a stray piece of colour in the one paragraph on an
// otherwise monochrome card, which is exactly the kind of noise the design is
// trying to remove.
//
// So the emoji stays in the content and is stripped at the point of use.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2B00}-\u{2BFF}]/gu;

export function plainTopic(label) {
  return String(label || '').replace(EMOJI, '').replace(/\s+/g, ' ').trim();
}

export default plainTopic;
