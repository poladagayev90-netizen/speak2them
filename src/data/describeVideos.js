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
  },
  {
    // source: acrobat-handstand.mp4
    id: 'contortionist-heels',
    src: '/videos/contortionist-heels.mp4',
    poster: '/videos/contortionist-heels.jpg',
    seconds: 18,
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
    src: '/videos/goat-calf-milk.mp4',
    poster: '/videos/goat-calf-milk.jpg',
    seconds: 10,
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
    src: '/videos/baby-donkey-jump.mp4',
    poster: '/videos/baby-donkey-jump.jpg',
    seconds: 12,
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
    src: '/videos/baby-giraffe-hair.mp4',
    poster: '/videos/baby-giraffe-hair.jpg',
    seconds: 10,
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
    src: '/videos/bear-water-hose.mp4',
    poster: '/videos/bear-water-hose.jpg',
    seconds: 18,
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
    src: '/videos/canopy-tree-climb.mp4',
    poster: '/videos/canopy-tree-climb.jpg',
    seconds: 26,
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
    src: '/videos/dancing-lemur.mp4',
    poster: '/videos/dancing-lemur.jpg',
    seconds: 26,
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
    src: '/videos/dog-wizard.mp4',
    poster: '/videos/dog-wizard.jpg',
    seconds: 14,
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
    src: '/videos/ginger-trio.mp4',
    poster: '/videos/ginger-trio.jpg',
    seconds: 14,
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
    src: '/videos/hedgehog-run.mp4',
    poster: '/videos/hedgehog-run.jpg',
    seconds: 6,
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
    src: '/videos/kittens-bottle-play.mp4',
    poster: '/videos/kittens-bottle-play.jpg',
    seconds: 8,
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
    src: '/videos/moose-roadside.mp4',
    poster: '/videos/moose-roadside.jpg',
    seconds: 18,
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
    src: '/videos/round-blue-bird.mp4',
    poster: '/videos/round-blue-bird.jpg',
    seconds: 13,
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
    src: '/videos/tortoise-apple-bite.mp4',
    poster: '/videos/tortoise-apple-bite.jpg',
    seconds: 9,
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
    alt: 'An older woman in glasses and a flowery dress spreads mortar and lays bricks on a house wall, then gives the camera a thumbs up.',
    keywords: ['bricks', 'mortar', 'trowel', 'flowery dress', 'thumbs up'],
    prompts: [
      'What is she building? Tell it step by step.',
      'Why do you think she is doing this job herself?',
    ],
  },];

// Which clips a topic gets lives in topicVideos.js, which
// scripts/assign_topic_videos.js generates from this deck — see
// utils/fetchTopicVideos.js.
export default describeVideos;
