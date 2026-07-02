const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/data/weeklyContent.js');
let content = fs.readFileSync(filePath, 'utf8');

const keywords = {
  1: ["person packing suitcase travel", "airport departure board travelers", "tourist map city street", "family boarding airplane", "backpacker hiking mountain trail"],
  2: ["person typing laptop modern office", "smartphone app screen interaction", "virtual reality headset gamer", "server room technician working", "smart home technology tablet"],
  3: ["chef cooking busy kitchen", "family eating dinner table dining", "street food stall night market", "person eating fresh salad healthy", "waiter serving food restaurant"],
  4: ["students classroom raising hands", "teacher writing chalkboard school", "university library studying books", "graduation ceremony students throwing hats", "person taking online course laptop"],
  5: ["person running park morning exercise", "doctor examining patient stethoscope", "yoga class meditation studio", "healthy breakfast fresh fruit", "therapist talking to patient clinic"],
  6: ["planting tree volunteer nature", "recycling bin sorting plastic glass", "solar panels roof sunlight", "electric car charging station", "cleaning beach volunteers trash"],
  7: ["business meeting office colleagues", "person working from home laptop", "job interview shaking hands professional", "construction worker helmet building site", "presentation whiteboard office team"],
  8: ["person scrolling smartphone social media", "influencer recording video phone", "friends taking selfie smiling", "typing message phone texting", "laptop showing social media feed"],
  9: ["person paying card payment store", "counting cash money hands", "family budget planning table", "online banking phone screen", "piggy bank savings coins"],
  10: ["watching movie cinema popcorn", "family watching tv living room", "film set camera crew shooting", "actor on stage theatre performing", "streaming series laptop bed"],
  11: ["person playing guitar stage concert", "band performing live music audience", "listening music headphones smiling", "dj playing music festival crowd", "choir singing church school"],
  12: ["paparazzi taking photos red carpet", "celebrity signing autographs fans", "famous actor interview microphone", "award ceremony giving speech stage", "fashion model runway walking"],
  13: ["person painting canvas studio art", "gardening planting flowers backyard", "playing chess board game friends", "knitting sweater cozy armchair", "pottery making clay wheel hands"],
  14: ["shopping clothes store fitting room", "fashion designer drawing sketches studio", "sewing machine making clothes tailor", "model wearing stylish outfit street", "closet full of clothes choosing"],
  15: ["animator drawing tablet computer screen", "child watching cartoon tablet happy", "voice actor recording studio microphone", "colorful cartoon character illustration sketch", "parents kids cinema animated film"],
  16: ["person covering eyes scary movie", "fear of heights looking down tall building", "spider web close up scary", "person speaking public audience nervous", "scared face haunted house dark"],
  17: ["friends hugging laughing cafe", "couple holding hands walking beach", "family hugging reunion airport", "friends drinking coffee chatting table", "two people arguing hands gesture"],
  18: ["football players match stadium", "tennis player hitting ball court", "runner crossing finish line marathon", "swimmer diving pool competition", "coach talking team locker room"],
  19: ["person walking dog park playing", "veterinarian checking cat clinic pet", "feeding street animals cat dog", "child holding puppy happy", "cat sleeping on lap cozy"],
  20: ["traditional dance festival colorful costumes", "family celebrating holiday dinner table", "wedding ceremony traditional dress bride", "people praying temple church mosque", "cooking traditional food grandmother"],
  21: ["telescope looking stars night sky", "scientist laboratory microscope experiment", "astronaut space suit floating rocket", "rocket launch fire sky space", "students science class chemistry experiment"],
  22: ["busy city street traffic crowd", "peaceful countryside farm village field", "subway train commuters morning rush", "farmer tractor green field working", "city skyline night lights tall buildings"],
  23: ["reading book library quiet studying", "person reading novel bed lamp", "bookstore buying books shelves", "reading e-book tablet cafe", "child reading book parent bedtime"],
  24: ["people talking different languages speech bubbles", "teacher teaching language classroom pointing", "tourist asking directions map local", "sign language hands interpreting", "dictionary translation book study"],
  25: ["shopping mall carrying bags happy", "cashier scanning items supermarket checkout", "online shopping laptop credit card", "window shopping looking store display", "customer trying shoes shop"],
  26: ["person writing goals notebook desk", "graduating student looking future happy", "entrepreneur standing new business shop", "mountain climber reaching peak success", "daydreaming thinking future window"],
  27: ["museum looking ancient artifacts history", "archaeologist digging ruins ancient city", "old historical photograph black and white", "tourists visiting ancient monument ruins", "teacher history class map world"],
  28: ["futuristic city flying cars concept", "robot helping human artificial intelligence", "vr headset virtual world future", "hologram projection future technology", "future space colony planet concept"],
};

Object.keys(keywords).forEach(day => {
  const words = keywords[day];
  const regex = new RegExp(`(day: ${day},\\s*topic: "[^"]+",)`);
  const replacement = `$1\n    imageKeywords: [\n${words.map(w => `      "${w}"`).join(',\n')}\n    ],\n    manualImageUrls: [],`;
  content = content.replace(regex, replacement);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated weeklyContent.js with imageKeywords!');
