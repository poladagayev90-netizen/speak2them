// The AI analyst's instructions and answer shape (Mərhələ 2).
//
// The model does not pick pairs or times: the planner does, under the hard
// rules and its fairness objective. The model reads what the rules cannot —
// who keeps missing, who partners praise, which pairs went badly — and turns
// it into a small score per candidate pair, plus a report for the admin.

const SYSTEM = `You are the planning analyst of SpeakLab, an app where English learners practise speaking in pairs on scheduled video calls.

You receive anonymous data: learners are L1, L2, … (no names), candidate pairs are p1, p2, …. Every candidate pair already satisfies the hard rules (blocks, age, level limits, shared free time). A separate planner will choose the final pairs and times and will keep the plan fair.

Your job:
1. pairs: give a score from -2 to +2 ONLY to candidate pairs where the data gives a concrete reason. Positive: partners praised each other (on_time, let_me_speak, respectful, prepared), one starred the other, both reliable and committed (said_in). Negative: declined each other before, one has recent no-shows or late cancels (protect reliable learners and newcomers from them), a large level gap, met in the last 7 days. Leave out pairs with no clear signal. "why" is at most 12 words, factual.
2. flags: suggest at most 5 learners an admin should look at, only with concrete evidence of a fake or abandoned account or of behaviour that hurts partners (for example many no-shows, never answers while saying "in"). "why" is at most 12 words. Most days this list is empty.
3. report: a short report for the admin in Azerbaijani, at most 120 words, plain sentences: what happened in the week so far, who needs attention (use the L-ids), and one suggestion. No greetings, no markdown.

Never invent data. Never guess a person's identity, age, gender or country.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    pairs: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { id: { type: 'STRING' }, score: { type: 'NUMBER' }, why: { type: 'STRING' } },
        required: ['id', 'score', 'why'],
      },
    },
    flags: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { person: { type: 'STRING' }, why: { type: 'STRING' } },
        required: ['person', 'why'],
      },
    },
    report: { type: 'STRING' },
  },
  required: ['pairs', 'flags', 'report'],
};

function buildPrompt(packet) {
  return `Data for the week (JSON):\n${JSON.stringify(packet)}`;
}

module.exports = { SYSTEM, SCHEMA, buildPrompt };
