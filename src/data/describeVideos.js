// "Describe the video" deck — the moving-picture twin of describeImages.js.
//
// WHY VIDEO AT ALL: a photo is one frozen moment, so a learner can finish it in
// two sentences ("a man, a fish, a pier") and stop. A clip has a BEFORE and an
// AFTER, so the natural answer is a story — what he was doing, what went wrong,
// what happened next — which is the tense range the calls were missing.
//
// SELECTION RULE (same as the picture deck, one clip stricter): people or
// animals DOING something, a visible turn in the action, and nothing that
// depends on hearing the audio. Every file is stripped of its soundtrack on
// purpose: the original sound was social-media music and voice-over in other
// languages, and a learner describing a scene should not be racing a narrator.
//
// FILES: local under public/videos/ — mp4, H.264, ~480px wide, no audio track,
// 6–26 s, faststart. They are served from the same origin as the app, so there
// is no third-party host that can rate-limit one peer and not the other. When
// the library outgrows the bundle (the plan is 5–6 clips PER TOPIC, i.e. 300+),
// move the files to storage and change SOURCES here — everything else reads
// `src`, so nothing downstream has to change.
//
// KEYWORDS: five at most, and only what is ON SCREEN. Same rule as the picture
// deck — the sixth word was always a synonym or a word about the camera
// ("close-up") rather than about the scene.
//
// SYNC: the deck is static and ordered, so in a call both peers get the same
// clip at the same index (the index lives in the call doc's videoStage).
// Nothing here is fetched at runtime, so the two sides cannot drift apart.
//
// IDS ARE STORAGE KEYS (aiSessions itemId, lesson-style rule): add, never
// rename.
export const describeVideos = [
  {
    // source: pexels_4253330.mp4 (CC0 Free Commercial License)
    id: 'chef-stir-fry',
    src: '/videos/chef-stir-fry.mp4',
    poster: '/videos/chef-stir-fry.jpg',
    seconds: 16,
    alt: 'A chef in a white uniform rapidly tosses vegetables in a hot wok over a gas flame.',
    keywords: ["chef apron","frying pan","tossing vegetables","gas flame","kitchen counter"],
    prompts: [
      'What cooking technique is the chef using?',
      'Have you ever tried making a dish that required high heat like this?',
    ],
  },
  {
    // source: pexels_35282483.mp4 (CC0 Free Commercial License)
    id: 'dog-park-chase',
    src: '/videos/dog-park-chase.mp4',
    poster: '/videos/dog-park-chase.jpg',
    seconds: 15,
    alt: 'Two happy dogs chase each other in circles across a green park lawn on a sunny morning.',
    keywords: ["playful dogs","green grass","running in circles","wagging tails","sunny day"],
    prompts: [
      'What are the two dogs doing together?',
      'Why do dogs enjoy running in open spaces so much?',
    ],
  },

  {
    // source: video_2026-09-22_00-21-50.mp4
    id: 'garden-guitar',
    src: '/videos/garden-guitar.mp4',
    poster: '/videos/garden-guitar.jpg',
    seconds: 20,
    alt: 'A boy sits on a low wall in a vegetable garden playing a guitar while a big rooster stands next to him.',
    keywords: ['rooster', 'guitar', 'vegetable patch', 'basketball', 'cross-legged'],
    prompts: [
      'What is the rooster doing while he plays?',
      'Why do you think he came out to the garden to play?',
    ],
  },
  {
    // source: video_2026-09-22_00-21-54.mp4
    id: 'rope-swing',
    src: '/videos/rope-swing.mp4',
    poster: '/videos/rope-swing.jpg',
    seconds: 17,
    alt: 'Friends take turns on a rope swing over a pond; one of them lets go and drops into the water.',
    keywords: ['rope swing', 'pond', 'let go', 'splash', 'reeds'],
    prompts: [
      'What happens in the last few seconds?',
      'Would you try this? Why or why not?',
    ],
  },
  {
    // source: video_2026-09-22_00-21-56.mp4
    id: 'gorilla-meet',
    src: '/videos/gorilla-meet.mp4',
    poster: '/videos/gorilla-meet.jpg',
    seconds: 22,
    alt: 'Trekkers stand still in the forest as a mountain gorilla walks past; one man slowly holds out an open hand.',
    keywords: ['gorilla', 'open palm', 'chewing leaves', 'forest', 'standing still'],
    prompts: [
      'Why does the man hold out his hand?',
      'How would you feel if you were standing there?',
    ],
  },
  {
    // source: video_2026-09-22_00-21-58.mp4
    id: 'garden-camera',
    src: '/videos/garden-camera.mp4',
    poster: '/videos/garden-camera.jpg',
    seconds: 21,
    alt: 'A camera on a garden bird feeder films a squirrel, then a dove, then a deer that puts its face into the tray.',
    keywords: ['bird feeder', 'squirrel', 'dove', 'seeds', 'deer'],
    prompts: [
      'Which visitor surprised you most?',
      'What kind of house has a garden like this?',
    ],
  },
  {
    // source: video_2026-09-22_00-21-59.mp4
    id: 'stairs-fall',
    src: '/videos/stairs-fall.mp4',
    poster: '/videos/stairs-fall.jpg',
    seconds: 6,
    alt: 'An estate agent showing an empty house loses his footing at the top of the stairs and slides down them.',
    keywords: ['estate agent', 'staircase', 'carpet', 'slip', 'empty house'],
    prompts: [
      'What exactly went wrong, step by step?',
      'What would you say to him afterwards?',
    ],
  },
  {
    // source: video_2026-09-22_00-22-01.mp4
    id: 'petting-hen',
    src: '/videos/petting-hen.mp4',
    poster: '/videos/petting-hen.jpg',
    seconds: 17,
    alt: 'A hand strokes a ginger hen lying on a blue blanket; each time the hand stops, the hen pushes its head back for more.',
    keywords: ['hen', 'stroke', 'blanket', 'sofa', 'feathers'],
    prompts: [
      'What does the hen do every time the hand stops?',
      'Can a chicken really be a pet? Why?',
    ],
  },
  {
    // source: video_2026-09-22_00-22-11.mp4
    id: 'leopard-road',
    src: '/videos/leopard-road.mp4',
    poster: '/videos/leopard-road.jpg',
    seconds: 22,
    alt: 'Filmed from a safari vehicle, a leopard walks down a dirt track in the evening light and then lies down in the dust.',
    keywords: ['leopard', 'dirt track', 'safari vehicle', 'dry grass', 'spots'],
    prompts: [
      'How close is the car to the animal?',
      'What is the leopard going to do next?',
    ],
  },
  {
    // source: video_2026-09-22_00-22-15.mp4
    id: 'table-knife',
    src: '/videos/table-knife.mp4',
    poster: '/videos/table-knife.jpg',
    seconds: 20,
    alt: 'In a busy restaurant a waiter raises a huge blade and cuts a steaming round bread pie in front of a guest.',
    keywords: ['huge knife', 'steam', 'flatbread', 'salads', 'waiter'],
    prompts: [
      'What is on the table in front of the man?',
      'What do you think the dish tastes like?',
    ],
  },
  {
    // source: video_2026-09-22_00-22-17.mp4
    id: 'pier-fish',
    src: '/videos/pier-fish.mp4',
    poster: '/videos/pier-fish.jpg',
    seconds: 24,
    alt: 'A man on a wooden pier holds up a big fish, kneels to put it back in the sea, loses his balance and falls in.',
    keywords: ['pier', 'big fish', 'put back', 'lose balance', 'soaked'],
    prompts: [
      'Tell the whole story in three sentences.',
      'Was it his own fault? Why?',
    ],
  },
  {
    // source: video_2026-09-22_00-22-23.mp4
    id: 'dream-fall',
    src: '/videos/dream-fall.mp4',
    poster: '/videos/dream-fall.jpg',
    seconds: 14,
    alt: 'A first-person view falling from the sky above a huge city; the ground rushes closer and then the person is lying safely in bed.',
    keywords: ['falling', 'city below', 'clouds', 'bed', 'wake up'],
    prompts: [
      'What has actually happened here?',
      'Do you ever dream about falling? Tell me about it.',
    ],
  },
  {
    // source: video_2026-09-22_00-22-41.mp4
    id: 'tv-studio',
    src: '/videos/tv-studio.mp4',
    poster: '/videos/tv-studio.jpg',
    seconds: 10,
    alt: 'During a live news broadcast somebody crawls across the studio floor behind the presenter while she keeps talking.',
    keywords: ['news studio', 'presenter', 'crawl', 'live TV', 'screen'],
    prompts: [
      'Why is that person crawling across the floor?',
      'Did the presenter notice? How can you tell?',
    ],
  },
  {
    // source: video_2026-09-22_00-22-47.mp4
    id: 'canal-slide',
    src: '/videos/canal-slide.mp4',
    poster: '/videos/canal-slide.jpg',
    seconds: 26,
    alt: 'A man in a motorbike helmet drops a toy boat into a fast irrigation canal beside rice fields, runs along the bank and then slides into the water himself.',
    keywords: ['canal', 'helmet', 'rice field', 'toy boat', 'current'],
    prompts: [
      'What is he chasing down the canal?',
      'Is this a good idea? Why do you think he does it?',
    ],
  },
  {
    // source: pexels_18925870.mp4 (Pexels License)
    id: 'coaster-climb',
    src: '/videos/coaster-climb.mp4',
    poster: '/videos/coaster-climb.jpg',
    seconds: 16,
    alt: 'A roller coaster car full of people climbs a steep track up into a cloudy sky next to a big wheel.',
    keywords: ['roller coaster', 'steep track', 'big wheel', 'cloudy sky', 'people in the car'],
    prompts: [
      'What is about to happen to the people in the car?',
      'How do you think they feel at the very top?',
    ],
  },
  {
    // source: pexels_19901707.mp4 (Pexels License)
    id: 'coffee-cup-pour',
    src: '/videos/coffee-cup-pour.mp4',
    poster: '/videos/coffee-cup-pour.jpg',
    seconds: 14,
    alt: 'A hand pours coffee from one cup into another, and a lot of it splashes over onto the table.',
    keywords: ['coffee cup', 'hand pouring', 'splash', 'wet table', 'second cup'],
    prompts: [
      'What went wrong here?',
      'Tell the story: why was this person pouring the coffee?',
    ],
  },
  {
    // source: pexels_26761228.mp4 (Pexels License)
    id: 'wedding-dance-slip',
    src: '/videos/wedding-dance-slip.mp4',
    poster: '/videos/wedding-dance-slip.jpg',
    seconds: 16,
    alt: 'A groom spins his bride during their dance, she slips and sits down on the floor, and he holds his head.',
    keywords: ['bride', 'white dress', 'groom in a suit', 'shiny floor', 'hands on his head'],
    prompts: [
      'What happened in the middle of the dance?',
      'What do you think they said to each other after?',
    ],
  },
  {
    // source: pexels_33251033.mp4 (Pexels License)
    id: 'waves-rocks-splash',
    src: '/videos/waves-rocks-splash.mp4',
    poster: '/videos/waves-rocks-splash.jpg',
    seconds: 26,
    alt: 'Calm waves roll in, then a big one hits the red rocks and explodes into white spray.',
    keywords: ['waves', 'red rocks', 'white spray', 'sea', 'horizon'],
    prompts: [
      'Describe the sea before and after the big wave.',
      'Would you stand on these rocks? Why or why not?',
    ],
  },
  {
    // source: pexels_34466882.mp4 (Pexels License)
    id: 'stadium-goal-celebration',
    src: '/videos/stadium-goal-celebration.mp4',
    poster: '/videos/stadium-goal-celebration.jpg',
    seconds: 11,
    alt: 'Filmed from the stands, players run together to celebrate a goal while thousands of fans in red cheer.',
    keywords: ['stadium', 'football pitch', 'players celebrating', 'fans in red', 'scoreboard'],
    prompts: [
      'What just happened on the pitch?',
      'Describe the atmosphere in the stadium.',
    ],
  },
  {
    // source: pexels_34805837.mp4 (Pexels License)
    id: 'dice-knock',
    src: '/videos/dice-knock.mp4',
    poster: '/videos/dice-knock.jpg',
    seconds: 14,
    alt: 'Two red dice sit on a table; two more fall from above, bounce and knock into them.',
    keywords: ['red dice', 'white table', 'falling dice', 'bounce', 'dots'],
    prompts: [
      'What happens when the dice land?',
      'Which games do you play with dice?',
    ],
  },
  {
    // source: pexels_35124869.mp4 (Pexels License)
    id: 'kitten-under-sofa',
    src: '/videos/kitten-under-sofa.mp4',
    poster: '/videos/kitten-under-sofa.jpg',
    seconds: 20,
    alt: 'A white kitten hiding under a sofa plays with a pink fluffy toy, then runs out into the room.',
    keywords: ['white kitten', 'sofa', 'pink toy', 'carpet', 'hiding'],
    prompts: [
      'What is the kitten doing under the sofa?',
      'Where do you think it runs to at the end?',
    ],
  },
  {
    // source: pexels_38187890.mp4 (Pexels License)
    id: 'sizzling-pan-waiter',
    src: '/videos/sizzling-pan-waiter.mp4',
    poster: '/videos/sizzling-pan-waiter.jpg',
    seconds: 26,
    alt: 'A waiter with a red glove pours sauce into a sizzling pan at the table, and the guests film it on their phones.',
    keywords: ['waiter', 'red glove', 'sizzling pan', 'guests', 'phones'],
    prompts: [
      'What does the waiter do, step by step?',
      'Why are the guests filming it?',
    ],
  },
  {
    // source: pexels_4781511.mp4 (Pexels License)
    id: 'kitchen-pan-toss',
    src: '/videos/kitchen-pan-toss.mp4',
    poster: '/videos/kitchen-pan-toss.jpg',
    seconds: 13,
    alt: 'A young man cooks at the stove and tosses food in a pan while a friend behind him watches and laughs.',
    keywords: ['frying pan', 'stove', 'checked shirt', 'friend', 'kitchen'],
    prompts: [
      'What is he cooking, do you think?',
      'Who is better at cooking in your home?',
    ],
  },
  {
    // source: pexels_6864989.mp4 (Pexels License)
    id: 'cat-wand-toy',
    src: '/videos/cat-wand-toy.mp4',
    poster: '/videos/cat-wand-toy.jpg',
    seconds: 7,
    alt: 'A white cat on a wooden floor plays with a toy on a string and then walks off with it.',
    keywords: ['white cat', 'toy on a string', 'wooden floor', 'curtains', 'paws'],
    prompts: [
      'What does the cat do with the toy?',
      'Are cats or dogs better pets?',
    ],
  },
  {
    // source: pexels_7419682.mp4 (Pexels License)
    id: 'birthday-candles-kids',
    src: '/videos/birthday-candles-kids.mp4',
    poster: '/videos/birthday-candles-kids.jpg',
    seconds: 12,
    alt: 'A boy in party hats blows out the candles on doughnuts while the other children clap and cheer.',
    keywords: ['birthday candles', 'party hats', 'doughnuts', 'children', 'clapping'],
    prompts: [
      'What happens at this party?',
      'Tell about a birthday you remember.',
    ],
  },
  {
    // source: pexels_8500933.mp4 (Pexels License)
    id: 'penguin-drawing',
    src: '/videos/penguin-drawing.mp4',
    poster: '/videos/penguin-drawing.jpg',
    seconds: 10,
    alt: 'A child in a penguin costume proudly holds up a big drawing of a penguin and peeks out from behind it.',
    keywords: ['penguin costume', 'drawing', 'bright colours', 'child', 'wooden floor'],
    prompts: [
      'What did the child draw?',
      'What did you like to draw when you were small?',
    ],
  },
  {
    // source: pexels_9502511.mp4 (Pexels License)
    id: 'penalty-dive',
    src: '/videos/penalty-dive.mp4',
    poster: '/videos/penalty-dive.jpg',
    seconds: 9,
    alt: 'A player kicks a penalty and the goalkeeper dives but ends up lying on the grass.',
    keywords: ['football', 'goal', 'goalkeeper', 'kick', 'grass'],
    prompts: [
      'What happened with the penalty?',
      'How does the goalkeeper feel now?',
    ],
  },
  {
    // source: pexels_9787350.mp4 (Pexels License)
    id: 'friends-reunion-hug',
    src: '/videos/friends-reunion-hug.mp4',
    poster: '/videos/friends-reunion-hug.jpg',
    seconds: 15,
    alt: 'A woman runs up to her friend in the street and they hug for a long time, laughing.',
    keywords: ['hug', 'friends', 'street', 'headband', 'handbag'],
    prompts: [
      'How long do you think they have not seen each other?',
      'Tell about a time you met an old friend.',
    ],
  },];

// Which clips a topic gets lives in topicVideos.js, which
// scripts/assign_topic_videos.js generates from this deck — see
// utils/fetchTopicVideos.js.
export default describeVideos;
