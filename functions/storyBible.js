// The story bible for the class reading/listening: one serialised novel about
// Julian, set in Baku, told across 60 lessons. DRAFT — Polad approves this
// before any chapter is generated (scheduled-practice plan, Faza C).
//
// WHY THE BEATS FOLLOW THE LESSON, NOT THE TOPIC. A teacher picks each
// lesson's topic freely (lesson 2 may be "Job Interviews", lesson 3 "Travel"),
// but a story only works in order. So episode n always tells beat n, and the
// lesson's topic becomes the SCENE of that beat — where it happens, what people
// talk about, the words it uses. Every beat is written so that any of the 60
// topics can be its setting ("Julian has to tell Leo the truth" can happen at a
// market, in a hospital, at a wedding). The generator gets the bible, the
// summaries of the episodes this class already read, beat n and the topic.
//
// WHAT MAKES IT DEEP (the old 14-chapter draft did not have these):
//   - Julian WANTS one thing and NEEDS another, and the two collide at the end.
//   - He hides one lie while being famous for honesty — the irony drives it.
//   - Every choice costs something, and the cost comes back later (payoffs).
//   - Each episode ends on a dilemma the class debates; the answer opens the
//     next episode as a short listening (a voicemail, a call, a radio clip).

const CHARACTERS = [
  {
    name: "Julian Mammadli",
    role: "Junior assistant, later junior lawyer, at Sterling & Partners in Baku. 27.",
    want: "To become a partner at Sterling & Partners before he turns 30 — proof that he is worth something.",
    need: "To stop saving everyone and pleasing everyone; to say no, accept help, and tell the one truth he has hidden.",
    secret: "Nine years ago he was meant to watch his younger brother Leo on the frozen lake in Goygol. He was on the phone about a scholarship; Leo fell through the ice and lost his football career. Julian let everyone believe Leo had gone out alone.",
    voice: "Polite, careful, makes jokes about himself when nervous, says 'Let me figure it out' too often.",
  },
  {
    name: "Arthur Sterling",
    role: "Founder of Sterling & Partners. 61. Strict, fair on the surface.",
    want: "To keep the firm alive and his name clean.",
    need: "To admit the firm has been failing and that he took money he should not have.",
    secret: "The firm is deep in debt. Victor Vance has been paying it quietly in exchange for 'favours'.",
    voice: "Short sentences, old-fashioned words, ends talks with 'Period.'",
  },
  {
    name: "Victor Vance",
    role: "Property developer. 50. Builds glass towers. Not a cartoon villain.",
    want: "To rebuild the Old City block where the Cultural Hub stands.",
    need: "To forgive the city for what happened to his family.",
    secret: "He grew up in that block. His mother was evicted from it when he was twelve, and she never had a home of her own again.",
    voice: "Calm, generous with compliments, always pays for everything.",
  },
  {
    name: "Elena Karimova",
    role: "Violinist who runs the Old City Cultural Hub (music lessons, a library, a tea room).",
    want: "To keep the Hub open for the children who use it.",
    need: "To trust people again, lawyers included.",
    secret: "She signed a paper she did not understand when she took over the Hub — the reason it can be taken from her.",
    voice: "Direct, warm with children, sharp with adults, quotes old songs.",
  },
  {
    name: "Leo Mammadli",
    role: "Julian's younger brother. 24. Repairs boats by the lake. Walks with a slight limp.",
    want: "To be left alone.",
    need: "To hear the truth from his brother.",
    secret: "He remembers more about the day on the lake than he admits.",
    voice: "Few words, dry humour, calls Julian 'the lawyer'.",
  },
  {
    name: "Yunus",
    role: "Potter and chess player in Mardakan. Julian's friend and, later, roommate.",
    want: "To sell his pottery in a real shop.",
    need: "Nothing big — he is the one who already knows what he needs.",
    secret: "None. He is the honest mirror of the story.",
    voice: "Slow, funny, explains life through clay and chess.",
  },
  {
    name: "Sabina Aliyeva",
    role: "Another junior at the firm. Julian's rival for the same partner place.",
    want: "The partner place.",
    need: "To be ambitious without becoming Sterling.",
    secret: "She finds out about Vance's money before Julian does — and keeps quiet for a while.",
    voice: "Fast, organised, polite in a way that cuts.",
  },
  {
    name: "Mrs. Martha",
    role: "Elderly widow in Mardakan, Julian's first client. Grows figs.",
    want: "To keep her husband's land.",
    need: "To let her family help her.",
    secret: "Her land borders the plot Vance needs for a road.",
    voice: "Calls everyone 'my son' or 'my daughter', feeds every visitor.",
  },
  {
    name: "Damian Frost",
    role: "Vance's attorney. Julian's best friend at university.",
    want: "To win, and to be paid like he wins.",
    need: "To remember why he studied law.",
    secret: "He once covered for Julian at university; he thinks Julian owes him.",
    voice: "Charming, quick, uses Julian's old nickname 'Jules'.",
  },
];

// Four seasons of fifteen. Each has one question and one opponent.
const SEASONS = [
  { n: 1, title: "The Broken Window", lessons: [1, 15],
    question: "Is honesty always rewarded?",
    arc: "Julian's honesty about a broken window wins Sterling's trust and a promotion. His first case — Mrs. Martha's land — leads him to Mardakan, Yunus and, by chance, Elena. Vance appears as a generous client. The season ends when Julian learns the buyer trying to take Martha's land is a company owned by Vance — and that Sterling already knew." },
  { n: 2, title: "The Old City", lessons: [16, 30],
    question: "Whose side are you on when everyone you love is on a different side?",
    arc: "An eviction notice reaches the Cultural Hub. Julian tries to help Elena, keep Sterling happy and win Sabina's race for partner at the same time — and says yes to everyone. Leo needs money for his boatyard. Julian wins the Hub a delay in court against Damian, but the season ends with his own signature found on a Vance contract he signed without reading, because Sterling asked him to." },
  { n: 3, title: "Debts", lessons: [31, 45],
    question: "What do we owe the people we have hurt?",
    arc: "Julian is suspended. He works night shifts at a hotel, moves in with Yunus, and has time to think for the first time. Vance's past comes out — his mother's eviction from the same block. Sabina quietly feeds Julian documents. On the lake, Leo says he remembers the phone call. The season ends with Julian telling his parents the truth about the accident." },
  { n: 4, title: "One Day at a Time", lessons: [46, 60],
    question: "What is success, if it is not the thing you wanted?",
    arc: "Julian opens a free legal corner in the Hub. Sterling confesses to the bar association. The final hearing for the Hub is against Damian — and Vance, who has to decide what his mother would want. Sterling offers Julian the partner place at last. Julian says no. The story ends with goodbyes and a reunion on the lake, one day at a time." },
];

// Sixty beats, in lesson order. setup/payoff link beats that must agree.
// `dilemma` is the debate the class has after reading; the next beat's opening
// (the listening) reveals what Julian or another character chose.
const BEATS = [
  // Season 1 — The Broken Window
  { n: 1, title: "The window", beat: "Working late in a storm, Julian breaks the firm's old stained-glass window. He hears Sterling's key in the door. The storm could have done it — nobody would know. Stop at the moment Sterling walks in and asks what happened. (Episode 2's listening reveals that Julian told the truth and offered to pay.)", dilemma: "Should Julian blame the storm? Nobody would know.", setup: ["window", "honesty"] },
  { n: 2, title: "The envelope", beat: "A stranger, Victor Vance, leaves a sealed envelope 'for Mr. Sterling only' and a large tip for Julian. The envelope is not sealed properly.", dilemma: "Should Julian look inside an envelope that is not his?", setup: ["envelope"] },
  { n: 3, title: "A test", beat: "Sterling reveals the envelope was a test of discretion arranged with Vance, his 'oldest client'. Julian is promoted to junior lawyer. Sabina, who wanted the promotion, congratulates him a little too politely.", dilemma: "Is it fair to test people without telling them?" },
  { n: 4, title: "The violin", beat: "On a free Saturday in the Old City Julian hears Elena play for children outside the Hub and helps when a man tries to move them on. She thanks him — until she hears he is a lawyer.", dilemma: "Should Julian tell Elena where he works, or keep it simple?" },
  { n: 5, title: "The first case", beat: "Sterling gives Julian his first case: Mrs. Martha in Mardakan, whose neighbour claims part of her land. She feeds him for two hours before talking about the case.", dilemma: "Julian has too much work. Should he take a case that pays the firm almost nothing?" },
  { n: 6, title: "Clay and chess", beat: "Looking for the old land border, Julian finds Yunus's pottery workshop. Yunus beats him at chess in nine moves and tells him the border stone was moved 'by a man in a nice car'.", dilemma: "Should Julian trust a story from a stranger he just met?" },
  { n: 7, title: "Sabina's offer", beat: "Sabina offers to 'help' with the Martha case. Julian is overloaded and accepts. She finds a map he missed — and takes it to Sterling first.", dilemma: "Should you share work with someone who wants your job?" },
  { n: 8, title: "Leo", beat: "Julian visits his brother Leo at the lake for their father's birthday. Leo is cold with him. A neighbour mentions 'the accident' and Julian changes the subject too fast.", dilemma: "Should family talk about old pain, or leave it in the past?", setup: ["lake", "secret"] },
  { n: 9, title: "The nice car", beat: "Julian sees the same car Yunus described parked outside the firm. It belongs to Vance's driver.", dilemma: "Julian has no proof. Should he ask Sterling about it?" },
  { n: 10, title: "Tea at the Hub", beat: "Elena invites Julian to the Hub's tea evening. He meets the children, the old library, the leaking roof. She says the building 'belongs to the city, so it belongs to nobody'.", dilemma: "Should old buildings be protected even when they are falling apart?" },
  { n: 11, title: "A generous man", beat: "Vance invites Julian to lunch, praises his honesty and offers to pay for the Hub's new roof 'as a gift to the city'.", dilemma: "Should Elena accept money from a man she does not know?" },
  { n: 12, title: "Martha's figs", beat: "Martha falls ill. Her grandson wants to sell the land. Julian must decide whether to push the case for her or tell her to sell.", dilemma: "Should a lawyer give the advice that is best for the client, or the one the client wants to hear?" },
  { n: 13, title: "The map", beat: "The map Sabina found shows a road planned straight through Martha's land. The company planning it has an unfamiliar name.", dilemma: "Should Julian keep digging when his boss told him to close the case?" },
  { n: 14, title: "Yunus's warning", beat: "Over a lost chess game Yunus warns Julian: 'In chess, the piece that looks free is usually a trap.' Julian finds the company's owner online.", dilemma: "Is it ever right to look into your own boss?" },
  { n: 15, title: "Vance", beat: "The company is Vance's. In Sterling's desk Julian sees a signed agreement: Sterling knew from the start. Sterling walks in.", dilemma: "Should Julian admit what he saw, or pretend he saw nothing?", payoff: ["envelope"] },

  // Season 2 — The Old City
  { n: 16, title: "Period.", beat: "Sterling explains calmly that the road 'will help thousands' and Martha will be paid well. Julian is told to stay out of it — or leave. Julian stays, and hates himself for it.", dilemma: "Should Julian quit his job over a case he cannot win?" },
  { n: 17, title: "The notice", beat: "An eviction notice is taped to the Hub door: the building is to be 'renewed'. Elena asks Julian for help.", dilemma: "Should Julian help Elena when it puts him against his own firm?" },
  { n: 18, title: "Two jobs", beat: "Julian works for the firm by day and reads old city law for Elena by night. He stops sleeping. Sabina notices his mistakes.", dilemma: "Is it brave or foolish to say yes to everyone?" },
  { n: 19, title: "Damian", beat: "Vance's attorney on the Hub case is Damian Frost, Julian's best friend from university. They meet for tea. Damian says, 'Don't make me beat you, Jules.'", dilemma: "Can you stay friends with someone who is working against you?" },
  { n: 20, title: "Leo asks", beat: "Leo calls Julian for the first time in a year: he needs money to save his boatyard. Julian says yes before asking how much.", dilemma: "Should you lend money to family?" },
  { n: 21, title: "The paper", beat: "Julian finds why the Hub can be taken: years ago Elena signed a paper she did not read. She is ashamed and angry.", dilemma: "Who is responsible — the person who signs without reading, or the person who asks them to sign?", setup: ["signature"] },
  { n: 22, title: "Sabina's race", beat: "Sterling announces one partner place next year: Julian or Sabina. Sabina is brilliant at a meeting Julian is too tired to follow.", dilemma: "Is competition between colleagues good for a team?" },
  { n: 23, title: "The children", beat: "The Hub children make a video about why the Hub matters. It goes viral. Vance calls Julian personally: 'You are better than this.'", dilemma: "Should children be part of adults' fights?" },
  { n: 24, title: "Yunus's shop", beat: "Yunus finally gets a small shop near the Hub — in the block Vance wants to rebuild. Now Julian's friend is on the list too.", dilemma: "Is progress worth it if some people lose their place?" },
  { n: 25, title: "Collapse", beat: "Julian faints at work. In the hospital, everyone he has been helping visits — except Leo, who sends a message: 'Learn to say no, lawyer.'", dilemma: "Is it selfish to put yourself first sometimes?" },
  { n: 26, title: "A small no", beat: "Julian says his first real no: he refuses Sterling a weekend job. Sterling is surprised, then gives it to Sabina.", dilemma: "Did Julian do the right thing, or did he just lose the partner place?" },
  { n: 27, title: "The hearing", beat: "The first Hub hearing. Damian is excellent. Julian is better prepared, because Elena's children found an old city record in the Hub library.", dilemma: "Should a court decide by the law on paper or by what is fair to people?" },
  { n: 28, title: "A delay", beat: "The judge gives the Hub six months. Everyone celebrates. Damian shakes Julian's hand and says, 'Check your own files, Jules.'", dilemma: "Should Julian trust a warning from the other side?" },
  { n: 29, title: "The file", beat: "Julian checks. On a Vance contract in the firm's archive is his own signature — from a pile Sterling once asked him to sign 'quickly, it's routine'.", dilemma: "Julian did not read it. Is he guilty?", payoff: ["signature"] },
  { n: 30, title: "Suspended", beat: "Sterling suspends Julian 'until this is clear' and tells the bar it was Julian's mistake. Sabina says nothing. Elena reads about it in the news.", dilemma: "Should Sabina speak up for Julian if it costs her the partner place?" },

  // Season 3 — Debts
  { n: 31, title: "Night shift", beat: "Julian takes a night job at a hotel reception to pay his rent and Leo's loan. He meets night people: a nurse, a taxi driver, a lonely old guest.", dilemma: "Is any honest job a good job?" },
  { n: 32, title: "Moving in", beat: "Julian cannot pay rent and moves into Yunus's small flat above the shop. Yunus's rules: no shoes inside, chess every evening.", dilemma: "Would you live with a friend? What are the rules?" },
  { n: 33, title: "Elena's silence", beat: "Elena will not answer his calls. When they finally meet she asks one question: 'Did you know?' He tells her the truth: he signed without reading.", dilemma: "Should Elena forgive Julian?" },
  { n: 34, title: "The old guest", beat: "The lonely hotel guest turns out to be a retired city archivist who remembers the Old City block — and the families who were evicted from it in 1986.", dilemma: "Should we keep records of the bad things a city did?" },
  { n: 35, title: "Vance's mother", beat: "Among the 1986 names is 'Vance, R.' — Victor's mother. Julian understands Vance is not building towers; he is taking back a block that was taken from him.", dilemma: "Does a sad past excuse what someone does now?" },
  { n: 36, title: "Sabina's documents", beat: "An envelope arrives at the hotel with no name: copies of Sterling's bank letters. Only Sabina could have sent them.", dilemma: "Is it right to leak documents to do the right thing?", payoff: ["envelope"] },
  { n: 37, title: "The lake again", beat: "Julian pays Leo's loan in cash at the lake. Leo looks at the ice and says, 'I heard your phone ring that day, you know.'", dilemma: "Should Julian finally tell the whole truth, now, here?", payoff: ["lake"] },
  { n: 38, title: "What Leo knew", beat: "Leo has always known Julian was on the phone. He waited nine years for Julian to say it himself. Julian says it. Leo walks away without a word.", dilemma: "Is a late apology still worth something?", payoff: ["secret"] },
  { n: 39, title: "Damian's debt", beat: "Damian visits Yunus's shop and tells Julian about university: he once covered for him, and now he wants Julian to keep quiet about Sterling. 'We're even after this.'", dilemma: "Do we owe the people who once helped us — even when they ask for something wrong?" },
  { n: 40, title: "Fixing the roof", beat: "Julian, Yunus and the Hub children fix the Hub roof themselves on a Saturday. Elena brings tea. It is the first time she laughs with him again.", dilemma: "Should people fix things themselves, or wait for the city to do it?" },
  { n: 41, title: "The meeting", beat: "Julian asks Vance to meet in the Old City, at the block. He shows him his mother's name in the archive.", dilemma: "Should Julian use someone's pain to persuade them?" },
  { n: 42, title: "Alone", beat: "Vance leaves without a word. Julian spends a night completely alone for the first time in months — no work, no one to save — and does not know what to do with himself.", dilemma: "Is being alone a punishment or a gift?" },
  { n: 43, title: "Sabina's choice", beat: "Sterling offers Sabina the partner place if she signs a statement that Julian acted alone. She has one day.", dilemma: "What should Sabina do?" },
  { n: 44, title: "The statement", beat: "Sabina refuses and resigns. She comes to Yunus's shop with a box of her things: 'Your sofa or the street, Mammadli.'", dilemma: "Was Sabina brave, or did she throw her career away?" },
  { n: 45, title: "The table", beat: "At his parents' table, with Leo present, Julian tells the family the truth about the lake. His mother cries. Leo says, 'Finally.'", dilemma: "Should some family secrets stay secret?", payoff: ["secret"] },

  // Season 4 — One Day at a Time
  { n: 46, title: "The corner", beat: "Elena gives Julian a corner of the Hub: a desk, a sign — FREE LEGAL HELP, TUESDAYS. The first visitor is a woman who cannot read her own rental contract.", dilemma: "Should lawyers give some of their time for free?" },
  { n: 47, title: "Sterling's letter", beat: "Sterling writes to the bar association and admits the debts and Vance's payments. He asks Julian to come and see him.", dilemma: "Should Julian visit the man who blamed him?" },
  { n: 48, title: "Market day", beat: "Julian's Tuesday corner fills up: a market seller, a student, a family about to be evicted from another block — Vance's next project.", dilemma: "Can one person change anything, or is it too big?" },
  { n: 49, title: "Leo's boat", beat: "Leo asks Julian to help him launch the first boat he has built himself. On the water they talk like brothers for the first time.", dilemma: "Can a relationship be rebuilt, or only patched?" },
  { n: 50, title: "The last hearing is set", beat: "The final Hub hearing is set for the end of the month. Damian is still Vance's attorney. Julian must represent the Hub — without a firm.", dilemma: "Should Julian take the case alone, or ask a big firm for help?" },
  { n: 51, title: "Old Sterling", beat: "Julian visits Sterling, now ill and alone in a big flat. Sterling asks for forgiveness and gives Julian the firm's archive key.", dilemma: "Can you forgive someone and still not trust them?" },
  { n: 52, title: "Moving out", beat: "Sabina and Julian rent a tiny office together near the Hub. Yunus is sad, then relieved: 'Finally I can win at chess against someone new.'", dilemma: "Is it better to work with a friend or with a stranger?" },
  { n: 53, title: "Made by hand", beat: "Yunus's pottery class at the Hub becomes popular. Vance's daughter signs up — without telling her father.", dilemma: "Should children follow their parents' fights?" },
  { n: 54, title: "Rumours", beat: "A news site claims Julian is using the Hub children for publicity. Clients cancel. Elena wants to answer online; Julian wants to stay quiet.", dilemma: "Should you answer a rumour, or ignore it?" },
  { n: 55, title: "The archive", beat: "In Sterling's archive Julian finds the 1986 eviction order — illegal even then. It could win the case and shame the city.", dilemma: "Should Julian use evidence that will hurt people who are not in court?" },
  { n: 56, title: "Damian", beat: "Julian shows Damian the 1986 order before the hearing. Damian tells him he will lose his client if he looks at it. He looks at it.", dilemma: "Should Damian tell Vance, or just try to win?" },
  { n: 57, title: "The hearing", beat: "The final hearing. Damian withdraws. Vance stands up and speaks about his mother and the block — and says he will build homes for the evicted families' children instead of towers.", dilemma: "Is Vance's change real, or a clever move?" },
  { n: 58, title: "The offer", beat: "Sterling's partners rebuild the firm and offer Julian the partner place he wanted since lesson one — if he closes his free corner.", dilemma: "What should Julian choose?", payoff: ["window"] },
  { n: 59, title: "No", beat: "Julian says no. At the Hub he hangs a small piece of the old stained-glass window, which Sterling sent him, above his desk.", dilemma: "Was Julian right to say no to the thing he always wanted?", payoff: ["window", "honesty"] },
  { n: 60, title: "The lake", beat: "Winter again. Everyone — Elena, Yunus, Sabina, Martha, Leo, even Damian — meets at the lake. Leo and Julian walk on the safe ice together. One day at a time.", dilemma: "What did Julian really win?" },
];

// How each episode is written (sent to the generator with the bible).
const WRITING_RULES = {
  levels: {
    A2: { words: [240, 300], note: "Short sentences, past simple and past continuous, everyday words. At least 40% dialogue." },
    B1: { words: [340, 420], note: "Mixed tenses, some relative clauses, natural chunks and phrasal verbs. At least 40% dialogue." },
  },
  rules: [
    "Tell exactly this beat — no other big events. Keep every fact the earlier episodes established.",
    "The lesson topic is the SCENE: set the beat where the topic lives and let people talk about it naturally. Never lecture about the topic.",
    "Use at most 5 target expressions, chosen from the topic's words and idioms where they fit; the rest of the words come naturally.",
    "End at the moment of the dilemma. If the beat already contains the choice, the dilemma asks whether it was right. Either way the character must have a real reason for each side.",
    "Write the LISTENING separately: 100–140 words, a voicemail, phone call, radio clip or conversation that opens the episode and reveals what happened after the PREVIOUS episode's dilemma.",
    "Baku is real: real streets and places (Old City, Fountains Square, Mardakan, the Boulevard, Goygol), tea, real food. No stereotypes.",
    "No violence beyond the bible, no romance beyond looks and warm words, nothing unsuitable for a 15-year-old.",
  ],
};

module.exports = { CHARACTERS, SEASONS, BEATS, WRITING_RULES };
