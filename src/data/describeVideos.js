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
        "A chef in a white apron is standing *at* a stainless-steel kitchen counter.",
        "He holds a heavy frying pan *over* a bright gas flame, looking {focused}.",
        "He shakes the handle and tosses the vegetables high *into* the air.",
        "The vegetables land back *in* the hot pan while he keeps cooking {confidently}.",
      ],
      useful: ["toss in the pan", "cook over a flame", "shake the handle"],
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
        "Two dogs are running *across* the green grass *in* an open park.",
        "One dog sprints *in front*, looking {excited} with its tail wagging.",
        "The second dog chases right *behind* it and turns *in* a wide circle.",
        "Both dogs keep racing *around* the lawn, full of {playful} energy.",
      ],
      useful: ["chase each other", "run in circles", "wag its tail"],
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
        "A boy is sitting cross-legged *on* a low wall *in* a vegetable garden.",
        "A basketball rests *on* the ground *beside* him while he strums a guitar, looking {relaxed}.",
        "A large rooster stands right *next to* him and listens {curiously}.",
        "The boy keeps playing his song *until the end* without the bird moving away.",
      ],
      useful: ["sit cross-legged", "strum a guitar", "stand next to"],
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
        "A group of friends are standing *by* the edge of a quiet pond *among* tall reeds.",
        "One person grabs a rope swing and swings far out *over* the water, looking {fearless}.",
        "*At* the highest point, they suddenly let go *of* the rope.",
        "They drop straight *into* the pond with a big splash, leaving everyone {amused}.",
      ],
      useful: ["take turns", "swing out over", "let go of"],
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
        "A group of trekkers are standing still *on* a narrow path *in* a dense forest.",
        "A large mountain gorilla walks slowly *past* them while chewing leaves, looking {calm}.",
        "One man reaches his arm *out* and holds an open palm *towards* the animal, {carefully}.",
        "The gorilla continues *down* the trail without touching his hand.",
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
        "A small camera is mounted *on* a bird feeder *in* a green garden.",
        "*At first*, a squirrel climbs *onto* the tray to eat seeds, and then a dove lands *in* its place.",
        "*After that*, a deer walks *up to* the feeder, looking {curious}.",
        "The deer pushes its nose right *into* the seed tray and eats {happily}.",
      ],
      useful: ["climb onto", "one after another", "push its nose into"],
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
        "An estate agent in a suit is standing *at* the top of a carpeted staircase *in* an empty house.",
        "He turns to speak *to* the camera, looking {confident}.",
        "Suddenly his foot slips *on* the top step and he loses his footing.",
        "He slides all the way *down* the stairs, looking {shocked} and {embarrassed}.",
      ],
      useful: ["lose his footing", "slip on the stairs", "slide all the way down"],
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
        "A ginger hen is lying comfortably *on* a blue blanket *on* a sofa.",
        "Someone strokes its feathers gently *from* its head *down* its back, and the bird looks {relaxed}.",
        "Each time the hand stops and pulls *away*, the hen looks {impatient}.",
        "It pushes its head back *under* the person’s fingers to ask *for* more.",
      ],
      useful: ["lie on a blanket", "stroke gently", "push back for more"],
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
        "A spotted leopard is walking slowly *down* a dusty track *in front of* a safari vehicle.",
        "Tall dry grass grows *on* both sides of the road *in* the evening light.",
        "The leopard glances *around* {calmly}, completely {unbothered} by the car.",
        "*At the end*, it stops *in* the middle of the road and lies *down* in the dust.",
      ],
      useful: ["walk down a track", "lie down in the dust", "glance around"],
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
        "A guest is sitting *at* a crowded table *in* a busy restaurant, surrounded *by* plates of salad.",
        "A waiter stands *beside* the table holding a huge curved knife *over* a hot round bread pie.",
        "He slices *across* the crust, and thick steam rises *into* the air.",
        "The guest watches the waiter cut the dish, looking {impressed} and {hungry}.",
      ],
      useful: ["sit at a table", "slice across", "rise into the air"],
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
        "A man is standing *on* a narrow wooden pier *above* the sea.",
        "He holds a large fish *up* to the camera, looking {proud} of his catch.",
        "Then he kneels *down* *at* the edge to put the fish back *into* the water.",
        "He suddenly loses his balance and tumbles headfirst *into* the sea, coming up {soaked}.",
      ],
      useful: ["hold up", "put back in", "lose his balance"],
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
        "The view starts high *in* the sky *above* the clouds and a huge city.",
        "The person is falling fast *through* the air *towards* the streets *below*, feeling {terrified}.",
        "Just *before* hitting the ground, the scene suddenly cuts *to* a dark bedroom.",
        "The person wakes up lying safely *in* bed, {relieved} that it was only a dream.",
      ],
      useful: ["fall through the air", "rush towards", "wake up in bed"],
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
        "A news presenter is sitting *at* a desk *in front of* a bright screen *in* a TV studio.",
        "She is speaking {seriously} *into* the camera during a live broadcast.",
        "*Behind* her, a crew member gets down *on* hands and knees and crawls *across* the floor.",
        "The person tries to stay {unnoticed} while the presenter keeps talking *without* stopping.",
      ],
      useful: ["on live TV", "crawl across the floor", "keep talking"],
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
        "A man wearing a helmet is crouching *beside* a fast narrow canal *next to* green rice fields.",
        "He puts a small toy boat *into* the water, and the current carries it *down* the channel.",
        "He runs *along* the concrete bank *after* the boat, looking {excited}.",
        "*At the end*, he jumps *into* the canal himself and slides *along* with the water, {laughing}.",
      ],
      useful: ["drop into the water", "run along the bank", "slide into"],
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
        "A roller coaster car full of passengers is climbing *up* a steep metal track.",
        "A giant ferris wheel stands *next to* the ride *against* a cloudy sky.",
        "The car moves slowly *towards* the very top *of* the rail while riders sit {tense} and {excited}.",
        "*At* the peak, the track curves *down* for the big drop ahead.",
      ],
      useful: ["climb a steep track", "at the very top", "be about to drop"],
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
        "Two white cups are sitting *on* a wooden table.",
        "A person lifts one cup and tilts it *over* the second cup to pour the coffee *in*, acting {hurriedly}.",
        "Instead of going neatly *into* the cup, dark coffee splashes *over* the rim.",
        "A large puddle spreads *across* the table, leaving a {messy} spill.",
      ],
      useful: ["pour into", "splash over the rim", "spread across"],
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
        "A bride in a white dress and a groom in a suit are dancing *in* the middle *of* a shiny floor.",
        "The groom holds her hand and spins her *around* *under* his arm, both looking {joyful}.",
        "Her feet suddenly slip *on* the smooth floor and she drops straight *down*.",
        "He puts both hands *on* his head, looking {shocked} and {guilty}.",
      ],
      useful: ["spin around", "slip on the floor", "put hands on his head"],
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
        "Dark blue waves are rolling *across* the sea *towards* a group of red rocks.",
        "*At first*, the water moves {calmly} *against* the shore *under* a clear horizon.",
        "Then a powerful wave slams {violently} straight *into* the rocks.",
        "White spray shoots high *into* the air and falls *back* *over* the stone.",
      ],
      useful: ["roll in", "slam into the rocks", "explode into spray"],
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
        "Thousands of fans in red shirts are sitting *in* the stands *around* a bright football pitch.",
        "Down *on* the grass, the players score a goal and sprint *towards* the corner.",
        "They jump *around* each other *in* a tight group, looking {ecstatic}.",
        "The crowd cheers {wildly} while the scoreboard glows *above* the stadium.",
      ],
      useful: ["in the stands", "run together", "celebrate a goal"],
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
        "Two red dice are resting still *on* a flat white table.",
        "Suddenly, two more dice drop *down* *from* above.",
        "They bounce *off* the surface and crash right *into* the first pair, {unexpectedly}.",
        "All four dice roll *across* the table before coming *to* a {quiet} stop.",
      ],
      useful: ["fall from above", "bounce off", "knock into"],
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
        "A small white kitten is hiding *under* a grey sofa *on* a patterned carpet.",
        "A pink fluffy toy sits *in front of* the gap, and the kitten bats *at* it, looking {playful}.",
        "It pulls the toy *towards* itself with its paws.",
        "*At the end*, the kitten dashes *out* *from* under the sofa {energetically}.",
      ],
      useful: ["hide under", "play with a toy", "run out from under"],
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
        "Several guests are sitting *around* a restaurant table with a hot sizzling pan *in* the middle.",
        "They hold their phones *up* *above* the plates, looking {eager} to record.",
        "A waiter wearing a red oven glove leans *over* the table and pours dark sauce *into* the pan.",
        "Steam rises *up* immediately while the guests film the dish {excitedly}.",
      ],
      useful: ["lean over the table", "pour sauce into", "film on their phones"],
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
        "A young man in a checked shirt is standing *at* the stove *in* a home kitchen.",
        "He holds a frying pan *with* one hand while his friend watches *behind* him, looking {curious}.",
        "With a quick flick *of* his wrist, he tosses the food *up* and catches it *in* the pan.",
        "Both friends laugh {happily}, {pleased} that the trick worked.",
      ],
      useful: ["stand at the stove", "toss food in a pan", "laugh together"],
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
        "A white cat is lying *on* a polished wooden floor *near* long curtains.",
        "Someone dangles a small toy *on* a string right *in front of* its face.",
        "The cat grabs the toy *with* its paws and bites it, looking {determined}.",
        "Then it stands *up* and walks *away* carrying the toy {proudly}.",
      ],
      useful: ["dangle in front of", "grab with its paws", "walk off with"],
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
        "A group of children wearing colourful party hats are gathered *around* a plate *of* doughnuts.",
        "Small birthday candles are burning *on* top *of* the doughnuts.",
        "One boy leans *forward* and blows the flames *out*, looking {happy}.",
        "*Right after*, all the children clap their hands and cheer {excitedly}.",
      ],
      useful: ["gather around", "blow out the candles", "clap and cheer"],
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
        "A small child dressed *in* a penguin costume is standing *on* a wooden floor.",
        "The child holds a large sheet of paper *up* *in front of* their face.",
        "There is a colourful drawing *of* a penguin *on* the paper.",
        "The child peeks *out* *from* behind the picture, smiling {proudly} and {shyly}.",
      ],
      useful: ["dress up in a costume", "hold up a drawing", "peek out from behind"],
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
        "A footballer is standing *on* the green pitch *in front of* the goal.",
        "The goalkeeper waits *on* the goal line, looking {focused} and {tense}.",
        "The player runs *up* and kicks the ball hard *towards* the net.",
        "The goalkeeper dives *across* the grass and lands flat *on* the ground.",
      ],
      useful: ["take a penalty", "dive across", "land on the grass"],
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
        "A woman with a handbag is standing *on* a city pavement *in* the daytime.",
        "Her friend runs *down* the street *towards* her with open arms, looking {overjoyed}.",
        "They throw their arms *around* each other and hug tightly *in* the middle of the sidewalk.",
        "Both women rock *from* side to side and laugh {warmly}.",
      ],
      useful: ["run up to", "throw arms around", "hug tightly"],
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
        "A woman in a black bodysuit is standing barefoot *at* the bottom *of* a staircase.",
        "A pair of high-heeled shoes sits *on* the floor *behind* her.",
        "She bends backwards *until* her hands touch the ground and lifts her legs *into* the air, looking {calm}.",
        "While balancing upside *down*, she slides her feet {carefully} *into* the heels.",
      ],
      useful: ["bend backwards", "balance upside down", "slip feet into shoes"],
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
        "A baby goat and a fluffy white calf are standing side *by* side *in* a wooden barn.",
        "Both animals have their heads *in* metal feeding chutes, drinking milk {eagerly}.",
        "After finishing the milk, they pull their heads *back* *from* the trough.",
        "They turn *around* and wander *off* across the barn floor, looking {content}.",
      ],
      useful: ["side by side", "drink from a chute", "wander off"],
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
        "A small grey donkey foal is standing *in* a sandy yard *next to* a wooden fence.",
        "Suddenly it jumps *up* and kicks its back legs *into* the air, looking {energetic}.",
        "After bouncing *around* the yard, it trots straight *up to* the camera.",
        "It stretches its neck *forward* and sniffs the lens {curiously}.",
      ],
      useful: ["kick its back legs", "trot up to", "sniff the camera"],
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
        "A young giraffe with brown spots is standing *inside* a bright stable.",
        "A funny dark tuft of hair sticks straight *up* *on* top *of* its head.",
        "It walks slowly *towards* the camera *on* its long legs, looking {curious}.",
        "Then it stops right *in front of* the lens and stares *at* it {calmly}.",
      ],
      useful: ["stick straight up", "walk up to", "stare straight into"],
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
        "A large brown bear is sitting *in* a muddy puddle *in* the middle of a forest.",
        "Water sprays *out of* a hose, and the bear bites and paws *at* the stream, looking {playful}.",
        "Water splashes all *around* the puddle while it rolls *in* the mud.",
        "*At the end*, the bear suddenly stands *up* and charges *towards* the camera, looking {fierce}.",
      ],
      useful: ["sit in a puddle", "spray everywhere", "run straight at"],
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
        "A barefoot man is climbing *up* the narrow trunk *of* a tall jungle tree.",
        "The camera looks *down* *past* his feet *towards* the green forest floor far *below*.",
        "He grips the bark and thin branches *with* his hands and feet, moving {confidently}.",
        "Soon he reaches the high canopy *above* the other trees, feeling {fearless}.",
      ],
      useful: ["climb up a trunk", "far below", "hold on to branches"],
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
        "A white-and-brown lemur is sitting *near* a tree *by* a dirt path.",
        "It takes a small piece of fruit and climbs *up* *onto* a low trunk, looking {alert}.",
        "Then it drops *down* *onto* the forest path and stands *on* its two back legs.",
        "With its arms held wide *open*, it hops sideways *along* the ground {gracefully}.",
      ],
      useful: ["climb onto a tree", "stand on two legs", "hop sideways"],
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
        "A golden retriever is sitting *on* mossy rocks *in* a green forest.",
        "It is wearing a black hooded cloak *over* its head and holding a wooden staff *between* its paws.",
        "A person’s hand reaches *in* and hangs a shiny amulet *onto* the staff.",
        "The dog sits completely still and looks *ahead* {calmly} and {patiently}.",
      ],
      useful: ["dressed in a cloak", "sit on rocks", "hang onto"],
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
        "A tiny chick, a kitten, and a rabbit — all with ginger fur and feathers — are sitting *on* the green grass.",
        "They are lined *up* side *by* side *in* a neat row, looking {peaceful}.",
        "The chick and the rabbit stay still *on* either side *of* the kitten.",
        "The kitten turns its head *from* one friend *to* the other, looking {curious}.",
      ],
      useful: ["sit side by side", "in a row", "look from one to the other"],
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
        "A narrow hammock is tied high *up* *between* two tall apartment buildings.",
        "Wet laundry hangs *on* a line right *next to* the hammock, far *above* the street.",
        "A man is lying *inside* the hammock and reading, looking completely {relaxed}.",
        "The camera zooms *out* to show the windows and the huge drop *below*, which looks {terrifying}.",
      ],
      useful: ["tied between", "high above the street", "zoom out"],
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
        "A tiny hedgehog is standing *on* a smooth wooden floor *at* one end of a room.",
        "It starts running fast *on* its short legs straight *towards* the camera, looking {eager}.",
        "Its spiky body bounces slightly as it hurries *across* the boards.",
        "*At the end*, it bumps right *past* the lens and keeps going, {unbothered}.",
      ],
      useful: ["run across the floor", "head straight for", "bump past"],
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
        "Several black-and-white kittens are gathered *on* a wooden floor *in front of* a chest of drawers.",
        "One kitten bats a green plastic bottle, sending it rolling *across* the room.",
        "The other kittens chase *after* the bottle *together*, looking {excited} and {playful}.",
        "An adult cat lies *in* the background and watches them *from* a distance.",
      ],
      useful: ["bat across the floor", "chase after", "watch from a distance"],
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
        "A man in an orange shirt and cap is leaning *against* a stone wall *outdoors*.",
        "A white seagull is standing *on* the top *of* the wall right *next to* him.",
        "The man waves his hands *in* the air as if having a {serious} argument *with* the bird.",
        "The seagull stares back *at* him without flying away, looking {unbothered}.",
      ],
      useful: ["lean on a wall", "wave his hands", "argue with"],
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
        "The clip is filmed *through* the side window *of* a car driving *along* a busy road.",
        "Two giant moose with big antlers are walking *on* the grass strip *beside* the tarmac.",
        "Cars pass right *by* them, with tall pine trees standing *behind* the animals.",
        "Both moose keep walking steadily *along* the roadside, looking {calm} and {unhurried}.",
      ],
      useful: ["filmed from a car", "walk along the roadside", "drive past"],
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
        "A very round, fluffy bird is perched *on* a thin branch *in* a garden.",
        "A red brick wall stands *in* the background *behind* the green leaves.",
        "The bird sits *on* the twig looking {calm} with its soft white chest puffed *out*.",
        "Then it hops *around* *on* the branch to show its bright blue back and tail, looking {adorable}.",
      ],
      useful: ["perch on a branch", "puff out", "turn around"],
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
        "A small tortoise with orange spots on its head is standing *beside* a yellow toy truck.",
        "It is wearing a tiny knitted backpack *on* its shell, which looks {funny}.",
        "Someone holds a slice of apple right *in front of* its mouth.",
        "The tortoise stretches its neck *out* and takes big bites *out of* the apple {eagerly}.",
      ],
      useful: ["hold out", "stretch its neck", "take a bite out of"],
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
        "An older woman in glasses and a flowery dress is standing *beside* an unfinished brick wall.",
        "She scoops wet mortar *with* a metal trowel and spreads it *along* the top row *of* bricks.",
        "Then she places a new brick *onto* the mortar and taps it *into* place, working {skillfully}.",
        "*At the end*, she turns *to* the camera and gives a big thumbs up, smiling {proudly}.",
      ],
      useful: ["spread mortar", "lay bricks", "give a thumbs up"],
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
        "A wild monkey walks *into* a bright living room *through* an open balcony door.",
        "It steps *around* a glass coffee table while looking *around* the room {curiously}.",
        "A woman in a green top runs *in* and waves her hand *at* the monkey, looking {alarmed}.",
        "The monkey hurries back *out* *onto* the balcony with the sea *in* the background.",
      ],
      useful: ["walk into a room", "chase out", "run out onto the balcony"],
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
        "A cat is lying *on* the road right *under* the front bumper *of* a parked car.",
        "A delivery rider bends *down*, grabs the cat gently, and pulls it *out* onto the pavement.",
        "Instead of walking *away*, the cat flops *onto* its side, looking {stubborn}.",
        "It rolls right back *under* the car to the exact same spot, completely {unbothered}.",
      ],
      useful: ["pull out from under", "flop onto its side", "roll back"],
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
        "A man in a red shirt is standing *at* the back *of* a delivery lorry *in* the street.",
        "He pulls a tall refrigerator *towards* the edge and balances it *onto* his back, looking {determined}.",
        "Holding the weight *with* his arms, he steps *away* from the lorry.",
        "He walks steadily *down* the street carrying the huge fridge all *by* himself, looking {strong}.",
      ],
      useful: ["take off a lorry", "lift onto his back", "carry by himself"],
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
        "A man in a dark uniform is standing *next to* a large glass fish tank *in* a shop.",
        "He climbs *up* and leans far *over* the glass edge to catch a fish *inside*, looking {focused}.",
        "Suddenly his feet slip and he tumbles headfirst right *into* the deep water.",
        "He stands *up* *inside* the tank completely {soaked} and waves *at* the camera, {embarrassed}.",
      ],
      useful: ["lean over the edge", "fall in headfirst", "soaking wet"],
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
        "A ginger cat is sitting *inside* the yellow back *of* a toy dump truck.",
        "The truck rolls smoothly *across* a shiny floor *towards* a cardboard box.",
        "The cat stays sitting *in* the truck, looking completely {calm} and {unbothered}.",
        "The toy truck drives straight *into* the open cardboard box with the cat still *on* board.",
      ],
      useful: ["ride in the back", "roll across the floor", "drive straight into"],
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
        "A tiny wooden door is built *into* the bottom *of* a wide tree trunk.",
        "A person reaches *down* and knocks gently *on* the little door.",
        "The door swings *open*, and small kittens walk *out* one *by* one holding bunches of flowers, looking {adorable}.",
        "They stand *in* a neat line *in front of* the tree, waiting {patiently}.",
      ],
      useful: ["knock on a door", "one by one", "line up"],
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
        "A woman in a winter coat is walking *along* an icy pavement *at* night.",
        "Bright shop lights shine *onto* the snow *beside* the path while other people walk *past*.",
        "Her boots suddenly slide *out* from *under* her on the ice, leaving her {helpless}.",
        "She falls sideways right *into* a deep pile of snow, looking {stunned}.",
      ],
      useful: ["walk along a path", "slip on the ice", "fall into a snow pile"],
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
        "A lorry is driving *down* a busy motorway *on* a sunny day.",
        "*Inside* the cab, a brown sloth is lying stretched *out* *across* the dashboard.",
        "It rests right *above* the steering wheel *in* the warm sunlight, looking {sleepy}.",
        "The sloth slowly moves its head and long claws, completely {relaxed} during the ride.",
      ],
      useful: ["lie stretched out", "on the dashboard", "drive down a motorway"],
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
        "A man is sitting *on* the ground *near* the top *of* a steep rocky hillside.",
        "He places both feet *against* a huge boulder *in front of* him, looking {determined}.",
        "With a hard push, he sends the rock rolling *down* the slope.",
        "The boulder crashes *through* the dry bushes and kicks *up* dust, which looks {dangerous}.",
      ],
      useful: ["push with his feet", "roll down a slope", "crash through bushes"],
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
        "A cat is running fast *across* the floor *of* a large empty room.",
        "It sprints straight *towards* a plain wall *next to* a television.",
        "The cat leaps high *up* *against* the wall, looking {energetic} and {fearless}.",
        "It pushes *off* the wall with its paws and flies backwards *through* the air.",
      ],
      useful: ["run across a room", "jump up the wall", "push off"],
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
        "Several turtles are sitting *in* a row *on* a floating log *in* a green pond.",
        "Another turtle climbs *out of* the water and pulls itself *onto* the log.",
        "The extra weight makes the round log tip and roll *over* *in* the water.",
        "The turtles scramble {frantically} to keep their balance before slipping *off*, looking {clumsy}.",
      ],
      useful: ["climb onto a log", "keep their balance", "tip over"],
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
        "A fluffy ginger cat is standing *on* its hind legs *in front of* a white washing machine.",
        "*Inside* the round glass door, wet clothes are spinning *around* fast.",
        "The cat watches the laundry {intently} and scratches rapidly *at* the glass *with* its front paws.",
        "It keeps pawing *at* the door, {confused} about why it cannot catch the clothes.",
      ],
      useful: ["stand on hind legs", "spin around inside", "paw at the glass"],
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
        "A grey squirrel with a bushy tail is sitting *on* a metal drinking fountain *in* a park.",
        "A steady stream of water arches *up* *from* the spout.",
        "The squirrel leans *over* the basin and holds its paws *by* the water, looking {thirsty}.",
        "It drinks neatly *from* the running stream just like a person, looking {calm}.",
      ],
      useful: ["climb onto", "drink from a fountain", "lean over"],
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
        "The scene is filmed *from* inside a car *in* a wet supermarket car park.",
        "Strong wind and rain are blowing *across* the tarmac *towards* a row of parked cars.",
        "An empty metal shopping trolley starts rolling *across* the open space *on* its own.",
        "It gathers speed *towards* the cars, making the situation look {tense} and {risky}.",
      ],
      useful: ["roll across a car park", "on its own", "head towards"],
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
        "A fisherman is standing *by* the seafront holding his fishing rod *over* the water.",
        "A plastic bucket sits *on* the pavement *behind* him while people walk *past*.",
        "A cat sneaks *up* to the bucket, sticks its head *inside*, and grabs a fish {boldly}.",
        "It runs *off* *down* the promenade with the fish in its mouth, looking {pleased}.",
      ],
      useful: ["sneak up to", "put its head in", "run off with"],
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
        "A squirrel is clinging *to* the glass *of* an open door *by* a garden.",
        "It hangs *near* the door handle and peers *into* the house, looking {curious}.",
        "The person filming moves the camera closer *to* the glass.",
        "All *of* a sudden, the squirrel leaps straight *at* the camera, which is {startling}.",
      ],
      useful: ["hold on to", "peer into", "jump straight at"],
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
        "At night, the camera zooms *in* *from* outside *towards* a bright apartment window.",
        "*Inside* the room, a dog wearing glasses is sitting *in* an office chair *at* a computer.",
        "The dog turns its head and spots the camera filming *from* the street, looking {annoyed}.",
        "It reaches *over* and pulls the curtain shut *across* the window for privacy, acting {serious}.",
      ],
      useful: ["zoom into a window", "sit at a computer", "pull the curtain shut"],
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
        "A ginger cat is standing *on* top *of* a metal cooking pot *near* a window.",
        "When the camera gets close, the cat quickly jumps *down* *onto* the counter.",
        "It sits right *beside* the pot and stares *at* the camera with huge round eyes, looking {guilty}.",
        "*Behind* it, a second cat watches the whole scene {quietly}.",
      ],
      useful: ["jump down from", "sit beside", "stare with big eyes"],
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
        "Two men are carrying a heavy air conditioner *along* the narrow edge *of* a swimming pool.",
        "One man walks backwards *in front*, guiding the unit *towards* a ladder, looking {careful}.",
        "He takes one step too close *to* the edge and his foot misses the tiles.",
        "He falls straight backwards *into* the pool with the box, leaving his partner {shocked}.",
      ],
      useful: ["walk backwards", "along the edge", "fall into the pool"],
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
        "A little girl is standing *outside* a wooden stable *in* a yard.",
        "She holds a long stick *out* *in front of* her with a carrot attached *to* the end, feeling {nervous} to get too close.",
        "A brown horse leans its head *out* *through* the stable window.",
        "The horse bites the carrot *off* the stick and munches it {happily}.",
      ],
      useful: ["hold out a stick", "lean out of a window", "bite off"],
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
        "A black dog and a grey cat meet *on* the green grass *by* the side of a path.",
        "They pause *next to* each other for a moment, looking {friendly} and {relaxed}.",
        "Then both animals turn *onto* a long gravel path.",
        "They walk *away* together side *by* side *down* the road like old friends.",
      ],
      useful: ["meet in the grass", "side by side", "walk off together"],
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
        "A white cat is lying *on* its back *on* a blue merry-go-round *in* a playground.",
        "The roundabout spins slowly *around* *in* circles.",
        "The cat keeps its paws *up* *in* the air while riding upside *down*.",
        "It makes no effort to get *off*, looking completely {relaxed} and {unbothered}.",
      ],
      useful: ["lie on its back", "spin round and round", "upside down"],
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
        "A brown bear is sitting high *up* *in* an apple tree *on* a quiet street.",
        "A bright rainbow arches *across* the sky *behind* the neighbourhood houses.",
        "The bear balances *on* a thick branch and reaches *for* the red apples, looking {content}.",
        "It pulls the fruit *to* its mouth and eats {calmly} without caring about the street *below*.",
      ],
      useful: ["high up in a tree", "balance on a branch", "reach for"],
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
        "A birthday cake with lit candles is sitting *on* a table *in* a dining room.",
        "A small dog puts its front paws *up* *on* the table edge, looking {greedy}.",
        "It stretches its tongue *out* and licks the white cream *on* the side of the cake.",
        "Just *at* that moment, the family walks back *into* the room, looking {surprised}.",
      ],
      useful: ["jump up to the table", "lick the cream", "walk back in"],
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
        "A cat is sitting *on* a wooden kitchen table *next to* a full glass of water.",
        "It looks straight *at* the camera, seeming {calm} and {mischievous}.",
        "Slowly, the cat reaches its paw *out* and taps the glass *towards* the edge.",
        "One final push sends the glass falling *off* the table *onto* the floor.",
      ],
      useful: ["stare at the camera", "push towards the edge", "knock off the table"],
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
        "A dog is alone *on* the sofa *in* a living room, biting a soft cushion.",
        "It rips the fabric *open* and white feathers fly all *over* the carpet.",
        "Suddenly the front door opens *in* the background and the owner steps *inside*.",
        "The dog immediately stops and lies *down* *among* the feathers, trying to look {innocent} and {calm}.",
      ],
      useful: ["rip apart", "fly everywhere", "act innocent"],
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
        "A car is parked *outside* a wooden barn *on* a farm.",
        "A goat jumps *onto* the bonnet and climbs right *up* *onto* the car roof, looking {bold}.",
        "It stands *on* top *of* the car and looks *around* the yard.",
        "A farmer runs *out* and waves her arms *at* the goat, looking {frustrated}.",
      ],
      useful: ["jump onto the bonnet", "climb onto the roof", "wave her arms"],
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
        "A cat is sitting *on* top *of* a round robot vacuum cleaner *in* a hallway.",
        "The vacuum glides *across* the wooden floor while the cat rides *along*, looking {unbothered}.",
        "Then the machine bumps straight *into* the bottom *of* a wall.",
        "The sudden stop makes the cat slide *off* the vacuum *onto* the floor, looking {surprised}.",
      ],
      useful: ["ride on top of", "bump into a wall", "slide off"],
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
        "A closed pizza box is sitting *on* a doormat *in front of* a house door.",
        "A large seagull lands *on* the doorstep and walks *up to* the box, looking {bold}.",
        "It uses its sharp beak to flip the cardboard lid *open*.",
        "The bird grabs a big slice of pizza *out of* the box and flies *away*, looking {pleased}.",
      ],
      useful: ["land on a doorstep", "flip the lid open", "fly away with"],
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
        "A man is walking *down* a wet street *in* heavy rain, holding an open umbrella *over* his head.",
        "A strong gust of wind blows *across* the road and flips the umbrella *inside out*.",
        "*Right after*, the wind rips the umbrella *out of* his hand and carries it *down* the pavement.",
        "The man chases *after* it *through* the puddles, looking {panicked} and {frustrated}.",
      ],
      useful: ["turn inside out", "blow away", "run after"],
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
        "A waiter wearing an apron is walking *between* tables *in* a busy café.",
        "He is carrying a round tray full *of* glasses *in* one hand.",
        "His foot suddenly trips *on* the floor and the glasses tilt *towards* the edge, making everyone {tense}.",
        "He drops *to* one knee and catches the whole tray *in* time, leaving the customers {amazed} as they clap.",
      ],
      useful: ["carry a tray", "trip over", "catch just in time"],
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
        "A ginger cat is standing *on* a messy kitchen counter *next to* a loaf of bread.",
        "It reaches *into* the plastic bag with its mouth and pulls a slice *out*, acting {sneaky}.",
        "Holding the bread firmly *in* its jaws, the cat jumps *down* *onto* the floor.",
        "It hurries *out of* the kitchen *past* the fridge, looking {pleased} with itself.",
      ],
      useful: ["pull out of a bag", "jump down from", "run out of the kitchen"],
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
        "Clean clothes are hanging *on* a washing line *in* a sunny village yard.",
        "A white goat stands *under* the line and grabs the sleeve *of* a blue shirt in its mouth, looking {stubborn}.",
        "A woman in an apron rushes *over* and grabs the other side *of* the shirt.",
        "She pulls *back* hard against the goat, looking {annoyed} and {determined} to save the laundry.",
      ],
      useful: ["hang on a washing line", "pull off", "tug back and forth"],
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
        "A man in flip-flops is walking *across* a courtyard *between* old apartment blocks.",
        "He is carrying a huge green watermelon *in* both arms.",
        "His foot catches *on* a garden hose *on* the ground, and the watermelon slips *out of* his hands, making him {panicked}.",
        "He dives *forward* and catches the fruit just *before* it hits the concrete, looking {relieved}.",
      ],
      useful: ["trip over a hose", "slip out of his hands", "catch just in time"],
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
        "A cameraman is standing *in* the middle *of* a grassy racecourse *between* yellow fences.",
        "Dark clouds hang *in* the sky while riders *on* racehorses gallop fast *towards* him.",
        "The horses split *to* both sides and thunder right *past* him *through* a wooden arch.",
        "The cameraman turns smoothly *with* his camera to film them, staying {calm} and {focused}.",
      ],
      useful: ["stand in the middle of", "gallop past", "keep filming"],
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
        "A woman in a black outfit is walking *towards* an indoor doorway *with* shoes lined *up* *on* the floor.",
        "She does not notice the spotless glass panel *in* the frame and walks straight *into* it.",
        "She bounces *back* and puts both hands *on* her head, looking {shocked} and {embarrassed}.",
        "*After* a moment, she laughs *at* her mistake while her friends watch *from* inside.",
      ],
      useful: ["walk straight into", "bounce back", "hold her head"],
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
        "A man in jeans is sitting *on* a fallen wooden log *in* the middle *of* a forest.",
        "A huge brown bear walks *up* and sits *down* *on* the log right *beside* him.",
        "The bear lifts its heavy paw and drapes its arm *around* the man’s shoulder, acting {friendly}.",
        "Both of them sit together *on* the log looking *out* at the trees, completely {relaxed}.",
      ],
      useful: ["sit down beside", "put an arm around", "like an old friend"],
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
        "A heavy armchair is swinging back and forth *on* ropes *in* a tiled courtyard.",
        "A woman waits *to* one side and then tries to sprint *across* the floor *before* the chair comes back.",
        "She times her run badly, and the swinging chair knocks her right *off* her feet.",
        "She falls *onto* the tiles while her bag spills *across* the ground, leaving her {stunned} and {embarrassed}.",
      ],
      useful: ["swing back and forth", "run past", "knock off her feet"],
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
        "A man in a blue training suit is running *along* a park path holding a stuffed toy.",
        "A black dog sprints *across* the grass *behind* him and catches *up* quickly.",
        "Instead of grabbing the toy, the dog bites the back *of* his trousers and pulls them *down*.",
        "His spotted boxers show *underneath*, leaving the trainer {surprised} while the dog stays {excited}.",
      ],
      useful: ["chase across a park", "catch up with", "pull off"],
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
        "A grey cat in a black harness is squeezing *into* a narrow crack *in* a concrete wall *by* some weeds.",
        "Its owner reaches *down* with both hands and lifts the cat *out* *of* the gap.",
        "As soon as the person sets it *on* the ground, the cat turns *around*, looking {stubborn}.",
        "It climbs straight back *into* the tight crack, completely {unbothered}.",
      ],
      useful: ["squeeze into a crack", "lift out of", "climb straight back in"],
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
        "A black-and-white cat is sitting *on* a bed with a stack *of* dollar bills.",
        "It lifts the corner *of* a beige blanket and tucks the money *underneath*, acting {secretive}.",
        "Meanwhile, a ginger cat climbs *onto* the headboard *behind* the pillows and watches {closely}.",
        "The first cat turns *around* and spots the ginger cat staring *down* at its hiding place.",
      ],
      useful: ["hide under a blanket", "climb onto", "catch someone in the act"],
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
        "An orange-and-white cat is flying *down* an empty suburban street *on* a wooden broomstick.",
        "It turns its head *towards* the camera and holds *up* two fingers *in* a peace sign, looking {playful}.",
        "Because it is not looking *ahead*, the broom drifts *off* the road *towards* the grass.",
        "The cat crashes straight *into* a metal street sign, ending the ride {clumsily}.",
      ],
      useful: ["fly down a street", "give a peace sign", "crash into a sign"],
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
        "A driver is filming *through* the side window while moving *along* a multi-lane highway.",
        "A silver car drives *in* the lane right *next to* them.",
        "As the camera pulls *up* *beside* the front window, an orange cat appears *in* the driver’s seat.",
        "The cat holds both paws *on* the steering wheel and looks *ahead* {calmly}, leaving the viewer {amazed}.",
      ],
      useful: ["in the next lane", "pull up beside", "behind the wheel"],
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
        "The camera looks *across* a courtyard and zooms *into* a bright apartment window.",
        "*Inside* the kitchen, a grey cat is standing *on* its back legs *in front of* a gas stove.",
        "The cat is holding a round glass fishbowl with a goldfish *over* the burner, looking {focused}.",
        "When the cat notices the camera *outside*, it freezes and stares *back*, looking {guilty}.",
      ],
      useful: ["zoom in on", "hold over the stove", "freeze on the spot"],
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
        "Two yellow excavators are working *on* red soil *at* the edge *of* a green jungle.",
        "Their metal arms push *against* a tall tree until it crashes *down* *into* the bushes.",
        "Not far *away*, an orangutan is standing *among* the green leaves.",
        "The animal watches the machines destroy the trees, looking {quiet} and {helpless}.",
      ],
      useful: ["push down a tree", "crash into the bushes", "watch from a distance"],
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
        "Two cats are working *on* a path, smoothing wet grey cement *with* a metal trowel.",
        "Just *after* they finish, a rooster walks right *across* the fresh cement and leaves deep footprints *in* it.",
        "The cats stare *at* the ruined surface, looking {furious}.",
        "*In* the next scene, the two cats are sitting *at* a table and eating roast chicken {happily}.",
      ],
      useful: ["smooth wet cement", "walk across", "leave footprints"],
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
        "A businessman in a suit is standing *on* a city pavement *at* night, holding a briefcase.",
        "He raises his hand to hail a ride, and a giant fluffy cat walks *up* *along* the street.",
        "The man climbs *onto* the giant cat’s back and sits *behind* its ears, looking {calm}.",
        "The huge cat trots *down* the road under the streetlights, carrying him *away* {smoothly}.",
      ],
      useful: ["hail a ride", "climb onto its back", "ride away"],
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
        "A chubby tabby cat is sitting *on* a bench *in* a gym, pulling the handles *of* a cable machine.",
        "A man in a black T-shirt walks *over* and tries to take the handles *from* the cat.",
        "The cat bats *at* him and refuses to share, looking {stubborn} and {annoyed}.",
        "When the cat pulls too hard, it loses its balance and tips backwards *off* the bench.",
      ],
      useful: ["work out at a gym", "argue over", "tip backwards"],
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
        "A small brown pony with a blonde tail is walking *out* *through* an open stable door.",
        "A black-and-white cat is lying stretched *out* *on* the pony’s back.",
        "The pony steps *into* a grassy green field while the cat rides *along*, looking {relaxed}.",
        "Neither animal seems {bothered} as they stroll *across* the yard together.",
      ],
      useful: ["lie on its back", "walk out of a stable", "stroll across a field"],
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
        "A man is lying *on* a pink flamingo float *in* a rooftop infinity pool, high *above* city skyscrapers.",
        "He rests right *at* the glass edge *of* the pool, looking {relaxed}.",
        "Someone suddenly gives the float a push *from* behind, and he thinks he is going *over* the edge.",
        "He panics and paddles backwards *with* his hands {frantically}, looking {terrified}.",
      ],
      useful: ["at the edge of", "give a push", "paddle backwards"],
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
        "A small brown dog with a curled tail is standing *on* a concrete driveway *outside* a house.",
        "A grey cat crouches low and creeps slowly *across* the yard *towards* the dog, looking {playful}.",
        "When the cat gets close, the two animals circle *around* each other *on* the pavement.",
        "Then they take turns chasing each other *back* and forth, both looking {lively}.",
      ],
      useful: ["creep up to", "circle around each other", "take turns chasing"],
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
        "An orange cat is walking *down* a flight *of* tiled stairs *on* two legs while carrying a small bowl.",
        "Halfway *down*, it stops *beside* a blue bucket, looking {tired} and {lazy}.",
        "It drops *onto* its side *on* the smooth step while a small dog watches *from* above.",
        "The cat slides slowly *down* the rest *of* the stairs on its side.",
      ],
      useful: ["walk down the stairs", "flop onto its side", "slide the rest of the way"],
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
        "A fluffy white dog is sitting *at* an outdoor restaurant table, waiting {patiently}.",
        "A cat wearing a brown waiter apron stands *beside* the table and opens a glass bottle *of* cola.",
        "Before serving the guest, the cat tilts the bottle *up* and drinks *from* it, acting {cheeky}.",
        "Then it sets the half-empty bottle *down* *in front of* the dog.",
      ],
      useful: ["wait at a table", "open a bottle", "serve to a guest"],
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
        "A pink hairdryer is lying switched *on* *on* a bathroom counter *in front of* a mirror.",
        "A tiny ginger kitten walks *across* the counter and steps right *over* the nozzle, looking {curious}.",
        "The warm air stream lifts the light kitten straight *up* *into* the air.",
        "The kitten floats and spins *around* *above* the counter, looking {surprised} but {calm}.",
      ],
      useful: ["step over", "lift into the air", "spin around"],
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
        "A cat wearing a pink tutu is standing *on* a concrete bridge *above* a river.",
        "First, it kicks a shiny golden ball *off* the bridge *into* the water, looking {mischievous}.",
        "When a woman gets *out of* her brown car to look, the cat pushes both her and the car *over* the edge.",
        "*At the end*, the cat hops *onto* a pink bicycle and rides *away* {calmly}.",
      ],
      useful: ["kick into the water", "push over the edge", "ride off on a bike"],
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
        "A ginger kitten is flying *in* a helicopter high *above* a glowing volcano crater.",
        "It holds a heavy sack *of* corn *by* the open door and pours it *down* *into* the hot lava, looking {excited}.",
        "Seconds later, the heat turns the corn *into* a giant wave *of* white popcorn.",
        "The popcorn erupts *up* from the crater and fills the helicopter cabin, leaving the kitten {delighted}.",
      ],
      useful: ["pour into a crater", "turn into popcorn", "fill the cabin"],
    },
  },
];

// Which clips a topic gets lives in topicVideos.js, which
// scripts/assign_topic_videos.js generates from this deck — see
// utils/fetchTopicVideos.js.
export default describeVideos;
