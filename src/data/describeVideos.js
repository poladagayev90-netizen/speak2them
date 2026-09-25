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
    // source: pexels_6683374.mp4 (CC0 Free Commercial License)
    id: 'barista-latte-art',
    src: '/videos/barista-latte-art.mp4',
    poster: '/videos/barista-latte-art.jpg',
    seconds: 10,
    alt: 'A barista steams milk and carefully pours delicate leaf pattern latte art into a ceramic cup.',
    keywords: ["barista","steamed milk","latte art","ceramic cup","coffee counter"],
    prompts: [
      'What pattern did the barista create in the cup?',
      'Do you care about presentation when you order a drink?',
    ],
  },
  {
    // source: pexels_35487051.mp4 (CC0 Free Commercial License)
    id: 'pottery-clay-wheel',
    src: '/videos/pottery-clay-wheel.mp4',
    poster: '/videos/pottery-clay-wheel.jpg',
    seconds: 11,
    alt: 'A potter shapes wet grey clay on a spinning wheel, smoothing the rim with wet fingers.',
    keywords: ["potter wheel","wet clay","shaping vase","spinning wheel","artisan hands"],
    prompts: [
      'What is the craftsperson making on the wheel?',
      'Have you ever tried making something by hand with clay?',
    ],
  },
  {
    // source: pexels_8103500.mp4 (CC0 Free Commercial License)
    id: 'acoustic-guitar-park',
    src: '/videos/acoustic-guitar-park.mp4',
    poster: '/videos/acoustic-guitar-park.jpg',
    seconds: 15,
    alt: 'A musician sits on a park bench gently fingerpicking chords on a wooden acoustic guitar.',
    keywords: ["acoustic guitar","fingerpicking","park bench","wooden guitar","relaxed posture"],
    prompts: [
      'Where is the musician playing and what is the atmosphere like?',
      'Can you play any musical instruments or would you like to learn?',
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
    // source: video_2026-09-22_00-22-03.mp4
    id: 'kangaroo-fence',
    src: '/videos/kangaroo-fence.mp4',
    poster: '/videos/kangaroo-fence.jpg',
    seconds: 11,
    alt: 'A muscular red kangaroo stands upright against a wire fence and stares at the camera while others graze behind it.',
    keywords: ['kangaroo', 'wire fence', 'stand upright', 'muscles', 'stare'],
    prompts: [
      'What does the kangaroo want from the person filming?',
      'Does it look friendly or dangerous? Say why.',
    ],
  },
  {
    // source: video_2026-09-22_00-22-09.mp4
    id: 'kangaroo-birds',
    src: '/videos/kangaroo-birds.mp4',
    poster: '/videos/kangaroo-birds.jpg',
    seconds: 8,
    alt: 'A kangaroo stands alone in a wide green field at the edge of a forest while white birds fly around it.',
    keywords: ['kangaroo', 'open field', 'white birds', 'treeline', 'sunny'],
    prompts: [
      'Where in the world is this, do you think?',
      'What is the kangaroo watching?',
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
    // source: video_2026-09-22_00-22-19.mp4
    id: 'eagle-field',
    src: '/videos/eagle-field.mp4',
    poster: '/videos/eagle-field.jpg',
    seconds: 13,
    alt: 'A golden eagle lands on a low mound in an empty field near the sea, folds its wings, looks around and flies off.',
    keywords: ['eagle', 'spread wings', 'mound', 'open field', 'take off'],
    prompts: [
      'What has the eagle come down for?',
      'What do you notice about its wings?',
    ],
  },
  {
    // source: video_2026-09-22_00-22-21.mp4
    id: 'rain-drive',
    src: '/videos/rain-drive.mp4',
    poster: '/videos/rain-drive.jpg',
    seconds: 24,
    alt: 'From inside a car: traffic crawls through heavy rain at a junction, brake lights blur and the wipers sweep the windscreen.',
    keywords: ['heavy rain', 'brake lights', 'wipers', 'traffic lights', 'windscreen'],
    prompts: [
      'How does the driver feel right now?',
      'Describe the weather without using the word “rain”.',
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
];

// Which clips a topic gets lives in topicVideos.js, which
// scripts/assign_topic_videos.js generates from this deck — see
// utils/fetchTopicVideos.js.
export default describeVideos;
