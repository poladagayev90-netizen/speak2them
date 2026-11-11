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
// Audit 2026-10-17 (Polad chose «licensed + clean animals»): playOk was taken
// off clips with an owner's watermark (leopard-road), visible people
// (gorilla-meet), or that look like someone else's AI / VFX work shown without
// our «AI video» label (dream-fall, dog-closes-curtain, fairy-door-cats,
// bear-apple-tree, cat-merry-go-round, cat-by-the-pot, dog-wizard,
// round-blue-bird). They stay web-only.
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
    howTo: {
      steps: [
        "A chef is standing *at* a kitchen counter.",
        "He holds a hot pan *over* a big fire.",
        "He looks very {calm} and {careful}.",
        "He throws the vegetables *up* *into* the air.",
        "They fall back *into* the pan.",
      ],
      useful: ["stand at", "over a fire", "throw up"],
    },
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
    howTo: {
      steps: [
        "Two dogs are running *on* the green grass *in* a park.",
        "One dog runs *in front* and looks {happy}.",
        "The other dog runs fast *behind* it.",
        "They run *in* big circles and look {excited}.",
      ],
      useful: ["run in circles", "in front", "run after"],
    },
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
    howTo: {
      steps: [
        "A boy is sitting *on* a low wall *in* a garden.",
        "A basketball is lying *on* the ground *near* him.",
        "He plays his guitar and looks {calm}.",
        "A big rooster stands *next to* him and looks {funny}.",
      ],
      useful: ["sit on a wall", "play the guitar", "stand next to"],
    },
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
    howTo: {
      steps: [
        "Some friends are standing *by* a small pond.",
        "One person holds a rope and swings *over* the water.",
        "They look very {happy} and {excited}.",
        "*At* the end, they let go and fall *into* the water.",
      ],
      useful: ["stand by", "swing over", "fall into"],
    },
  },
  {
    // source: video_2026-09-22_00-21-56.mp4
    id: 'gorilla-meet',
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
    howTo: {
      steps: [
        "Some people are standing still *in* a green forest.",
        "A big gorilla walks *past* them *on* the path.",
        "The gorilla eats leaves and looks {calm}.",
        "One man holds his hand *out* *to* the gorilla and stays {quiet}.",
      ],
      useful: ["stand still", "walk past", "hold out a hand"],
    },
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
    howTo: {
      steps: [
        "There is a small camera *on* a bird feeder *in* a garden.",
        "First, a squirrel climbs *onto* it, and then a bird sits *there*.",
        "Next, a deer walks *up to* the feeder and looks {hungry}.",
        "It puts its face *into* the box, and it looks {funny}.",
      ],
      useful: ["climb onto", "walk up to", "put into"],
    },
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
    howTo: {
      steps: [
        "A man is standing *at* the top *of* the stairs.",
        "He is talking *to* the camera and looks {happy}.",
        "Suddenly, his foot slips *on* the carpet.",
        "He slides all the way *down* the stairs and looks {surprised}.",
      ],
      useful: ["at the top of", "talk to", "slide down"],
    },
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
    howTo: {
      steps: [
        "A brown hen is lying *on* a blue blanket *on* a sofa.",
        "A person pets its back, and the hen feels {happy}.",
        "Then the hand stops and moves *away*.",
        "The hen pushes its head *under* the hand again and stays {calm}.",
      ],
      useful: ["lie on a sofa", "move away", "push under"],
    },
  },
  {
    // source: video_2026-09-22_00-22-11.mp4
    id: 'leopard-road',
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
    howTo: {
      steps: [
        "A leopard is walking *down* a dirt road *in* the evening.",
        "Some people are watching it *from* a car.",
        "The leopard looks {calm} and a little {tired}.",
        "Then it stops and lies *down* *in* the dust.",
      ],
      useful: ["walk down a road", "watch from a car", "lie down"],
    },
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
    howTo: {
      steps: [
        "A man is sitting *at* a table *in* a busy restaurant.",
        "A waiter stands *next to* him *with* a huge knife.",
        "He cuts a hot round bread pie *on* the table.",
        "The guest watches the food and looks {surprised} and {hungry}.",
      ],
      useful: ["sit at a table", "stand next to", "cut with a knife"],
    },
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
    howTo: {
      steps: [
        "A man is standing *on* a wooden pier *by* the sea.",
        "He holds a big fish *in* his hands and looks {proud}.",
        "He gets *down* *on* his knees to put the fish back.",
        "He falls *into* the water and comes *out* {surprised}.",
      ],
      useful: ["stand on a pier", "put back", "fall into the water"],
    },
  },
  {
    // source: video_2026-09-22_00-22-23.mp4
    id: 'dream-fall',
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
    howTo: {
      steps: [
        "A person is falling *from* the sky *above* a big city.",
        "The streets *below* come closer, and the person feels {scared}.",
        "Suddenly, the person wakes *up* *in* a bedroom.",
        "They are lying *in* bed and feel {safe} and {calm}.",
      ],
      useful: ["fall from the sky", "wake up", "lie in bed"],
    },
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
    howTo: {
      steps: [
        "A woman is sitting *at* a desk *in* a TV studio.",
        "She is talking *to* the camera and looks {calm}.",
        "Another person crawls *across* the floor *behind* her.",
        "That person stays low *on* the floor and looks {funny}.",
      ],
      useful: ["sit at a desk", "talk to the camera", "crawl across"],
    },
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
    howTo: {
      steps: [
        "A man with a helmet is standing *by* a fast water canal.",
        "He puts a small toy boat *into* the water.",
        "He runs *along* the side *after* the boat and looks {excited}.",
        "Then he jumps *into* the water too and looks {happy}.",
      ],
      useful: ["put into the water", "run after", "jump into"],
    },
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
    howTo: {
      steps: [
        "People are sitting *in* a roller coaster car *at* a park.",
        "The car is going *up* a very high track.",
        "There is a big wheel *next to* them *under* the clouds.",
        "The people wait *at* the top and feel {excited} and {scared}.",
      ],
      useful: ["sit in a car", "go up", "at the top"],
    },
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
    howTo: {
      steps: [
        "Two coffee cups are sitting *on* a table.",
        "A person holds one cup *above* the other cup.",
        "They try to pour coffee *into* the second cup.",
        "The coffee spills *over* the table and makes a {sad}, {funny} mess.",
      ],
      useful: ["sit on a table", "pour into", "spill over"],
    },
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
    howTo: {
      steps: [
        "A bride and groom are dancing *on* a shiny floor.",
        "They hold hands and look very {happy}.",
        "He spins her *around*, and her feet slip *on* the floor.",
        "She falls *down*, and he holds his head *in* his hands.",
        "He looks very {surprised}.",
      ],
      useful: ["dance on a floor", "spin around", "fall down"],
    },
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
    howTo: {
      steps: [
        "Blue waves are moving *across* the sea *towards* red rocks.",
        "*At* first, the water looks {calm} and {quiet}.",
        "Then one big wave hits the rocks very hard.",
        "White water flies high *into* the air *above* the rocks.",
      ],
      useful: ["move towards", "at first", "fly into the air"],
    },
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
    howTo: {
      steps: [
        "Many fans in red are sitting *in* a big football stadium.",
        "*On* the green grass, the players just scored a goal.",
        "The players run *together* *to* the corner and look {happy}.",
        "All the fans *in* the stands cheer and feel {excited}.",
      ],
      useful: ["in a stadium", "score a goal", "run together"],
    },
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
    howTo: {
      steps: [
        "Two red dice are sitting *on* a white table.",
        "They do not move and the table looks {quiet}.",
        "Suddenly, two more dice fall *down* *from* above.",
        "They hit the first dice and roll *across* the table, looking {surprised}.",
      ],
      useful: ["sit on a table", "fall from above", "roll across"],
    },
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
    howTo: {
      steps: [
        "A small white kitten is hiding *under* a sofa.",
        "It is playing *with* a pink toy *on* the carpet.",
        "The kitten hits the toy and looks {happy} and {excited}.",
        "Then it runs *out* *from* under the sofa.",
      ],
      useful: ["hide under", "play with", "run out"],
    },
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
    howTo: {
      steps: [
        "People are sitting *around* a table *in* a restaurant.",
        "There is a very hot pan *in* the middle *of* the table.",
        "A waiter with a red glove pours sauce *into* the pan.",
        "The guests hold *up* their phones and look {excited} and {happy}.",
      ],
      useful: ["sit around a table", "in the middle of", "pour into"],
    },
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
    howTo: {
      steps: [
        "A young man is cooking *at* the stove *in* a kitchen.",
        "His friend is standing *behind* him and watching.",
        "The man throws the food *up* and catches it *in* the pan.",
        "It works well, and both friends look {happy} and {proud}.",
      ],
      useful: ["cook at the stove", "stand behind", "catch in a pan"],
    },
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
    howTo: {
      steps: [
        "A white cat is lying *on* a wooden floor *near* a curtain.",
        "Someone moves a small toy *on* a string *in front of* it.",
        "The cat grabs the toy *with* its paws and looks {happy}.",
        "Then it stands *up* and walks *away* feeling {proud}.",
      ],
      useful: ["lie on the floor", "in front of", "walk away"],
    },
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
    howTo: {
      steps: [
        "Some children in party hats are sitting *around* a table.",
        "There are small candles burning *on* the doughnuts.",
        "One boy leans *over* and blows *out* the candles.",
        "He looks {proud}, and the other kids clap and feel {happy}.",
      ],
      useful: ["sit around", "blow out candles", "clap hands"],
    },
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
    howTo: {
      steps: [
        "A little child is standing *on* a wooden floor *at* home.",
        "The child is wearing a penguin costume and looks {funny}.",
        "They hold *up* a big picture *of* a penguin.",
        "Then the child looks *out* *from* behind the paper and feels {proud}.",
      ],
      useful: ["wear a costume", "hold up a picture", "look out from behind"],
    },
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
    howTo: {
      steps: [
        "A football player is standing *in front of* the goal.",
        "The goalkeeper waits *on* the line and looks {ready}.",
        "The player runs *up* and kicks the ball *into* the goal.",
        "The goalkeeper dives *onto* the grass and looks {sad}.",
      ],
      useful: ["in front of", "kick the ball", "dive onto the grass"],
    },
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
    howTo: {
      steps: [
        "A woman is standing *on* the street *in* the city.",
        "Her friend runs *up to* her *along* the sidewalk.",
        "They put their arms *around* each other and hug.",
        "Both women laugh a lot and look very {happy} and {excited}.",
      ],
      useful: ["on the street", "run up to", "hug each other"],
    },
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
    howTo: {
      steps: [
        "A woman in black is standing *at* the bottom *of* the stairs.",
        "Two high shoes are sitting *on* the floor *behind* her.",
        "She bends her body *back* and puts her feet *in* the air.",
        "She stays {calm} and puts her feet *into* the shoes, looking {proud}.",
      ],
      useful: ["at the bottom of", "bend back", "put on shoes"],
    },
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
    howTo: {
      steps: [
        "A baby goat and a white calf are standing *in* a barn.",
        "They stand *next to* each other *at* the metal feeders.",
        "Both animals drink milk and look {hungry} and {happy}.",
        "Then they turn *around* and walk *away* together.",
      ],
      useful: ["next to each other", "drink milk", "walk away"],
    },
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
    howTo: {
      steps: [
        "A little donkey is standing *in* a yard *by* a fence.",
        "Suddenly, it jumps *up* and kicks its back legs *in* the air.",
        "It looks very {happy} and {excited}.",
        "Then it walks *up to* the camera and smells it.",
      ],
      useful: ["in a yard", "jump up", "walk up to"],
    },
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
    howTo: {
      steps: [
        "A baby giraffe is standing *inside* a bright stable.",
        "It has some black hair *on* top *of* its head.",
        "It looks {funny}.",
        "It walks *up to* the camera and looks *at* it, staying {calm}.",
      ],
      useful: ["on top of", "walk up to", "look at"],
    },
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
    howTo: {
      steps: [
        "A brown bear is sitting *in* a muddy puddle *in* the forest.",
        "Water comes *out of* a hose, and the bear plays *with* it.",
        "The bear splashes water everywhere and looks {happy}.",
        "Then it runs straight *at* the camera, and the person feels {scared}.",
      ],
      useful: ["sit in a puddle", "play with a hose", "run at"],
    },
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
    howTo: {
      steps: [
        "A man with bare feet is climbing *up* a very tall tree.",
        "The green forest floor is far *below* him.",
        "He holds *on to* the tree with his hands and stays {calm}.",
        "He reaches the top *above* the trees and feels {proud}.",
      ],
      useful: ["climb up a tree", "far below", "hold on to"],
    },
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
    howTo: {
      steps: [
        "A lemur is sitting *by* a path *in* the forest.",
        "It takes some fruit and climbs *up* a tree.",
        "Then it comes *down* *onto* the path and stands on two legs.",
        "It jumps sideways *along* the road and looks {happy} and {funny}.",
      ],
      useful: ["climb up", "stand on two legs", "jump along"],
    },
  },
  {
    // source: dog-wizard.mp4
    id: 'dog-wizard',
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
    howTo: {
      steps: [
        "A golden dog is sitting *on* some rocks *in* a forest.",
        "It is wearing a black cloak *over* its head.",
        "It holds a wooden stick *between* its paws and looks {calm}.",
        "Someone puts a necklace *on* the stick, and the dog looks {funny}.",
      ],
      useful: ["sit on rocks", "wear a cloak", "put on"],
    },
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
    howTo: {
      steps: [
        "A chick, a kitten, and a rabbit are sitting *on* the grass.",
        "They are sitting *next to* each other *in* a row.",
        "The chick and the rabbit stay still and look {calm}.",
        "The kitten looks *at* its friends and looks very {funny}.",
      ],
      useful: ["sit on the grass", "next to each other", "look at"],
    },
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
    howTo: {
      steps: [
        "A hammock is hanging high *up* *between* two tall buildings.",
        "Some clothes are drying *on* a line *next to* it.",
        "A man is lying *in* the hammock and reading a book.",
        "He looks {calm}, but the street far *below* looks {scared}.",
      ],
      useful: ["hang between", "lie in a hammock", "far below"],
    },
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
    howTo: {
      steps: [
        "A tiny hedgehog is standing *on* a wooden floor *in* a room.",
        "It starts running very fast *towards* the camera.",
        "It moves *on* its short legs and looks {excited} and {funny}.",
        "Then it runs right *past* the camera.",
      ],
      useful: ["on the floor", "run towards", "run past"],
    },
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
    howTo: {
      steps: [
        "Some small kittens are playing *on* a wooden floor *in* a room.",
        "One kitten hits a green plastic bottle *with* its paw.",
        "The bottle rolls *across* the floor, and the kittens look {excited}.",
        "A big cat lies *behind* them and looks {calm}.",
      ],
      useful: ["play on the floor", "roll across", "lie behind"],
    },
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
    howTo: {
      steps: [
        "A man in an orange shirt is standing *by* a stone wall.",
        "A white seagull is standing *on* the wall *next to* him.",
        "The man waves his hands *at* the bird and looks {angry}.",
        "The bird just looks *at* him and stays {calm}.",
      ],
      useful: ["stand by a wall", "wave hands", "look at"],
    },
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
    howTo: {
      steps: [
        "A person is filming *from* a car *on* a busy road.",
        "Two huge moose are walking *on* the grass *beside* the road.",
        "Cars drive *past* them, with green trees *in* the background.",
        "The moose keep walking slowly and look {calm} and {quiet}.",
      ],
      useful: ["from a car", "walk beside the road", "drive past"],
    },
  },
  {
    // source: round-blue-bird.mp4
    id: 'round-blue-bird',
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
    howTo: {
      steps: [
        "A round blue bird is sitting *on* a thin branch.",
        "There is a brick wall *behind* it *in* the garden.",
        "The bird sits still *on* the tree and looks {calm}.",
        "Then it turns *around* to show its tail and looks {funny}.",
      ],
      useful: ["sit on a branch", "in the garden", "turn around"],
    },
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
    howTo: {
      steps: [
        "A small tortoise is standing *next to* a yellow toy truck.",
        "It is wearing a tiny bag *on* its back and looks {funny}.",
        "Someone holds a piece *of* apple *in front of* its mouth.",
        "The tortoise takes a big bite and looks {hungry}.",
      ],
      useful: ["stand next to", "on its back", "take a bite"],
    },
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
    howTo: {
      steps: [
        "An older woman in a dress is working *on* a brick wall.",
        "She puts wet cement *onto* the bricks *with* a tool.",
        "Then she puts a new brick *on* top and looks {careful}.",
        "At the end, she smiles *at* the camera and feels {proud}.",
      ],
      useful: ["work on a wall", "put on top", "smile at"],
    },
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
    howTo: {
      steps: [
        "A monkey walks *into* a living room *through* an open door.",
        "It walks *past* a glass table and looks *around*.",
        "A woman runs *into* the room and feels {scared} and {angry}.",
        "She chases the monkey *out* *onto* the balcony.",
      ],
      useful: ["walk into a room", "look around", "chase out"],
    },
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
    howTo: {
      steps: [
        "A cat is lying *on* the road *under* a parked car.",
        "A delivery driver bends *down* and pulls the cat *out*.",
        "The cat looks {lazy} and {calm}.",
        "It rolls right back *under* the car *to* the same spot.",
      ],
      useful: ["lie under a car", "pull out", "roll back"],
    },
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
    howTo: {
      steps: [
        "A man in a red shirt is standing *behind* a big truck.",
        "He pulls a tall fridge *off* the truck.",
        "He puts it *on* his back and looks very {careful}.",
        "Then he walks *down* the street alone and looks {proud}.",
      ],
      useful: ["take off a truck", "put on his back", "walk down the street"],
    },
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
    howTo: {
      steps: [
        "A man is standing *next to* a big glass fish tank.",
        "He leans *over* the top to catch a fish *inside* the water.",
        "Suddenly, he loses his balance and falls headfirst *into* the tank.",
        "He stands *up* all wet and looks {surprised} and {funny}.",
      ],
      useful: ["stand next to", "lean over", "fall into"],
    },
  },
  {
    // source: video_2026-09-30_21-09-34.mp4
    id: 'cat-dump-truck',
    playOk: true,
    src: '/videos/cat-dump-truck.mp4',
    poster: '/videos/cat-dump-truck.jpg',
    seconds: 7,
    sound: true,
    alt: 'A ginger cat rides in the back of a toy dump truck across a shiny floor and straight into a cardboard box.',
    keywords: ['ginger cat', 'toy truck', 'cardboard box', 'shiny floor', 'riding'],
    prompts: [
      'Where is the cat going, and how does it get there?',
      'Why do you think the cat sits so calmly?',
    ],
    howTo: {
      steps: [
        "A ginger cat is sitting *in* the back *of* a toy truck.",
        "The toy truck rolls *across* the floor *towards* a box.",
        "The cat does not move and looks very {calm} and {lazy}.",
        "The truck drives straight *into* the cardboard box.",
      ],
      useful: ["sit in the back", "roll across", "drive into"],
    },
  },
  {
    // source: video_2026-09-30_21-09-40.mp4
    id: 'fairy-door-cats',
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
    howTo: {
      steps: [
        "A tiny door is *at* the bottom *of* a big tree.",
        "Someone knocks *on* the little door *with* their hand.",
        "The door opens, and small kittens walk *out* holding flowers.",
        "They stand *in* a line and look {happy} and {funny}.",
      ],
      useful: ["knock on a door", "walk out", "stand in a line"],
    },
  },
  {
    // source: video_2026-09-30_21-09-43.mp4
    id: 'snow-slip',
    src: '/videos/snow-slip.mp4',
    poster: '/videos/snow-slip.jpg',
    seconds: 12,
    sound: true,
    alt: 'On a bright street at night, a woman slips on the icy path and falls into a pile of snow while people walk past.',
    keywords: ['icy street', 'snow pile', 'slipping', 'lights', 'winter coat'],
    prompts: [
      'What happened to her? Describe it step by step.',
      'Have you ever slipped on ice or snow? What happened?',
    ],
    howTo: {
      steps: [
        "A woman is walking *down* an icy street *at* night.",
        "Other people are walking *past* the bright shop lights.",
        "Suddenly, her feet slip *on* the ice.",
        "She falls *into* the snow and looks {surprised} and {sad}.",
      ],
      useful: ["walk down a street", "slip on the ice", "fall into the snow"],
    },
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
    howTo: {
      steps: [
        "A truck is driving *down* a busy road *on* a sunny day.",
        "A sloth is lying *on* the dashboard *inside* the truck.",
        "It stays *above* the steering wheel in the sun.",
        "The sloth moves very slowly and looks {tired} and {calm}.",
      ],
      useful: ["drive down a road", "lie on", "move slowly"],
    },
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
    howTo: {
      steps: [
        "A man is sitting *on* the ground *on* a high hill.",
        "There is a huge rock right *in front of* his feet.",
        "He pushes the rock hard *with* his legs and looks {excited}.",
        "The rock rolls fast *down* the hill, and it looks {scared}.",
      ],
      useful: ["sit on the ground", "push with his feet", "roll down a hill"],
    },
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
    howTo: {
      steps: [
        "A cat is running fast *across* a big empty room.",
        "It runs straight *towards* a wall *next to* the TV.",
        "The cat jumps high *up* *onto* the wall and looks {excited}.",
        "It lands *back* *on* the floor and looks {proud}.",
      ],
      useful: ["run across a room", "jump onto", "land on the floor"],
    },
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
    howTo: {
      steps: [
        "Some turtles are sitting *in* a row *on* a log.",
        "They are resting *above* the green water and look {calm}.",
        "Another turtle climbs *onto* the log, and the log rolls *over*.",
        "All the turtles fall *into* the water and look {surprised}.",
      ],
      useful: ["in a row", "climb onto", "roll over"],
    },
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
    howTo: {
      steps: [
        "A ginger cat is standing *in front of* a washing machine.",
        "The clothes are spinning *around* *inside* the glass door.",
        "The cat puts its paws *on* the glass and moves them fast.",
        "It wants to catch the clothes and looks {excited} and {funny}.",
      ],
      useful: ["in front of", "spin around", "put paws on"],
    },
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
    howTo: {
      steps: [
        "A squirrel is sitting *on* a water fountain *in* a park.",
        "Clean water is coming *out of* the metal tap.",
        "The squirrel leans *over* the water and looks {thirsty}.",
        "It drinks *from* the fountain with its hands and looks {happy}.",
      ],
      useful: ["sit on", "come out of", "drink from"],
    },
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
    howTo: {
      steps: [
        "It is raining hard *in* a supermarket car park.",
        "A person is watching *from* inside a car.",
        "The strong wind pushes an empty shopping cart *across* the road.",
        "The cart rolls fast *towards* the parked cars.",
        "The driver feels {scared} and {sad}.",
      ],
      useful: ["in a car park", "push across", "roll towards"],
    },
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
    howTo: {
      steps: [
        "A man is fishing *by* the sea *with* a long rod.",
        "His bucket of fish is sitting *on* the ground *behind* him.",
        "A cat puts its head *into* the bucket and takes a fish.",
        "The cat runs *away* *down* the street and looks {happy} and {proud}.",
      ],
      useful: ["by the sea", "put its head into", "run away with"],
    },
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
    howTo: {
      steps: [
        "A squirrel is holding *on to* a glass door *by* a garden.",
        "It looks *through* the glass *into* the house.",
        "The camera moves closer *to* the squirrel.",
        "Suddenly, the squirrel jumps straight *at* the camera.",
        "The person feels {surprised} and {scared}.",
      ],
      useful: ["hold on to", "look through", "jump at"],
    },
  },
  {
    // source: video_2026-10-13_11-06-29.mp4
    id: 'dog-closes-curtain',
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
    howTo: {
      steps: [
        "The camera looks *at* a bright window *at* night.",
        "*Inside* the room, a dog in glasses is sitting *at* a computer.",
        "The dog sees the camera *outside* and looks {angry}.",
        "It pulls the curtain *across* the window and looks {funny}.",
      ],
      useful: ["look at a window", "sit at a computer", "close the curtain"],
    },
  },
  {
    // source: video_2026-10-13_11-06-31.mp4
    id: 'cat-by-the-pot',
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
    howTo: {
      steps: [
        "A ginger cat is standing *on* a cooking pot *near* a window.",
        "It sees the camera and jumps *down* *onto* the table.",
        "It sits *next to* the pot and looks {scared}.",
        "Another cat is watching *from* behind and looks {calm}.",
      ],
      useful: ["jump down", "sit next to", "watch from behind"],
    },
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
    howTo: {
      steps: [
        "Two men are carrying a heavy box *by* a swimming pool.",
        "They walk slowly *along* the narrow edge and try to be {careful}.",
        "One man steps backwards and misses the ground.",
        "He falls *into* the water *with* the box and looks {surprised}.",
      ],
      useful: ["by a pool", "walk along", "fall into the water"],
    },
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
    howTo: {
      steps: [
        "A little girl is standing *outside* a wooden stable.",
        "She feels {scared}, so she puts a carrot *on* a stick.",
        "She holds the stick *up* *to* the window.",
        "A horse leans *out* and eats the carrot, looking {happy}.",
      ],
      useful: ["stand outside", "on a stick", "lean out"],
    },
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
    howTo: {
      steps: [
        "A black dog and a grey cat meet *on* the green grass.",
        "They stand *next to* each other and look {calm}.",
        "Then they turn *onto* a long path.",
        "They walk *down* the path *together* and look {happy}.",
      ],
      useful: ["meet on the grass", "stand next to", "walk down a path"],
    },
  },
  {
    // source: video_2026-10-13_11-06-49.mp4
    id: 'cat-merry-go-round',
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
    howTo: {
      steps: [
        "A white cat is lying *on* its back *in* a playground.",
        "It is *on* a blue roundabout, and the ride is spinning *around*.",
        "The cat holds its paws *up* *in* the air.",
        "It does not get *off* and looks very {calm} and {lazy}.",
      ],
      useful: ["lie on its back", "spin around", "get off"],
    },
  },
  {
    // source: video_2026-10-13_11-06-51.mp4
    id: 'bear-apple-tree',
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
    howTo: {
      steps: [
        "A brown bear is sitting high *up* *in* an apple tree.",
        "There are houses *below* it and a rainbow *in* the sky.",
        "The bear sits *on* a branch and picks red apples.",
        "It eats the apples and looks {hungry} and {happy}.",
      ],
      useful: ["up in a tree", "in the sky", "sit on a branch"],
    },
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
    howTo: {
      steps: [
        "A birthday cake with candles is sitting *on* a table.",
        "A small dog jumps *up* and puts its paws *on* the edge.",
        "It licks the white cream *on* the cake and looks {happy}.",
        "The family walks *into* the room and looks {surprised}.",
      ],
      useful: ["on a table", "jump up", "walk into a room"],
    },
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
    howTo: {
      steps: [
        "A cat is sitting *on* a table *next to* a glass.",
        "It looks straight *at* the camera and stays {calm}.",
        "It slowly pushes the glass *towards* the edge *with* its paw.",
        "The glass falls *off* the table, and the cat looks {proud}.",
      ],
      useful: ["next to", "push with a paw", "fall off the table"],
    },
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
    howTo: {
      steps: [
        "A dog is sitting alone *on* a sofa *in* a living room.",
        "It bites a pillow, and white feathers fly *all over* the floor.",
        "Then the door opens and the owner walks *into* the room.",
        "The dog lies *down* *on* the sofa and looks {calm} and {funny}.",
      ],
      useful: ["on a sofa", "walk into", "lie down"],
    },
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
    howTo: {
      steps: [
        "A car is parked *outside* a barn *on* a farm.",
        "A goat jumps *onto* the front *of* the car.",
        "Then it climbs *up* *onto* the roof and looks {proud}.",
        "A farmer runs *out* and waves her arms, looking {angry}.",
      ],
      useful: ["jump onto", "on the roof", "wave arms"],
    },
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
    howTo: {
      steps: [
        "A cat is sitting *on* top *of* a robot vacuum.",
        "The robot moves *across* the wooden floor, and the cat looks {calm}.",
        "Suddenly, the robot hits the bottom *of* a wall.",
        "The cat slides *off* *onto* the floor and looks {surprised}.",
      ],
      useful: ["on top of", "move across", "slide off"],
    },
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
    howTo: {
      steps: [
        "A pizza box is sitting *on* a mat *by* a door.",
        "A big seagull lands *on* the step *next to* the box.",
        "It opens the box *with* its beak and looks {hungry}.",
        "It takes a slice *of* pizza and flies *away*, looking {happy}.",
      ],
      useful: ["by a door", "open a box", "fly away"],
    },
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
    howTo: {
      steps: [
        "A man is walking *down* a wet street *in* the rain.",
        "He holds an umbrella *over* his head.",
        "The strong wind blows the umbrella *out of* his hand.",
        "He runs *after* it *in* the street and looks {angry} and {sad}.",
      ],
      useful: ["in the rain", "blow away", "run after"],
    },
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
    howTo: {
      steps: [
        "A waiter is walking *between* the tables *in* a busy café.",
        "He is carrying a tray *of* glasses *in* his hand.",
        "Suddenly, he trips and the glasses almost fall *off* the tray.",
        "He catches the tray *on* one knee and looks {surprised} and {happy}.",
      ],
      useful: ["walk between", "carry a tray", "fall off"],
    },
  },
  {
    // source: Cat_steals_bread_from_counter_20261017172729.mp4
    id: 'cat-bread-thief',
    licensed: true,
    ai: true,
    src: '/videos/cat-bread-thief.mp4',
    poster: '/videos/cat-bread-thief.jpg',
    seconds: 8,
    sound: true,
    alt: 'A ginger cat on a messy kitchen counter pulls a slice of bread out of the bag, jumps down and runs out of the kitchen with it.',
    keywords: ['ginger cat', 'slice of bread', 'plastic bag', 'kitchen counter', 'fridge'],
    prompts: [
      'What did the cat do, step by step, and where do you think it was going?',
      'Has an animal ever stolen food from you? What happened?',
    ],
    howTo: {
      steps: [
        "A ginger cat is standing *on* a counter *in* a kitchen.",
        "It pulls a slice *of* bread *out of* a plastic bag.",
        "The cat holds the bread *in* its mouth and looks {happy}.",
        "It jumps *down* and runs *out of* the kitchen, feeling {proud}.",
      ],
      useful: ["on a counter", "pull out of", "run out of"],
    },
  },
  {
    // source: Goat_chewing_shirt_with_woman_20261017172701.mp4
    id: 'goat-shirt-tug',
    licensed: true,
    ai: true,
    src: '/videos/goat-shirt-tug.mp4',
    poster: '/videos/goat-shirt-tug.jpg',
    seconds: 8,
    sound: true,
    alt: 'In a village yard a white goat pulls a blue shirt off the washing line, and a woman in an apron comes and tries to pull it back.',
    keywords: ['white goat', 'washing line', 'blue shirt', 'apron', 'village yard'],
    prompts: [
      'Tell the story from the goat\'s point of view. What was it thinking?',
      'Who do you think will win, the goat or the woman? Why?',
    ],
    howTo: {
      steps: [
        "Clean clothes are hanging *on* a line *in* a yard.",
        "A white goat stands *under* the line and bites a blue shirt.",
        "A woman runs *over* and grabs the other side *of* the shirt.",
        "She pulls hard *against* the goat and looks {angry}; it looks {funny}.",
      ],
      useful: ["hang on a line", "run over", "pull back"],
    },
  },
  {
    // source: Man_catches_slipping_watermelon_20261017172739.mp4
    id: 'watermelon-save',
    licensed: true,
    ai: true,
    src: '/videos/watermelon-save.mp4',
    poster: '/videos/watermelon-save.jpg',
    seconds: 8,
    sound: true,
    alt: 'In a courtyard between old apartment blocks a man carrying a big watermelon trips over a garden hose, drops it, and catches it again just in time.',
    keywords: ['watermelon', 'garden hose', 'courtyard', 'apartment block', 'flip-flops'],
    prompts: [
      'What made him drop the watermelon, and how did he save it?',
      'Describe a time you almost dropped or broke something important.',
    ],
    howTo: {
      steps: [
        "A man is walking *across* a yard *between* two buildings.",
        "He is carrying a big watermelon *in* both arms.",
        "He trips *over* a hose, and the watermelon falls *from* his hands.",
        "He feels {scared}, but he catches it *in* time and looks {happy}.",
      ],
      useful: ["walk across", "trip over", "in time"],
    },
  },
  {
    // source: 1000070200.mp4
    id: 'horse-race-cameraman',
    src: '/videos/horse-race-cameraman.mp4',
    poster: '/videos/horse-race-cameraman.jpg',
    seconds: 18,
    sound: true,
    alt: 'A cameraman stands in the middle of a grassy track between yellow fences as riders on horses gallop past him through the finish arch.',
    keywords: ['cameraman', 'yellow fence', 'racehorse', 'wooden arch', 'dark clouds'],
    prompts: [
      'What is the cameraman filming, and what happens around him?',
      'Have you ever watched a race live? What was it like?',
    ],
    howTo: {
      steps: [
        "A cameraman is standing *in* the middle *of* a green track.",
        "Many horses are running fast *towards* him *between* yellow fences.",
        "The horses run right *past* him *on* both sides.",
        "The cameraman keeps filming them and stays very {calm} and {careful}.",
      ],
      useful: ["in the middle of", "run towards", "run past"],
    },
  },
  {
    // source: 1000072776.mp4
    id: 'glass-wall-bump',
    src: '/videos/glass-wall-bump.mp4',
    poster: '/videos/glass-wall-bump.jpg',
    seconds: 14,
    sound: true,
    alt: 'A woman walks straight into a spotless glass wall thinking it is open, then holds her head and laughs while her friends watch.',
    keywords: ['glass wall', 'black outfit', 'holding her head', 'corridor', 'shoes on the floor'],
    prompts: [
      'What happened when she tried to walk through?',
      'Have you ever walked into a glass door or window?',
    ],
    howTo: {
      steps: [
        "A woman in black is walking *towards* an open room.",
        "She does not see the clean glass wall *in front of* her.",
        "She walks straight *into* the glass and hits her head.",
        "She puts her hands *on* her head and looks {surprised} and {funny}.",
      ],
      useful: ["in front of", "walk into", "put hands on her head"],
    },
  },
  {
    // source: 1000073166.mp4
    id: 'bear-log-hug',
    src: '/videos/bear-log-hug.mp4',
    poster: '/videos/bear-log-hug.jpg',
    seconds: 10,
    sound: true,
    alt: 'A huge brown bear sits down on a log beside a man in the forest and puts its arm around his shoulder like an old friend.',
    keywords: ['brown bear', 'wooden log', 'forest', 'arm around shoulder', 'jeans'],
    prompts: [
      'What does the bear do after it sits down next to the man?',
      'How would you react if a wild animal came this close to you?',
    ],
    howTo: {
      steps: [
        "A man is sitting *on* a wooden log *in* a forest.",
        "A big brown bear walks *up* and sits *next to* him.",
        "The bear puts its arm *around* the man’s shoulder.",
        "They sit *together* *on* the log and look very {calm} and {happy}.",
      ],
      useful: ["sit on a log", "sit next to", "put an arm around"],
    },
  },
  {
    // source: 1000073292.mp4
    id: 'swinging-armchair-mall',
    ai: true,
    src: '/videos/swinging-armchair-mall.mp4',
    poster: '/videos/swinging-armchair-mall.jpg',
    seconds: 6,
    sound: true,
    alt: 'A woman tries to run past a swinging armchair in a courtyard, gets knocked off her feet and lands on the tiled floor.',
    keywords: ['swinging armchair', 'tiled floor', 'shopping mall', 'falling down', 'spilled bag'],
    prompts: [
      'What was she trying to do, and what went wrong?',
      'Have you ever tried a silly game with friends that went wrong?',
    ],
    howTo: {
      steps: [
        "A big chair is swinging *on* ropes *in* a building.",
        "A woman tries to run *across* the floor *past* the chair.",
        "The swinging chair hits her and knocks her *down*.",
        "She lands *on* the floor and looks {surprised} and {sad}.",
      ],
      useful: ["run across", "knock down", "land on the floor"],
    },
  },
  {
    // source: 1000073841.mp4
    id: 'dog-rips-trousers',
    src: '/videos/dog-rips-trousers.mp4',
    poster: '/videos/dog-rips-trousers.jpg',
    seconds: 9,
    sound: true,
    alt: 'A black dog chases a trainer in a blue suit across a park and pulls the back of his trousers off, revealing his spotted boxers.',
    keywords: ['black dog', 'blue uniform', 'stuffed toy', 'spotted boxers', 'park path'],
    prompts: [
      'What happens when the dog catches up with the man?',
      'Have you ever seen a working dog or a dog training session?',
    ],
    howTo: {
      steps: [
        "A man in a blue suit is running *in* a park.",
        "A black dog runs fast *behind* him *across* the grass.",
        "The dog bites the back *of* his trousers and pulls them *down*.",
        "The man looks {surprised}, and the scene looks very {funny}.",
      ],
      useful: ["run in a park", "run behind", "pull down"],
    },
  },
  {
    // source: 1000074143.mp4
    id: 'cat-concrete-crack',
    src: '/videos/cat-concrete-crack.mp4',
    poster: '/videos/cat-concrete-crack.jpg',
    seconds: 14,
    sound: true,
    alt: 'A grey cat on a leash squeezes into a narrow crack in the concrete, gets lifted out by its owner, and climbs straight back in.',
    keywords: ['grey cat', 'black harness', 'narrow crack', 'concrete', 'weeds'],
    prompts: [
      'What does the cat do right after the person lifts it out?',
      'Why do cats love squeezing into tight spaces?',
    ],
    howTo: {
      steps: [
        "A grey cat is sitting *inside* a narrow crack *in* the concrete.",
        "Its owner reaches *down* and lifts the cat *out*.",
        "The person puts the cat *on* the ground, and it stays {calm}.",
        "Then it climbs right back *into* the crack and looks {funny}.",
      ],
      useful: ["lift out", "put on the ground", "climb back into"],
    },
  },
  {
    // source: 1000074467.mp4
    id: 'cats-bed-money',
    ai: true,
    src: '/videos/cats-bed-money.mp4',
    poster: '/videos/cats-bed-money.jpg',
    seconds: 20,
    sound: true,
    alt: 'A black-and-white cat hides a stack of money under a blanket on a bed, but a ginger cat climbs onto the headboard and catches it.',
    keywords: ['black-and-white cat', 'ginger cat', 'dollar bills', 'beige blanket', 'bed'],
    prompts: [
      'Tell the story of what the two cats do with the money.',
      'Where is the safest place to hide something at home?',
    ],
    howTo: {
      steps: [
        "A black-and-white cat is sitting *on* a bed *with* some money.",
        "It puts the money *under* a blanket and looks {careful}.",
        "A ginger cat climbs *up* *behind* the bed and watches.",
        "The first cat turns *around* and looks {surprised} and {scared}.",
      ],
      useful: ["sit on a bed", "put under a blanket", "turn around"],
    },
  },
  {
    // source: 1000074485.mp4
    id: 'cat-flying-broom',
    ai: true,
    src: '/videos/cat-flying-broom.mp4',
    poster: '/videos/cat-flying-broom.jpg',
    seconds: 10,
    sound: true,
    alt: 'An orange-and-white cat flies down a quiet street on a broomstick, gives a peace sign, and crashes into a metal sign on the grass.',
    keywords: ['flying broomstick', 'orange-and-white cat', 'empty street', 'peace sign', 'metal sign'],
    prompts: [
      'What happens to the cat right after it looks at the camera?',
      'If you could fly anywhere without a plane, where would you go first?',
    ],
    howTo: {
      steps: [
        "An orange cat is flying *down* a quiet street *on* a broom.",
        "It looks *at* the camera and makes a peace sign.",
        "The cat looks very {happy} and {proud}.",
        "Then it flies *off* the road and hits a sign *on* grass.",
      ],
      useful: ["fly down a street", "look at the camera", "hit a sign"],
    },
  },
  {
    // source: 1000075708.mp4
    id: 'cat-driving-highway',
    ai: true,
    src: '/videos/cat-driving-highway.mp4',
    poster: '/videos/cat-driving-highway.jpg',
    seconds: 11,
    sound: true,
    alt: 'A driver films a silver car in the next lane on the highway and discovers an orange cat holding the steering wheel.',
    keywords: ['silver car', 'highway', 'orange cat', 'steering wheel', 'side mirror'],
    prompts: [
      'What do you see when the car pulls up next to the silver car?',
      'What is the funniest thing you have ever seen from a car window?',
    ],
    howTo: {
      steps: [
        "A person is filming *from* a car *on* a highway.",
        "A silver car is driving *in* the lane *next to* them.",
        "An orange cat is sitting *in* the driver’s seat.",
        "It holds the wheel and looks {calm}, and the driver is {surprised}.",
      ],
      useful: ["on a highway", "next to", "sit in a seat"],
    },
  },
  {
    // source: 1000077416.mp4
    id: 'cat-fishbowl-stove',
    ai: true,
    src: '/videos/cat-fishbowl-stove.mp4',
    poster: '/videos/cat-fishbowl-stove.jpg',
    seconds: 12,
    sound: true,
    alt: 'Seen through an apartment window, a grey cat stands at a kitchen stove holding a fishbowl with a goldfish over the burner.',
    keywords: ['apartment window', 'grey cat', 'fishbowl', 'gas stove', 'goldfish'],
    prompts: [
      'What is the grey cat doing in the kitchen when the camera zooms in?',
      'Have you ever caught a pet doing something it should not do?',
    ],
    howTo: {
      steps: [
        "The camera looks *through* a window *into* a kitchen.",
        "A grey cat is standing *in front of* the stove.",
        "It holds a fishbowl *with* a goldfish *over* the fire.",
        "The cat sees the camera and stops, looking {surprised} and {funny}.",
      ],
      useful: ["look through a window", "in front of", "hold over"],
    },
  },
  {
    // source: 1000080656.mp4
    id: 'orangutan-watches-excavators',
    src: '/videos/orangutan-watches-excavators.mp4',
    poster: '/videos/orangutan-watches-excavators.jpg',
    seconds: 20,
    sound: true,
    alt: 'Two yellow excavators push down a tall jungle tree while an orangutan stands among the green bushes watching quietly.',
    keywords: ['yellow excavator', 'falling tree', 'red soil', 'orangutan', 'jungle leaves'],
    prompts: [
      'What are the machines doing at the start, and who is watching them?',
      'How does this clip make you feel about nature and wildlife?',
    ],
    howTo: {
      steps: [
        "Two yellow machines are working *at* the edge *of* a jungle.",
        "They push a tall tree, and it falls *down* *onto* the ground.",
        "An orangutan is standing *in* the green bushes *near* them.",
        "It watches the tree fall and looks {quiet} and {sad}.",
      ],
      useful: ["push down a tree", "fall onto the ground", "stand in the bushes"],
    },
  },
  {
    // source: 1000082157.mp4
    id: 'cats-cement-rooster',
    ai: true,
    src: '/videos/cats-cement-rooster.mp4',
    poster: '/videos/cats-cement-rooster.jpg',
    seconds: 10,
    sound: true,
    alt: 'A cat smooths wet cement with a trowel, a rooster walks across it leaving footprints, and the next scene shows the cats eating roast chicken.',
    keywords: ['wet cement', 'trowel', 'rooster', 'footprints', 'roast chicken'],
    prompts: [
      'What did the rooster do to the cats\' work, and what happened in the next scene?',
      'Tell about a time someone ruined something you had just finished cleaning or making.',
    ],
    howTo: {
      steps: [
        "Two cats are working *on* wet cement *on* the ground.",
        "A rooster walks *across* the wet cement and leaves footprints *in* it.",
        "The cats look *at* the footprints and feel {angry}.",
        "*In* the next scene, they eat roast chicken and look {happy}.",
      ],
      useful: ["on the ground", "walk across", "look at"],
    },
  },
  {
    // source: 1000082286.mp4
    id: 'giant-cat-taxi',
    ai: true,
    src: '/videos/giant-cat-taxi.mp4',
    poster: '/videos/giant-cat-taxi.jpg',
    seconds: 12,
    sound: true,
    alt: 'A man in a suit with a briefcase hails a giant fluffy cat on a city street at night, climbs onto its back and rides away.',
    keywords: ['businessman', 'briefcase', 'giant cat', 'city street', 'riding'],
    prompts: [
      'How does the man get home instead of taking a taxi or bus?',
      'If you could ride any animal to work or school, which one would you choose?',
    ],
    howTo: {
      steps: [
        "A man in a suit is standing *on* a street *at* night.",
        "He waves his hand, and a giant cat stops *by* him.",
        "He climbs *onto* the cat’s back and feels {calm}.",
        "The giant cat walks *down* the street, and it looks {funny}.",
      ],
      useful: ["on a street", "stop by", "climb onto"],
    },
  },
  {
    // source: 1000082288.mp4
    id: 'cat-gym-bench',
    ai: true,
    src: '/videos/cat-gym-bench.mp4',
    poster: '/videos/cat-gym-bench.jpg',
    seconds: 11,
    sound: true,
    alt: 'A chubby tabby cat exercises on a cable machine in a gym, argues with a man over the handles, and tips backwards on the bench.',
    keywords: ['tabby cat', 'gym bench', 'cable machine', 'black T-shirt', 'tipping over'],
    prompts: [
      'What happens between the man and the cat at the gym machine?',
      'Do you prefer working out at a gym or exercising outdoors? Why?',
    ],
    howTo: {
      steps: [
        "A fat cat is sitting *on* a bench *in* a gym.",
        "A man walks *over* and takes the handles *from* the cat.",
        "The cat hits his hand and looks {angry}.",
        "Then the cat pulls hard and falls *off* the bench, looking {surprised}.",
      ],
      useful: ["sit on a bench", "take from", "fall off"],
    },
  },
  {
    // source: 1000082297.mp4
    id: 'cat-rides-pony',
    src: '/videos/cat-rides-pony.mp4',
    poster: '/videos/cat-rides-pony.jpg',
    seconds: 9,
    sound: true,
    alt: 'A black-and-white cat lies on the back of a small pony as it walks out of a stable into a green field.',
    keywords: ['black-and-white cat', 'brown pony', 'stable door', 'blonde tail', 'green field'],
    prompts: [
      'Where is the cat sitting, and where do the two animals go?',
      'Have you ever seen two very different animals become friends?',
    ],
    howTo: {
      steps: [
        "A small brown pony is walking *out of* a stable.",
        "A black-and-white cat is lying *on* the pony’s back.",
        "The pony walks *into* a green field *in* the sun.",
        "Both animals stay together and look {calm} and {happy}.",
      ],
      useful: ["walk out of", "on its back", "walk into a field"],
    },
  },
  {
    // source: 1000082301.mp4
    id: 'rooftop-pool-flamingo',
    src: '/videos/rooftop-pool-flamingo.mp4',
    poster: '/videos/rooftop-pool-flamingo.jpg',
    seconds: 11,
    sound: true,
    alt: 'A man relaxing on a pink flamingo float at the edge of a rooftop infinity pool panics and paddles back when someone pushes him.',
    keywords: ['pink flamingo float', 'rooftop pool', 'skyscrapers', 'pool edge', 'paddling'],
    prompts: [
      'Why does the man on the pink flamingo suddenly panic?',
      'Are you afraid of heights, or would you swim in a rooftop pool like this?',
    ],
    howTo: {
      steps: [
        "A man is sitting *on* a pink float *in* a roof pool.",
        "He is resting *at* the edge and looks {calm}.",
        "Someone pushes him *from* behind *towards* the edge.",
        "He feels very {scared} and paddles *back* with his hands, looking {funny}.",
      ],
      useful: ["in a pool", "at the edge", "push from behind"],
    },
  },
  {
    // source: 1000082321.mp4
    id: 'cat-dog-driveway',
    src: '/videos/cat-dog-driveway.mp4',
    poster: '/videos/cat-dog-driveway.jpg',
    seconds: 14,
    sound: true,
    alt: 'A grey cat creeps up to a small brown dog on a concrete yard, and the two animals circle and chase each other.',
    keywords: ['grey cat', 'small brown dog', 'concrete driveway', 'curled tail', 'chasing'],
    prompts: [
      'How does the interaction between the cat and the dog change during the clip?',
      'In your experience, who is usually the boss at home — the cat or the dog?',
    ],
    howTo: {
      steps: [
        "A small brown dog is standing *on* a driveway *outside* a house.",
        "A grey cat walks slowly *across* the ground *towards* the dog.",
        "They walk *around* each other *in* a circle.",
        "Then they chase each other and look {happy} and {excited}.",
      ],
      useful: ["outside a house", "walk towards", "walk around"],
    },
  },
  {
    // source: 1000082341.mp4
    id: 'cat-slides-downstairs',
    ai: true,
    src: '/videos/cat-slides-downstairs.mp4',
    poster: '/videos/cat-slides-downstairs.jpg',
    seconds: 10,
    sound: true,
    alt: 'An orange cat walks down tiled stairs on two legs holding a bowl, then flops onto its side and slides the rest of the way down.',
    keywords: ['orange cat', 'tiled stairs', 'blue bucket', 'small dog', 'sliding down'],
    prompts: [
      'How does the cat start going down the stairs, and how does it finish?',
      'What is a chore at home that makes you feel as lazy as this cat?',
    ],
    howTo: {
      steps: [
        "An orange cat is walking *down* the stairs *on* two legs.",
        "It is holding a small bowl *in* its paws.",
        "Halfway *down*, it stops *by* a bucket and feels {tired} and {lazy}.",
        "It lies *on* its side and slides *down* the stairs.",
      ],
      useful: ["walk down the stairs", "lie on its side", "slide down"],
    },
  },
  {
    // source: video_2026-11-11_10-09-32.mp4
    id: 'cat-waiter-cola',
    ai: true,
    src: '/videos/cat-waiter-cola.mp4',
    poster: '/videos/cat-waiter-cola.jpg',
    seconds: 12,
    sound: true,
    alt: 'A cat wearing a waiter apron opens a bottle of cola at a restaurant table, drinks from it, and serves the rest to a white dog.',
    keywords: ['cat waiter', 'brown apron', 'cola bottle', 'fluffy white dog', 'restaurant table'],
    prompts: [
      'What does the cat waiter do before serving the bottle to the dog?',
      'What is the funniest or worst service you have ever had at a restaurant?',
    ],
    howTo: {
      steps: [
        "A white dog is sitting *at* a table *in* a restaurant.",
        "A cat in an apron stands *by* the table *with* a cola.",
        "First, the cat drinks *from* the bottle and looks {happy}.",
        "It puts the bottle *in front of* the dog and looks {funny}.",
      ],
      useful: ["sit at a table", "drink from a bottle", "in front of"],
    },
  },
  {
    // source: video_2026-11-11_10-09-35.mp4
    id: 'kitten-floating-hairdryer',
    ai: true,
    src: '/videos/kitten-floating-hairdryer.mp4',
    poster: '/videos/kitten-floating-hairdryer.jpg',
    seconds: 15,
    sound: true,
    alt: 'A tiny ginger kitten steps onto a switched-on hairdryer on a bathroom counter and floats spinning in the warm air stream.',
    keywords: ['fluffy kitten', 'pink hairdryer', 'bathroom counter', 'floating in air', 'mirror'],
    prompts: [
      'What happens when the tiny kitten steps over the hairdryer?',
      'Have you ever seen a pet react in a funny way to a household appliance?',
    ],
    howTo: {
      steps: [
        "A pink hairdryer is lying *on* a counter *in* a bathroom.",
        "A tiny ginger kitten walks *across* the counter *towards* it.",
        "The warm air lifts the kitten *up* *into* the air.",
        "The kitten spins *around* and looks {surprised} and {calm}.",
      ],
      useful: ["on a counter", "lift into the air", "spin around"],
    },
  },
  {
    // source: video_2026-11-11_10-09-40.mp4
    id: 'cat-tutu-bridge',
    ai: true,
    src: '/videos/cat-tutu-bridge.mp4',
    poster: '/videos/cat-tutu-bridge.jpg',
    seconds: 18,
    sound: true,
    alt: 'A cat in a pink tutu on a river bridge kicks a gold ball into the water, then pushes a woman and her car in before riding off on a bike.',
    keywords: ['pink tutu', 'golden ball', 'concrete bridge', 'brown car', 'pink bicycle'],
    prompts: [
      'What does the cat push into the river one after another?',
      'What is the most mischievous thing you have seen an animal do?',
    ],
    howTo: {
      steps: [
        "A cat in a dress stands *on* a bridge *over* a river.",
        "First, it kicks a gold ball *into* the water.",
        "Then it pushes a woman and her car *off* the bridge.",
        "It rides *away* *on* a pink bike and looks {happy} and {funny}.",
      ],
      useful: ["on a bridge", "kick into the water", "ride away on a bike"],
    },
  },
  {
    // source: video_2026-11-11_10-09-46.mp4
    id: 'kitten-volcano-popcorn',
    ai: true,
    src: '/videos/kitten-volcano-popcorn.mp4',
    poster: '/videos/kitten-volcano-popcorn.jpg',
    seconds: 11,
    sound: true,
    alt: 'A ginger kitten in a helicopter pours a sack of corn into a glowing volcano crater, and a huge explosion of popcorn fills the cabin.',
    keywords: ['ginger kitten', 'sack of corn', 'volcano crater', 'glowing lava', 'popcorn'],
    prompts: [
      'What happens after the kitten pours the sack of corn into the volcano?',
      'What is your favourite snack to make or eat when watching a movie?',
    ],
    howTo: {
      steps: [
        "A ginger kitten is sitting *in* a helicopter *above* a volcano.",
        "It pours a bag *of* corn *down* *into* the hot volcano.",
        "The corn turns *into* white popcorn and flies *up*.",
        "Popcorn fills the helicopter, and the kitten looks {surprised} and {happy}.",
      ],
      useful: ["above a volcano", "pour into", "turn into"],
    },
  },
];

// Which clips a topic gets lives in topicVideos.js, which
// scripts/assign_topic_videos.js generates from this deck — see
// utils/fetchTopicVideos.js.
export default describeVideos;
