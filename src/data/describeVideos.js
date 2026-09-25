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
  {
    // source: pexels_11798539.mp4 (Pexels License)
    id: 'street-bike-repair',
    src: '/videos/street-bike-repair.mp4',
    poster: '/videos/street-bike-repair.jpg',
    seconds: 11,
    alt: 'A man squats on the pavement and fixes a bicycle wheel while people walk past behind him.',
    keywords: ['bicycle wheel', 'tools on the ground', 'squatting man', 'pavement', 'people passing'],
    prompts: [
      'What is wrong with the bicycle, do you think?',
      'Tell the story: how did this man end up fixing it here?',
    ],
  },
  {
    // source: pexels_12879700.mp4 (Pexels License)
    id: 'brick-wall-selfie',
    src: '/videos/brick-wall-selfie.mp4',
    poster: '/videos/brick-wall-selfie.jpg',
    seconds: 10,
    alt: 'Two friends lean on a brick wall, pose for a selfie, then look at the photo together and laugh.',
    keywords: ['brick wall', 'phone held high', 'yellow backpack', 'big smiles', 'looking at the photo'],
    prompts: [
      'What happens before and after they take the photo?',
      'Do you think they liked the picture? Why?',
    ],
  },
  {
    // source: pexels_13456803.mp4 (Pexels License)
    id: 'hand-tractor-field',
    src: '/videos/hand-tractor-field.mp4',
    poster: '/videos/hand-tractor-field.jpg',
    seconds: 6,
    alt: 'A farmer walks behind a small red hand tractor as it ploughs a dry field and throws up dust.',
    keywords: ['red machine', 'dry field', 'cloud of dust', 'farmer walking', 'trees behind'],
    prompts: [
      'What is the farmer doing, step by step?',
      'How do you think this field will look in three months?',
    ],
  },
  {
    // source: pexels_18477437.mp4 (Pexels License)
    id: 'traffic-jam-aerial',
    src: '/videos/traffic-jam-aerial.mp4',
    poster: '/videos/traffic-jam-aerial.jpg',
    seconds: 15,
    alt: 'Seen from above, hundreds of cars stand in a long traffic jam on a city road with tall buildings in the haze.',
    keywords: ['traffic jam', 'red brake lights', 'yellow bus', 'tall buildings', 'hazy sky'],
    prompts: [
      'Describe the road and the cars from top to bottom.',
      'What time of day is it, and where are these people going?',
    ],
  },
  {
    // source: pexels_18552655.mp4 (Pexels License)
    id: 'metro-platform-crowd',
    src: '/videos/metro-platform-crowd.mp4',
    poster: '/videos/metro-platform-crowd.jpg',
    seconds: 22,
    alt: 'Passengers get off a metro train and walk along the platform towards the camera.',
    keywords: ['metro platform', 'train doors', 'people walking', 'backpack', 'orange jacket'],
    prompts: [
      'Describe three different people you see.',
      'Where are they all going in such a hurry?',
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
    // source: pexels_26632129.mp4 (Pexels License)
    id: 'police-traffic-hand',
    src: '/videos/police-traffic-hand.mp4',
    poster: '/videos/police-traffic-hand.jpg',
    seconds: 16,
    alt: 'A police officer in a white helmet stands in a crossroads and waves the cars through with his arm.',
    keywords: ['police officer', 'white helmet', 'crossroads', 'passing car', 'pink shop front'],
    prompts: [
      'What is the officer telling the drivers to do?',
      'Why is there no traffic light, do you think?',
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
    // source: pexels_32386532.mp4 (Pexels License)
    id: 'robot-arm-factory',
    src: '/videos/robot-arm-factory.mp4',
    poster: '/videos/robot-arm-factory.jpg',
    seconds: 9,
    alt: 'A yellow robot arm in a bright factory picks up a part and moves it to the next machine.',
    keywords: ['robot arm', 'yellow', 'factory', 'machines', 'bright lights'],
    prompts: [
      'Describe what the robot does, from start to finish.',
      'What do you think the factory makes?',
    ],
  },
  {
    // source: pexels_32560315.mp4 (Pexels License)
    id: 'festival-line-dance',
    src: '/videos/festival-line-dance.mp4',
    poster: '/videos/festival-line-dance.jpg',
    seconds: 12,
    alt: 'At an outdoor festival, a line of dancers in white costumes moves through the crowd while people watch and film.',
    keywords: ['dancers in white', 'crowd', 'festival tent', 'people filming', 'sandy ground'],
    prompts: [
      'What is happening at this festival?',
      'Is it a special day? What might they be celebrating?',
    ],
  },
  {
    // source: pexels_32701984.mp4 (Pexels License)
    id: 'vinyl-record-crate',
    src: '/videos/vinyl-record-crate.mp4',
    poster: '/videos/vinyl-record-crate.jpg',
    seconds: 6,
    alt: 'A hand flicks through old vinyl records in a crate at a market, looking for one to buy.',
    keywords: ['vinyl records', 'crate', 'hand', 'album covers', 'market stall'],
    prompts: [
      'What is this person looking for?',
      'Why do some people still buy old records?',
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
    // source: pexels_34993441.mp4 (Pexels License)
    id: 'counting-banknotes',
    src: '/videos/counting-banknotes.mp4',
    poster: '/videos/counting-banknotes.jpg',
    seconds: 26,
    alt: 'Hands count a thick pile of banknotes one by one and put them down on the table.',
    keywords: ['banknotes', 'hands', 'pile of money', 'counting', 'table'],
    prompts: [
      'Whose money is this, and what is it for?',
      'Tell a story: what happens after the counting?',
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
    // source: pexels_35424512.mp4 (Pexels License)
    id: 'red-skirt-dancers',
    src: '/videos/red-skirt-dancers.mp4',
    poster: '/videos/red-skirt-dancers.jpg',
    seconds: 17,
    alt: 'Dancers in long red skirts with ribbons and tambourines walk and dance down a street in a parade.',
    keywords: ['red skirts', 'ribbons', 'tambourine', 'street', 'parade'],
    prompts: [
      'Describe the costumes as carefully as you can.',
      'What kind of celebration could this be?',
    ],
  },
  {
    // source: pexels_35868164.mp4 (Pexels License)
    id: 'knitting-hands',
    src: '/videos/knitting-hands.mp4',
    poster: '/videos/knitting-hands.jpg',
    seconds: 15,
    alt: 'An older woman\'s hands knit a brown scarf with two needles, stitch after stitch.',
    keywords: ['hands', 'knitting needles', 'wool', 'brown scarf', 'stitches'],
    prompts: [
      'What is she making, and who is it for?',
      'Has anyone in your family ever made you something by hand?',
    ],
  },
  {
    // source: pexels_3704774.mp4 (Pexels License)
    id: 'pancake-flip',
    src: '/videos/pancake-flip.mp4',
    poster: '/videos/pancake-flip.jpg',
    seconds: 26,
    alt: 'Someone cooks small pancakes in a pan and turns each one over with a fork.',
    keywords: ['pancakes', 'frying pan', 'fork', 'batter', 'gas stove'],
    prompts: [
      'Explain how to make these pancakes.',
      'What would you put on them?',
    ],
  },
  {
    // source: pexels_37284465.mp4 (Pexels License)
    id: 'fish-market-stall',
    src: '/videos/fish-market-stall.mp4',
    poster: '/videos/fish-market-stall.jpg',
    seconds: 12,
    alt: 'A seller sits behind a table covered with big fresh fish at an outdoor market.',
    keywords: ['fish', 'seller', 'market table', 'orange cloth', 'plastic crates'],
    prompts: [
      'Would you buy fish here? Why or why not?',
      'Describe the seller and his stall.',
    ],
  },
  {
    // source: pexels_3778979.mp4 (Pexels License)
    id: 'playground-swings',
    src: '/videos/playground-swings.mp4',
    poster: '/videos/playground-swings.jpg',
    seconds: 25,
    alt: 'A mother pushes a boy on a swing while another boy stands on the next swing in a sunny park.',
    keywords: ['swings', 'playground', 'mother', 'boy', 'trees'],
    prompts: [
      'What are the children doing?',
      'What games did you play in the park as a child?',
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
    // source: pexels_38537489.mp4 (Pexels License)
    id: 'street-guitar-busker',
    src: '/videos/street-guitar-busker.mp4',
    poster: '/videos/street-guitar-busker.jpg',
    seconds: 14,
    alt: 'A man plays a guitar on a busy city street while people walk past him.',
    keywords: ['guitar', 'street musician', 'people walking', 'old building', 'pavement'],
    prompts: [
      'Does anyone stop to listen? Describe the people.',
      'Would you give him money? Why?',
    ],
  },
  {
    // source: pexels_39122725.mp4 (Pexels License)
    id: 'bench-by-sea',
    src: '/videos/bench-by-sea.mp4',
    poster: '/videos/bench-by-sea.jpg',
    seconds: 10,
    alt: 'A person sits alone on a red bench by the sea, looking at the water and the hills.',
    keywords: ['red bench', 'sea', 'person alone', 'hills', 'flag'],
    prompts: [
      'What do you think this person is thinking about?',
      'Do you like being alone sometimes? Where do you go?',
    ],
  },
  {
    // source: pexels_39567655.mp4 (Pexels License)
    id: 'rainy-market-street',
    src: '/videos/rainy-market-street.mp4',
    poster: '/videos/rainy-market-street.jpg',
    seconds: 18,
    alt: 'Two women with umbrellas walk down a narrow rainy street past flower stalls and busy cafes.',
    keywords: ['umbrellas', 'rain', 'flower stall', 'cafe', 'narrow street'],
    prompts: [
      'Describe the street as they walk through it.',
      'Where are these two women going?',
    ],
  },
  {
    // source: pexels_4554447.mp4 (Pexels License)
    id: 'moving-in-boxes',
    src: '/videos/moving-in-boxes.mp4',
    poster: '/videos/moving-in-boxes.jpg',
    seconds: 26,
    alt: 'A couple carries cardboard boxes into an empty kitchen and stacks them on the floor.',
    keywords: ['cardboard boxes', 'couple', 'kitchen', 'carrying', 'windows'],
    prompts: [
      'What is happening in this home?',
      'What is the first thing you unpack when you move?',
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
    // source: pexels_5642849.mp4 (Pexels License)
    id: 'elderly-arm-in-arm',
    src: '/videos/elderly-arm-in-arm.mp4',
    poster: '/videos/elderly-arm-in-arm.jpg',
    seconds: 7,
    alt: 'An old man walks with his arm around an old woman along a sunny street past cafes.',
    keywords: ['old couple', 'arm around her', 'sunny street', 'cafe umbrellas', 'white shirt'],
    prompts: [
      'How long do you think they have been together?',
      'Tell their story.',
    ],
  },
  {
    // source: pexels_5897650.mp4 (Pexels License)
    id: 'whiteboard-teacher',
    src: '/videos/whiteboard-teacher.mp4',
    poster: '/videos/whiteboard-teacher.jpg',
    seconds: 10,
    alt: 'A teacher writes on a whiteboard, then turns around to explain to the students.',
    keywords: ['teacher', 'whiteboard', 'student', 'desk', 'papers'],
    prompts: [
      'What is the teacher explaining?',
      'Describe a teacher you remember.',
    ],
  },
  {
    // source: pexels_6036730.mp4 (Pexels License)
    id: 'suitcase-walkway',
    src: '/videos/suitcase-walkway.mp4',
    poster: '/videos/suitcase-walkway.jpg',
    seconds: 12,
    alt: 'A traveller pulls a grey suitcase along a long glass walkway.',
    keywords: ['suitcase', 'glass walkway', 'traveller', 'shiny floor', 'windows'],
    prompts: [
      'Where is this person travelling to?',
      'What do you always pack in your suitcase?',
    ],
  },
  {
    // source: pexels_6058369.mp4 (Pexels License)
    id: 'chess-two-players',
    src: '/videos/chess-two-players.mp4',
    poster: '/videos/chess-two-players.jpg',
    seconds: 11,
    alt: 'Two men play chess at a wooden table; one thinks hard and then moves a piece.',
    keywords: ['chess board', 'chess pieces', 'two players', 'wooden table', 'hand moving'],
    prompts: [
      'Who is winning, do you think? Why?',
      'Do you like games where you must think a lot?',
    ],
  },
  {
    // source: pexels_6098961.mp4 (Pexels License)
    id: 'ribbon-gift-box',
    src: '/videos/ribbon-gift-box.mp4',
    poster: '/videos/ribbon-gift-box.jpg',
    seconds: 13,
    alt: 'Hands tie a big red ribbon around a small wrapped present on a white table.',
    keywords: ['present', 'red ribbon', 'hands', 'wrapping paper', 'white table'],
    prompts: [
      'Who is the present for? What is inside?',
      'Tell about the best gift you ever got.',
    ],
  },
  {
    // source: pexels_6214421.mp4 (Pexels License)
    id: 'painter-studio',
    src: '/videos/painter-studio.mp4',
    poster: '/videos/painter-studio.jpg',
    seconds: 13,
    alt: 'An artist sits in a bright studio full of colourful paintings and works at his easel.',
    keywords: ['artist', 'easel', 'colourful paintings', 'studio', 'plants'],
    prompts: [
      'Describe the room and the paintings.',
      'What is he painting now?',
    ],
  },
  {
    // source: pexels_6342210.mp4 (Pexels License)
    id: 'clothes-try-on',
    src: '/videos/clothes-try-on.mp4',
    poster: '/videos/clothes-try-on.jpg',
    seconds: 10,
    alt: 'A woman takes a coat from a clothes rail, holds it up and tries it on.',
    keywords: ['coat', 'clothes rail', 'hanger', 'orange jumper', 'shop'],
    prompts: [
      'Will she buy it? Why?',
      'How do you decide if clothes look good on you?',
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
    // source: pexels_7643457.mp4 (Pexels License)
    id: 'interview-handshake',
    src: '/videos/interview-handshake.mp4',
    poster: '/videos/interview-handshake.jpg',
    seconds: 23,
    alt: 'Two people shake hands across a table in an office high above the city, and one of them leaves.',
    keywords: ['handshake', 'office', 'big windows', 'city view', 'table'],
    prompts: [
      'Did the meeting go well? How can you tell?',
      'What would you do before a job interview?',
    ],
  },
  {
    // source: pexels_8201840.mp4 (Pexels License)
    id: 'office-high-five',
    src: '/videos/office-high-five.mp4',
    poster: '/videos/office-high-five.jpg',
    seconds: 7,
    alt: 'Four colleagues in an office give each other high fives and laugh.',
    keywords: ['high five', 'colleagues', 'office', 'smiles', 'yellow shirt'],
    prompts: [
      'What good news did they just hear?',
      'How does your team or class celebrate?',
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
    // source: pexels_9323700.mp4 (Pexels License)
    id: 'beach-litter-pick',
    src: '/videos/beach-litter-pick.mp4',
    poster: '/videos/beach-litter-pick.jpg',
    seconds: 10,
    alt: 'A man walks on a city beach with a grabber and a white bag and picks up rubbish.',
    keywords: ['grabber', 'white bag', 'beach', 'rubbish', 'tall buildings'],
    prompts: [
      'Why is he doing this?',
      'What can people do to keep beaches clean?',
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
