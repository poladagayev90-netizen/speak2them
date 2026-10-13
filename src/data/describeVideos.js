// "Describe the video" deck — the moving-picture twin of describeImages.js.
//
// WHY VIDEO AT ALL: a photo is one frozen moment, so a learner can finish it in
// two sentences ("a man, a fish, a pier") and stop. A clip has a BEFORE and an
// AFTER, so the natural answer is a story — what he was doing, what went wrong,
// what happened next — which is the tense range the calls were missing.
//
// SELECTION RULE (same as the picture deck, one clip stricter): people or
// animals DOING something, a visible turn in the action, and nothing that
// depends on hearing the audio.
//
// SOUND (Polad, 2026-10-13): clips with `sound: true` carry their original
// audio (mono AAC 64k, loudness-normalised); the rest have no audio track.
// Every clip still STARTS muted (browsers refuse unmuted autoplay), and only
// ClipViewer — the topic sheet and the teacher library, web/PWA only — has a
// sound button. The call stage and the AInur session stay muted for good: in
// a call the clip would go into the microphone and Agora's echo filter would
// cut the partner; with AInur it would land in the transcript.
//
// FILES: local under public/videos/ — mp4, H.264, ~480px wide, audio only with `sound`,
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
// ANDROID (Polad, 2026-10-13): the Play build carries `licensed: true` (Pexels /
// CC0) AND `playOk: true` — clips of animals, or with nobody recognisable in
// them (point-of-view, an empty car park), that have been shared widely. Clips
// that show a recognisable person stay web-only — above all children and
// anyone who may be from Azerbaijan or Turkey, whose friends would know them.
// scripts/strip-native-videos.js keeps exactly these files in the APK/AAB.
//
// IDS ARE STORAGE KEYS (aiSessions itemId, lesson-style rule): add, never
// rename.
//
// LICENSE: `licensed: true` marks the clips whose licence allows them in the
// Play Store build (Pexels / CC0, commercial use). Only those ship in the
// Android app (scripts/strip-native-videos.js keeps their files, deletes the
// rest) and only those are shown there (videosForTopic). A clip from any other
// source stays web-only until its licence is clear.
export const describeVideos = [
  {
    // source: pexels_4253330.mp4 (CC0 Free Commercial License)
    id: 'chef-stir-fry',
    licensed: true,
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
    licensed: true,
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
    sound: true,
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
    sound: true,
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
    playOk: true,
    src: '/videos/gorilla-meet.mp4',
    poster: '/videos/gorilla-meet.jpg',
    seconds: 22,
    sound: true,
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
    playOk: true,
    src: '/videos/garden-camera.mp4',
    poster: '/videos/garden-camera.jpg',
    seconds: 21,
    sound: true,
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
    sound: true,
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
    playOk: true,
    src: '/videos/petting-hen.mp4',
    poster: '/videos/petting-hen.jpg',
    seconds: 17,
    sound: true,
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
    playOk: true,
    src: '/videos/leopard-road.mp4',
    poster: '/videos/leopard-road.jpg',
    seconds: 22,
    sound: true,
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
    sound: true,
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
    sound: true,
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
    playOk: true,
    src: '/videos/dream-fall.mp4',
    poster: '/videos/dream-fall.jpg',
    seconds: 14,
    sound: true,
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
    sound: true,
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
    sound: true,
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
    licensed: true,
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
    licensed: true,
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
    licensed: true,
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
    licensed: true,
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
    licensed: true,
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
    licensed: true,
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
    licensed: true,
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
    licensed: true,
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
    licensed: true,
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
    licensed: true,
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
    licensed: true,
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
    licensed: true,
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
    licensed: true,
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
    licensed: true,
    src: '/videos/friends-reunion-hug.mp4',
    poster: '/videos/friends-reunion-hug.jpg',
    seconds: 15,
    alt: 'A woman runs up to her friend in the street and they hug for a long time, laughing.',
    keywords: ['hug', 'friends', 'street', 'headband', 'handbag'],
    prompts: [
      'How long do you think they have not seen each other?',
      'Tell about a time you met an old friend.',
    ],
  },
  {
    // source: acrobat-handstand.mp4
    id: 'contortionist-heels',
    src: '/videos/contortionist-heels.mp4',
    poster: '/videos/contortionist-heels.jpg',
    seconds: 18,
    sound: true,
    alt: 'A contortionist in a black bodysuit bends backwards to the floor and puts on a pair of high-heeled shoes with her feet in the air.',
    keywords: ['contortionist', 'backbend', 'high heels', 'staircase', 'bare feet'],
    prompts: [
      'How does she put the shoes on? Tell it step by step.',
      'How much training do you think a trick like this takes?',
    ],
  },
  {
    // source: baby-calves-milk.mp4
    id: 'goat-calf-milk',
    playOk: true,
    src: '/videos/goat-calf-milk.mp4',
    poster: '/videos/goat-calf-milk.jpg',
    seconds: 10,
    sound: true,
    alt: 'A baby goat and a fluffy white calf drink milk side by side from metal feeding chutes in a barn, then wander off.',
    keywords: ['baby goat', 'fluffy calf', 'milk', 'metal chute', 'barn'],
    prompts: [
      'What are the two babies doing together?',
      'How are the two animals different from each other?',
    ],
  },
  {
    // source: baby-donkey-jump.mp4
    id: 'baby-donkey-jump',
    playOk: true,
    src: '/videos/baby-donkey-jump.mp4',
    poster: '/videos/baby-donkey-jump.jpg',
    seconds: 12,
    sound: true,
    alt: 'A small grey donkey foal bucks and kicks its back legs in a sandy yard, then trots up to the camera and sniffs it.',
    keywords: ['donkey foal', 'kicking', 'sandy yard', 'wooden fence', 'long ears'],
    prompts: [
      'Why is the little donkey jumping and kicking like that?',
      'What does it do when it comes close to the camera?',
    ],
  },
  {
    // source: baby-giraffe-hair.mp4
    id: 'baby-giraffe-hair',
    playOk: true,
    src: '/videos/baby-giraffe-hair.mp4',
    poster: '/videos/baby-giraffe-hair.jpg',
    seconds: 10,
    sound: true,
    alt: 'A baby giraffe with a funny tuft of dark hair on its head walks up to the camera in a stable and stares straight into it.',
    keywords: ['baby giraffe', 'tuft of hair', 'long neck', 'spots', 'stable'],
    prompts: [
      'What makes this young giraffe look funny?',
      'What do you think it is thinking when it looks at the camera?',
    ],
  },
  {
    // source: bear-water-hose.mp4
    id: 'bear-water-hose',
    playOk: true,
    src: '/videos/bear-water-hose.mp4',
    poster: '/videos/bear-water-hose.jpg',
    seconds: 18,
    sound: true,
    alt: 'A brown bear sits in a muddy puddle in the forest, plays with a water hose that sprays everywhere, then runs straight at the camera.',
    keywords: ['brown bear', 'muddy puddle', 'water hose', 'splashing', 'forest'],
    prompts: [
      'What is the bear doing with the hose?',
      'What happens at the end? How would you feel if you were filming?',
    ],
  },
  {
    // source: canopy-tree-climb.mp4
    id: 'canopy-tree-climb',
    playOk: true,
    src: '/videos/canopy-tree-climb.mp4',
    poster: '/videos/canopy-tree-climb.jpg',
    seconds: 26,
    sound: true,
    alt: 'Filmed from his own point of view, a barefoot man climbs a very tall tree above a green jungle, with the ground far below.',
    keywords: ['tree trunk', 'bare feet', 'jungle', 'climbing', 'branches'],
    prompts: [
      'How high up do you think he is?',
      'Would you ever climb a tree like this? Why or why not?',
    ],
  },
  {
    // source: dancing-lemur.mp4
    id: 'dancing-lemur',
    playOk: true,
    src: '/videos/dancing-lemur.mp4',
    poster: '/videos/dancing-lemur.jpg',
    seconds: 26,
    sound: true,
    alt: 'A white and brown sifaka lemur takes a piece of fruit, climbs a tree, then hops sideways along a forest path on two legs with its arms open.',
    keywords: ['lemur', 'hopping sideways', 'forest path', 'piece of fruit', 'open arms'],
    prompts: [
      'Describe the strange way this animal moves.',
      'What happens before it starts hopping?',
    ],
  },
  {
    // source: dog-wizard.mp4
    id: 'dog-wizard',
    playOk: true,
    src: '/videos/dog-wizard.mp4',
    poster: '/videos/dog-wizard.jpg',
    seconds: 14,
    sound: true,
    alt: 'A golden retriever dressed in a black hooded wizard cloak sits on rocks in a forest holding a wooden staff, while someone hangs an amulet on it.',
    keywords: ['wizard cloak', 'wooden staff', 'golden retriever', 'amulet', 'forest'],
    prompts: [
      'Why do you think the dog is dressed like this?',
      'Describe the dog\'s face and how it sits.',
    ],
  },
  {
    // source: ginger-trio.mp4
    id: 'ginger-trio',
    playOk: true,
    src: '/videos/ginger-trio.mp4',
    poster: '/videos/ginger-trio.jpg',
    seconds: 14,
    sound: true,
    alt: 'A ginger chick, a ginger kitten and a ginger rabbit sit side by side in the grass, and the kitten keeps looking at the others.',
    keywords: ['chick', 'kitten', 'rabbit', 'grass', 'side by side'],
    prompts: [
      'What three animals are sitting together here?',
      'Why is it surprising that they get along so well?',
    ],
  },
  {
    // source: hammock-highrise.mp4
    id: 'hammock-highrise',
    src: '/videos/hammock-highrise.mp4',
    poster: '/videos/hammock-highrise.jpg',
    seconds: 10,
    sound: true,
    alt: 'A man lies in a hammock tied between two tall apartment buildings, reading high above the street, next to laundry drying on a line.',
    keywords: ['hammock', 'apartment block', 'laundry', 'windows', 'reading'],
    prompts: [
      'How do you think he got the hammock up there?',
      'Would you ever lie in a hammock like this? Why or why not?',
    ],
  },
  {
    // source: hedgehog-run.mp4
    id: 'hedgehog-run',
    playOk: true,
    src: '/videos/hedgehog-run.mp4',
    poster: '/videos/hedgehog-run.jpg',
    seconds: 6,
    sound: true,
    alt: 'A tiny pet hedgehog runs fast across a wooden floor straight at the camera and bumps past it.',
    keywords: ['hedgehog', 'wooden floor', 'running', 'spines', 'tiny legs'],
    prompts: [
      'Where do you think the hedgehog is running to?',
      'Would a hedgehog be a good pet? Why?',
    ],
  },
  {
    // source: kittens-bottle-play.mp4
    id: 'kittens-bottle-play',
    playOk: true,
    src: '/videos/kittens-bottle-play.mp4',
    poster: '/videos/kittens-bottle-play.jpg',
    seconds: 8,
    sound: true,
    alt: 'A group of black-and-white kittens chase and bat a green plastic bottle across a wooden floor while an adult cat lies watching.',
    keywords: ['kittens', 'plastic bottle', 'rolling', 'wooden floor', 'chest of drawers'],
    prompts: [
      'How do the kittens react when the bottle rolls?',
      'What is the grown-up cat doing in the background?',
    ],
  },
  {
    // source: man-seagull-argument.mp4
    id: 'man-seagull-argument',
    src: '/videos/man-seagull-argument.mp4',
    poster: '/videos/man-seagull-argument.jpg',
    seconds: 6,
    sound: true,
    alt: 'A man in a cap and an orange shirt leans on a stone wall and waves his hands as if arguing with a seagull standing next to him.',
    keywords: ['seagull', 'orange shirt', 'stone wall', 'waving hands', 'cap'],
    prompts: [
      'What do you think the man is saying to the seagull?',
      'What would the seagull say back?',
    ],
  },
  {
    // source: moose-roadside.mp4
    id: 'moose-roadside',
    playOk: true,
    src: '/videos/moose-roadside.mp4',
    poster: '/videos/moose-roadside.jpg',
    seconds: 18,
    sound: true,
    alt: 'Filmed from a moving car, two huge moose walk along the grass beside a busy road while cars drive past.',
    keywords: ['moose', 'antlers', 'car window', 'roadside', 'pine trees'],
    prompts: [
      'How big do the animals look next to the cars?',
      'What should drivers do when wild animals are near the road?',
    ],
  },
  {
    // source: round-blue-bird.mp4
    id: 'round-blue-bird',
    playOk: true,
    src: '/videos/round-blue-bird.mp4',
    poster: '/videos/round-blue-bird.jpg',
    seconds: 13,
    sound: true,
    alt: 'A very round, fluffy blue and white bird sits on a thin branch in a garden and turns to show its bright blue tail.',
    keywords: ['round bird', 'blue feathers', 'thin branch', 'garden', 'brick wall'],
    prompts: [
      'Describe the bird\'s shape and colours.',
      'Is it a real bird or a toy? What makes you think so?',
    ],
  },
  {
    // source: toad-apple-bite.mp4
    id: 'tortoise-apple-bite',
    playOk: true,
    src: '/videos/tortoise-apple-bite.mp4',
    poster: '/videos/tortoise-apple-bite.jpg',
    seconds: 9,
    sound: true,
    alt: 'A small tortoise with orange spots, wearing a tiny backpack next to a toy truck, takes big bites from an apple slice someone holds out.',
    keywords: ['tortoise', 'apple slice', 'toy truck', 'tiny backpack', 'orange spots'],
    prompts: [
      'What is funny about how this tortoise is dressed?',
      'Describe how it eats the apple.',
    ],
  },
  {
    // source: woman-brick-wall.mp4
    id: 'grandma-brick-wall',
    src: '/videos/grandma-brick-wall.mp4',
    poster: '/videos/grandma-brick-wall.jpg',
    seconds: 16,
    sound: true,
    alt: 'An older woman in glasses and a flowery dress spreads mortar and lays bricks on a house wall, then gives the camera a thumbs up.',
    keywords: ['bricks', 'mortar', 'trowel', 'flowery dress', 'thumbs up'],
    prompts: [
      'What is she building? Tell it step by step.',
      'Why do you think she is doing this job herself?',
    ],
  },
  {
    // source: video_2026-09-30_21-09-23.mp4
    id: 'monkey-house-chase',
    src: '/videos/monkey-house-chase.mp4',
    poster: '/videos/monkey-house-chase.jpg',
    seconds: 7,
    sound: true,
    alt: 'A monkey walks into a living room by the sea, and a woman in a green top chases it out through the balcony door.',
    keywords: ['monkey', 'living room', 'balcony door', 'sea view', 'glass table'],
    prompts: [
      'How do you think the monkey got into the house?',
      'What would you do if an animal walked into your home?',
    ],
  },
  {
    // source: video_2026-09-30_21-09-28.mp4
    id: 'cat-under-car',
    src: '/videos/cat-under-car.mp4',
    poster: '/videos/cat-under-car.jpg',
    seconds: 11,
    sound: true,
    alt: 'A delivery rider pulls a cat out from under a parked car, but the cat rolls straight back to its spot on the road.',
    keywords: ['delivery rider', 'cat', 'parked car', 'number plate', 'rolling'],
    prompts: [
      'Why does the rider move the cat?',
      'What does the cat do after that? Why do you think it goes back?',
    ],
  },
  {
    // source: video_2026-09-30_21-09-30.mp4
    id: 'fridge-on-back',
    src: '/videos/fridge-on-back.mp4',
    poster: '/videos/fridge-on-back.jpg',
    seconds: 21,
    sound: true,
    alt: 'A man in a red shirt takes a big fridge off a lorry, lifts it onto his back and carries it down the street alone.',
    keywords: ['fridge', 'lorry', 'red shirt', 'carrying', 'street'],
    prompts: [
      'How does he get the fridge off the lorry? Tell it step by step.',
      'Could you carry something this heavy? What would you use?',
    ],
  },
  {
    // source: video_2026-09-30_21-09-32.mp4
    id: 'fish-tank-fall',
    src: '/videos/fish-tank-fall.mp4',
    poster: '/videos/fish-tank-fall.jpg',
    seconds: 26,
    sound: true,
    alt: 'A man in a work uniform leans into a big fish tank to catch a fish, loses his balance and falls in head first, then climbs out and waves.',
    keywords: ['fish tank', 'uniform', 'leaning over', 'splash', 'soaking wet'],
    prompts: [
      'What was he trying to do before he fell?',
      'How do you think he felt after he climbed out?',
    ],
  },
  {
    // source: video_2026-09-30_21-09-34.mp4
    id: 'cat-dump-truck',
    playOk: true,
    src: '/videos/cat-dump-truck.mp4',
    poster: '/videos/cat-dump-truck.jpg',
    seconds: 12,
    sound: true,
    alt: 'A ginger cat rides in the back of a toy dump truck across a shiny floor and straight into a cardboard box.',
    keywords: ['ginger cat', 'toy truck', 'cardboard box', 'shiny floor', 'riding'],
    prompts: [
      'Where is the cat going, and how does it get there?',
      'Why do you think the cat sits so calmly?',
    ],
  },
  {
    // source: video_2026-09-30_21-09-40.mp4
    id: 'fairy-door-cats',
    playOk: true,
    src: '/videos/fairy-door-cats.mp4',
    poster: '/videos/fairy-door-cats.jpg',
    seconds: 12,
    sound: true,
    alt: 'Someone knocks on a tiny door in a big tree, and one by one, kittens holding bunches of flowers come out and line up.',
    keywords: ['tiny door', 'tree trunk', 'knocking', 'kittens', 'bunches of flowers'],
    prompts: [
      'What happens after the knock? Tell it in order.',
      'Who do you think the flowers are for?',
    ],
  },
  {
    // source: video_2026-09-30_21-09-43.mp4
    id: 'snow-slip',
    src: '/videos/snow-slip.mp4',
    poster: '/videos/snow-slip.jpg',
    seconds: 16,
    sound: true,
    alt: 'On a bright street at night, a woman slips on the icy path and falls into a pile of snow while people walk past.',
    keywords: ['icy street', 'snow pile', 'slipping', 'lights', 'winter coat'],
    prompts: [
      'What happened to her? Describe it step by step.',
      'Have you ever slipped on ice or snow? What happened?',
    ],
  },
  {
    // source: video_2026-09-30_21-09-45.mp4
    id: 'sloth-dashboard',
    playOk: true,
    src: '/videos/sloth-dashboard.mp4',
    poster: '/videos/sloth-dashboard.jpg',
    seconds: 17,
    sound: true,
    alt: 'A sloth lies stretched out on the dashboard of a lorry driving down a motorway on a sunny day.',
    keywords: ['sloth', 'dashboard', 'motorway', 'steering wheel', 'long claws'],
    prompts: [
      'Why do you think the sloth is in the lorry?',
      'Where could they be going together?',
    ],
  },
  {
    // source: video_2026-09-30_21-09-46.mp4
    id: 'boulder-push',
    src: '/videos/boulder-push.mp4',
    poster: '/videos/boulder-push.jpg',
    seconds: 10,
    sound: true,
    alt: 'A man sitting on a steep hillside pushes a big rock with his feet, and it crashes down through the bushes towards the camera.',
    keywords: ['big rock', 'hillside', 'pushing', 'bushes', 'dust'],
    prompts: [
      'What does the man do, and what happens next?',
      'Was this a good idea? Why or why not?',
    ],
  },
  {
    // source: video_2026-09-30_21-09-53.mp4
    id: 'cat-wall-jump',
    playOk: true,
    src: '/videos/cat-wall-jump.mp4',
    poster: '/videos/cat-wall-jump.jpg',
    seconds: 9,
    sound: true,
    alt: 'A cat runs across a big empty room, jumps high up the wall and flies back through the air.',
    keywords: ['cat', 'empty room', 'jumping', 'wall', 'television'],
    prompts: [
      'What do you think the cat was trying to catch?',
      'Describe the jump from start to finish.',
    ],
  },
  {
    // source: video_2026-09-30_21-09-57.mp4
    id: 'turtles-log',
    playOk: true,
    src: '/videos/turtles-log.mp4',
    poster: '/videos/turtles-log.jpg',
    seconds: 17,
    sound: true,
    alt: 'A row of turtles climbs onto a floating log in a green pond, and the log tips and rolls as they try to stay on.',
    keywords: ['turtles', 'floating log', 'pond', 'balance', 'row'],
    prompts: [
      'What happens to the log when more turtles climb on?',
      'Why do you think turtles like to sit on logs?',
    ],
  },
  {
    // source: video_2026-09-30_21-10-00.mp4
    id: 'cat-washing-machine',
    playOk: true,
    src: '/videos/cat-washing-machine.mp4',
    poster: '/videos/cat-washing-machine.jpg',
    seconds: 7,
    sound: true,
    alt: 'A fluffy ginger cat stands at a washing machine and paws at the glass door while the clothes spin inside.',
    keywords: ['washing machine', 'ginger cat', 'paws', 'spinning', 'clothes'],
    prompts: [
      'What does the cat think it is doing?',
      'Why do cats love watching things that move?',
    ],
  },
  {
    // source: video_2026-09-30_21-10-01.mp4
    id: 'squirrel-fountain',
    playOk: true,
    src: '/videos/squirrel-fountain.mp4',
    poster: '/videos/squirrel-fountain.jpg',
    seconds: 14,
    sound: true,
    alt: 'In a park, a squirrel climbs onto a drinking fountain and drinks from the stream of water like a person.',
    keywords: ['squirrel', 'drinking fountain', 'park', 'stream of water', 'bushy tail'],
    prompts: [
      'How does the squirrel drink the water?',
      'What other clever things have you seen animals do?',
    ],
  },
  {
    // source: video_2026-09-30_21-10-06.mp4
    id: 'runaway-cart',
    playOk: true,
    src: '/videos/runaway-cart.mp4',
    poster: '/videos/runaway-cart.jpg',
    seconds: 13,
    sound: true,
    alt: 'On a rainy, windy day, an empty shopping trolley rolls across a car park towards the parked cars, filmed from inside a car.',
    keywords: ['shopping trolley', 'car park', 'rain', 'wind', 'parked cars'],
    prompts: [
      'Where is the trolley going? What might happen?',
      'What would you do if you saw this?',
    ],
  },
  {
    // source: video_2026-09-30_21-10-08.mp4
    id: 'cat-steals-fish',
    src: '/videos/cat-steals-fish.mp4',
    poster: '/videos/cat-steals-fish.jpg',
    seconds: 17,
    sound: true,
    alt: 'While a man fishes by the sea, a cat puts its head in his bucket, takes a fish and runs off with it past the people walking by.',
    keywords: ['fisherman', 'fishing rod', 'bucket', 'cat', 'seafront'],
    prompts: [
      'What does the cat do while the man is busy?',
      'Should the man be angry? Why or why not?',
    ],
  },
  {
    // source: video_2026-10-13_11-06-27.mp4
    id: 'squirrel-door-jump',
    playOk: true,
    src: '/videos/squirrel-door-jump.mp4',
    poster: '/videos/squirrel-door-jump.jpg',
    seconds: 16,
    sound: true,
    alt: 'A squirrel holds on to the glass of an open garden door and looks in, then suddenly jumps straight at the camera.',
    keywords: ['squirrel', 'glass door', 'garden', 'handle', 'jump'],
    prompts: [
      'What do you think the squirrel wants?',
      'What would you do if it jumped into your room?',
    ],
  },
  {
    // source: video_2026-10-13_11-06-29.mp4
    id: 'dog-closes-curtain',
    playOk: true,
    src: '/videos/dog-closes-curtain.mp4',
    poster: '/videos/dog-closes-curtain.jpg',
    seconds: 10,
    sound: true,
    alt: 'At night the camera zooms into a lit window of a block of flats: a dog in glasses sits at a computer, sees the camera and pulls the curtain shut.',
    keywords: ['window', 'glasses', 'computer', 'office chair', 'curtain'],
    prompts: [
      'What is the dog doing so late at night?',
      'Why does it close the curtain?',
    ],
  },
  {
    // source: video_2026-10-13_11-06-31.mp4
    id: 'cat-by-the-pot',
    playOk: true,
    src: '/videos/cat-by-the-pot.mp4',
    poster: '/videos/cat-by-the-pot.jpg',
    seconds: 16,
    sound: true,
    alt: 'A ginger cat jumps down from a cooking pot, then sits beside it and stares at the camera with big round eyes, while another cat watches from behind.',
    keywords: ['ginger cat', 'pot', 'lid', 'big eyes', 'window'],
    prompts: [
      'What was the cat doing before the camera came?',
      'How does the cat look now: guilty or innocent?',
    ],
  },
  {
    // source: video_2026-10-13_11-06-36.mp4
    id: 'pool-fall',
    src: '/videos/pool-fall.mp4',
    poster: '/videos/pool-fall.jpg',
    seconds: 26,
    sound: true,
    alt: 'A security camera shows two men carrying an air conditioner along the edge of a swimming pool; one of them steps back and falls into the water.',
    keywords: ['swimming pool', 'air conditioner', 'carry', 'ladder', 'security camera'],
    prompts: [
      'What went wrong? Tell the story step by step.',
      'What does the other man do after the fall?',
    ],
  },
  {
    // source: video_2026-10-13_11-06-42.mp4
    id: 'horse-carrot-stick',
    src: '/videos/horse-carrot-stick.mp4',
    poster: '/videos/horse-carrot-stick.jpg',
    seconds: 10,
    sound: true,
    alt: 'Outside a wooden stable, a little girl holds out a carrot on a long stick and a horse leans out of its window to eat it.',
    keywords: ['stable', 'horse', 'carrot', 'stick', 'little girl'],
    prompts: [
      'Why does the girl use a long stick?',
      'Have you ever fed an animal? What happened?',
    ],
  },
  {
    // source: video_2026-10-13_11-06-46.mp4
    id: 'dog-cat-walk',
    playOk: true,
    src: '/videos/dog-cat-walk.mp4',
    poster: '/videos/dog-cat-walk.jpg',
    seconds: 26,
    sound: true,
    alt: 'A black dog and a grey cat meet in the grass and then walk off together down a long gravel path, side by side.',
    keywords: ['black dog', 'grey cat', 'gravel path', 'grass', 'walk away'],
    prompts: [
      'Where do you think the two friends are going?',
      'Why are cats and dogs usually not friends?',
    ],
  },
  {
    // source: video_2026-10-13_11-06-49.mp4
    id: 'cat-merry-go-round',
    playOk: true,
    src: '/videos/cat-merry-go-round.mp4',
    poster: '/videos/cat-merry-go-round.jpg',
    seconds: 9,
    sound: true,
    alt: 'A white cat lies on its back on a spinning blue merry-go-round in a playground, paws in the air, going round and round.',
    keywords: ['playground', 'merry-go-round', 'white cat', 'upside down', 'spin'],
    prompts: [
      'How does the cat feel? How do you know?',
      'Who started the merry-go-round, do you think?',
    ],
  },
  {
    // source: video_2026-10-13_11-06-51.mp4
    id: 'bear-apple-tree',
    playOk: true,
    src: '/videos/bear-apple-tree.mp4',
    poster: '/videos/bear-apple-tree.jpg',
    seconds: 9,
    sound: true,
    alt: 'In a quiet street with houses and a rainbow above, a brown bear sits high in an apple tree, eating the red apples.',
    keywords: ['bear', 'apple tree', 'apples', 'branch', 'rainbow'],
    prompts: [
      'How did the bear get there, and how will it get down?',
      'What should the people living here do?',
    ],
  },
  {
    // source: cake-dog-lick.mp4
    id: 'cake-dog-lick',
    licensed: true,
    ai: true,
    src: '/videos/cake-dog-lick.mp4',
    poster: '/videos/cake-dog-lick.jpg',
    seconds: 8,
    sound: true,
    alt: 'A small dog jumps up to a birthday cake with candles and licks the cream while the family comes back into the room.',
    keywords: ['birthday cake', 'candles', 'small dog', 'cream', 'family'],
    prompts: [
      'What did the dog do to the cake?',
      'What should the family do now — eat the cake or not?',
    ],
  },
  {
    // source: cat-glass-push.mp4
    id: 'cat-glass-push',
    licensed: true,
    ai: true,
    src: '/videos/cat-glass-push.mp4',
    poster: '/videos/cat-glass-push.jpg',
    seconds: 8,
    sound: true,
    alt: 'A cat looks at the camera and slowly pushes a glass of water off the kitchen table with its paw.',
    keywords: ['cat', 'glass of water', 'paw', 'kitchen table', 'edge'],
    prompts: [
      'How did the cat move the glass?',
      'Why do you think cats like to push things off tables?',
    ],
  },
  {
    // source: dog-cushion-caught.mp4
    id: 'dog-cushion-caught',
    licensed: true,
    ai: true,
    src: '/videos/dog-cushion-caught.mp4',
    poster: '/videos/dog-cushion-caught.jpg',
    seconds: 8,
    sound: true,
    alt: 'A dog alone at home rips a sofa cushion apart, feathers fly, and it lies down innocently when the owner walks in.',
    keywords: ['dog', 'cushion', 'feathers', 'sofa', 'front door'],
    prompts: [
      'What was the dog doing before the door opened?',
      'What do you think the owner said when she saw the room?',
    ],
  },
  {
    // source: goat-car-roof.mp4
    id: 'goat-car-roof',
    licensed: true,
    ai: true,
    src: '/videos/goat-car-roof.mp4',
    poster: '/videos/goat-car-roof.jpg',
    seconds: 8,
    sound: true,
    alt: 'A goat jumps onto a parked car, climbs onto the roof and stands there while a farmer waves her arms.',
    keywords: ['goat', 'car roof', 'farmer', 'barn', 'bonnet'],
    prompts: [
      'How did the goat get onto the roof?',
      'What would you do if you were the farmer?',
    ],
  },
  {
    // source: robot-vacuum-cat.mp4
    id: 'robot-vacuum-cat',
    licensed: true,
    ai: true,
    src: '/videos/robot-vacuum-cat.mp4',
    poster: '/videos/robot-vacuum-cat.jpg',
    seconds: 8,
    sound: true,
    alt: 'A cat rides on a robot vacuum cleaner until the robot hits a wall and the cat slides off onto the floor.',
    keywords: ['cat', 'robot vacuum', 'wall', 'wooden floor', 'ride'],
    prompts: [
      'What happened when the robot hit the wall?',
      'Do you have a robot vacuum or a pet at home? What do they do?',
    ],
  },
  {
    // source: seagull-pizza.mp4
    id: 'seagull-pizza',
    licensed: true,
    ai: true,
    src: '/videos/seagull-pizza.mp4',
    poster: '/videos/seagull-pizza.jpg',
    seconds: 8,
    sound: true,
    alt: 'A seagull lands on a doorstep, opens a pizza box with its beak and flies away with a slice.',
    keywords: ['seagull', 'pizza box', 'doormat', 'front door', 'slice of pizza'],
    prompts: [
      'What did the seagull do, step by step?',
      'Who do you think ordered the pizza, and how did they feel when they opened the door?',
    ],
  },
  {
    // source: umbrella-wind.mp4
    id: 'umbrella-wind',
    licensed: true,
    ai: true,
    src: '/videos/umbrella-wind.mp4',
    poster: '/videos/umbrella-wind.jpg',
    seconds: 8,
    sound: true,
    alt: 'On a rainy, windy street the wind turns a man’s umbrella inside out and blows it away, and he runs after it.',
    keywords: ['umbrella', 'rain', 'wind', 'street', 'puddles'],
    prompts: [
      'What did the wind do to the umbrella?',
      'What is the worst weather you have been out in?',
    ],
  },
  {
    // source: waiter-tray-save.mp4
    id: 'waiter-tray-save',
    licensed: true,
    ai: true,
    src: '/videos/waiter-tray-save.mp4',
    poster: '/videos/waiter-tray-save.jpg',
    seconds: 8,
    sound: true,
    alt: 'A waiter in a busy café trips while carrying a tray of glasses, catches them all, and the customers clap.',
    keywords: ['waiter', 'tray', 'glasses', 'apron', 'customers'],
    prompts: [
      'What almost happened to the glasses?',
      'Have you ever dropped something in public? What happened?',
    ],
  },
];

// Which clips a topic gets lives in topicVideos.js, which
// scripts/assign_topic_videos.js generates from this deck — see
// utils/fetchTopicVideos.js.
export default describeVideos;
