// In-call Debate deck. Each topic has two everyday sides — cats vs dogs, not
// politics — so any A1+ pair can jump in. Arguments are in English (the
// language being practiced); UI chrome around them stays Azerbaijani.
//
// Both peers see `topic`. Only your own side's `points` are ever rendered on
// your screen — same trick as Taboo's forbidden words, just flipped: you see
// your own hand, not your opponent's.
//
// TWO LEVELS, ALTERNATING:
//   simple — A1/A2. Four very short arguments, the most common words only.
//   normal — A2/B1. Five fuller arguments.
// The deck is built by interleaving them (simple, normal, simple, normal, ...)
// so a pair gets an easy card, then a harder one, then easy again. Because the
// game walks topicIndex forward one at a time, the alternation holds wherever
// the random start lands.
//
// ORDER MATTERS: the game picks a random start index, then walks the array
// sequentially (topicIndex is synced to BOTH peers via Firestore). The
// interleave below is deterministic — a pure function of the two arrays, so
// every device builds the identical order. NEVER shuffle at runtime: the two
// peers would end up on different topics.

const simpleTopics = [
  {
    topic: "Apples or bananas?",
    sideA: { label: "Apples 🍎", points: [
      "Apples are sweet and fresh.",
      "You can eat an apple very fast.",
      "Apples are good for your teeth.",
      "Apple juice is delicious.",
    ]},
    sideB: { label: "Bananas 🍌", points: [
      "Bananas are soft and easy to eat.",
      "You do not need to wash a banana.",
      "Bananas give you energy.",
      "Bananas are sweet without sugar.",
    ]},
  },
  {
    topic: "Ice cream or chocolate?",
    sideA: { label: "Ice cream 🍦", points: [
      "Ice cream is cold and perfect in summer.",
      "There are many flavours.",
      "It makes people happy.",
      "You can eat it with friends.",
    ]},
    sideB: { label: "Chocolate 🍫", points: [
      "You can carry chocolate in your bag.",
      "It does not melt in winter.",
      "A small piece is enough.",
      "Chocolate is a good gift.",
    ]},
  },
  {
    topic: "Bus or bicycle?",
    sideA: { label: "Bus 🚌", points: [
      "The bus is good when it rains.",
      "You can sit and rest.",
      "It is faster for long roads.",
      "You do not get tired.",
    ]},
    sideB: { label: "Bicycle 🚲", points: [
      "A bicycle is free.",
      "It is good exercise.",
      "You never wait for it.",
      "It is clean for the air.",
    ]},
  },
  {
    topic: "Rain or snow?",
    sideA: { label: "Rain 🌧️", points: [
      "Rain makes the trees green.",
      "The air smells fresh after rain.",
      "Rain is warmer than snow.",
      "It goes away quickly.",
    ]},
    sideB: { label: "Snow ❄️", points: [
      "Snow is white and beautiful.",
      "You can play in the snow.",
      "Snow is quiet.",
      "Winter holidays feel special with snow.",
    ]},
  },
  {
    topic: "Milk or juice?",
    sideA: { label: "Milk 🥛", points: [
      "Milk is good for your bones.",
      "You can drink it hot or cold.",
      "Milk is good with breakfast.",
      "It is not too sweet.",
    ]},
    sideB: { label: "Juice 🧃", points: [
      "Juice is fresh and sweet.",
      "There are many fruit flavours.",
      "Juice has vitamins.",
      "It is nice on a hot day.",
    ]},
  },
  {
    topic: "Day or night?",
    sideA: { label: "Day ☀️", points: [
      "You can see everything.",
      "The sun gives you energy.",
      "Friends are awake in the day.",
      "You can play outside.",
    ]},
    sideB: { label: "Night 🌙", points: [
      "The night is quiet.",
      "You can see the stars.",
      "It is time to rest.",
      "The city looks beautiful with lights.",
    ]},
  },
  {
    topic: "Pen or pencil?",
    sideA: { label: "Pen 🖊️", points: [
      "A pen is clear to read.",
      "It does not break.",
      "Pens have many colours.",
      "Important papers need a pen.",
    ]},
    sideB: { label: "Pencil ✏️", points: [
      "You can delete your mistakes.",
      "A pencil is good for drawing.",
      "It is cheap.",
      "It never dries.",
    ]},
  },
  {
    topic: "Chicken or fish?",
    sideA: { label: "Chicken 🍗", points: [
      "Chicken is easy to cook.",
      "Most children like it.",
      "You can cook it in many ways.",
      "It is not expensive.",
    ]},
    sideB: { label: "Fish 🐟", points: [
      "Fish is very healthy.",
      "It cooks very fast.",
      "Fish is light food.",
      "It is good for your brain.",
    ]},
  },
  {
    topic: "Cake or cookies?",
    sideA: { label: "Cake 🍰", points: [
      "Cake is for birthdays.",
      "It is soft and sweet.",
      "You can share a big cake.",
      "Cakes look beautiful.",
    ]},
    sideB: { label: "Cookies 🍪", points: [
      "You can eat cookies anywhere.",
      "They are good with tea.",
      "You do not need a plate.",
      "They stay fresh for days.",
    ]},
  },
  {
    topic: "Car or train?",
    sideA: { label: "Car 🚗", points: [
      "You can go any time.",
      "You can stop where you want.",
      "Your bags stay with you.",
      "It is good for families.",
    ]},
    sideB: { label: "Train 🚆", points: [
      "You can sleep on a train.",
      "There is no traffic.",
      "You can walk inside.",
      "The window view is nice.",
    ]},
  },
  {
    topic: "Bread or rice?",
    sideA: { label: "Bread 🍞", points: [
      "Bread is ready to eat.",
      "It is good for breakfast.",
      "You can make a sandwich.",
      "Fresh bread smells wonderful.",
    ]},
    sideB: { label: "Rice 🍚", points: [
      "Rice goes with every meal.",
      "It is cheap.",
      "Rice keeps you full.",
      "You can cook a lot at once.",
    ]},
  },
  {
    topic: "Music or silence?",
    sideA: { label: "Music 🎵", points: [
      "Music makes you happy.",
      "It helps you work.",
      "You can dance to music.",
      "Music is good with friends.",
    ]},
    sideB: { label: "Silence 🤫", points: [
      "It is easier to think.",
      "You can hear the birds.",
      "Silence helps you sleep.",
      "Your ears can rest.",
    ]},
  },
  {
    topic: "Sea or river?",
    sideA: { label: "Sea 🌊", points: [
      "The sea is very big.",
      "You can swim for a long time.",
      "There is sand to sit on.",
      "The sea air is fresh.",
    ]},
    sideB: { label: "River 🏞️", points: [
      "The water is cold and clean.",
      "Rivers are quiet places.",
      "There are trees around.",
      "It is close to home.",
    ]},
  },
  {
    topic: "Shoes or sandals?",
    sideA: { label: "Shoes 👟", points: [
      "Shoes keep your feet warm.",
      "You can run in shoes.",
      "They are good for rain.",
      "They protect your feet.",
    ]},
    sideB: { label: "Sandals 🩴", points: [
      "Sandals are cool in summer.",
      "You put them on very fast.",
      "They are light.",
      "They are good for the beach.",
    ]},
  },
  {
    topic: "Cats or birds as a pet?",
    sideA: { label: "Cat 🐱", points: [
      "A cat is soft and warm.",
      "Cats play with you.",
      "A cat sleeps on your bed.",
      "Cats are quiet.",
    ]},
    sideB: { label: "Bird 🐦", points: [
      "Birds sing every morning.",
      "They need a small space.",
      "Birds have beautiful colours.",
      "They are easy to feed.",
    ]},
  },
  {
    topic: "Sunny day or cloudy day?",
    sideA: { label: "Sunny ☀️", points: [
      "You can go outside.",
      "The sun makes people smile.",
      "Photos look better.",
      "Your clothes dry fast.",
    ]},
    sideB: { label: "Cloudy ☁️", points: [
      "It is not too hot.",
      "Your eyes can rest.",
      "It is good for walking.",
      "Clouds look beautiful.",
    ]},
  },
  {
    topic: "Soup or salad?",
    sideA: { label: "Soup 🍲", points: [
      "Soup is warm in winter.",
      "It is good when you are ill.",
      "Soup keeps you full.",
      "It is easy to eat.",
    ]},
    sideB: { label: "Salad 🥗", points: [
      "Salad is fresh and light.",
      "It is ready in five minutes.",
      "It has many vegetables.",
      "Salad is good in summer.",
    ]},
  },
  {
    topic: "Singing or dancing?",
    sideA: { label: "Singing 🎤", points: [
      "You can sing anywhere.",
      "Singing makes you happy.",
      "You do not need space.",
      "You can sing with friends.",
    ]},
    sideB: { label: "Dancing 💃", points: [
      "Dancing is good exercise.",
      "It is fun at parties.",
      "You do not need words.",
      "Dancing gives you energy.",
    ]},
  },
  {
    topic: "Big family or small family?",
    sideA: { label: "Big family 👨‍👩‍👧‍👦", points: [
      "There is always someone at home.",
      "Parties are fun.",
      "You learn to share.",
      "You have many people to help you.",
    ]},
    sideB: { label: "Small family 👩‍👦", points: [
      "The house is quiet.",
      "Your parents have more time for you.",
      "It is easier to travel.",
      "You have your own room.",
    ]},
  },
  {
    topic: "Playing outside or playing inside?",
    sideA: { label: "Outside 🌳", points: [
      "You get fresh air.",
      "You can run and jump.",
      "You meet other children.",
      "It is good for your health.",
    ]},
    sideB: { label: "Inside 🏠", points: [
      "You are warm and dry.",
      "Your toys are all there.",
      "You can play in any weather.",
      "It is safe.",
    ]},
  },
  {
    topic: "Cheese or eggs?",
    sideA: { label: "Cheese 🧀", points: [
      "Cheese needs no cooking.",
      "It is good with bread.",
      "There are many types.",
      "Cheese is good for your bones.",
    ]},
    sideB: { label: "Eggs 🥚", points: [
      "Eggs cook in three minutes.",
      "They are cheap.",
      "You can cook them many ways.",
      "Eggs keep you full.",
    ]},
  },
  {
    topic: "Reading or drawing?",
    sideA: { label: "Reading 📖", points: [
      "You learn new words.",
      "You can read anywhere.",
      "Books tell good stories.",
      "Reading is quiet and calm.",
    ]},
    sideB: { label: "Drawing ✏️", points: [
      "You make your own pictures.",
      "You do not need words.",
      "Drawing is relaxing.",
      "You can give your picture to a friend.",
    ]},
  },
  {
    topic: "Jeans or shorts?",
    sideA: { label: "Jeans 👖", points: [
      "Jeans are good all year.",
      "They are strong.",
      "They go with everything.",
      "They keep your legs warm.",
    ]},
    sideB: { label: "Shorts 🩳", points: [
      "Shorts are cool in summer.",
      "They are light.",
      "They are good for sport.",
      "They dry fast.",
    ]},
  },
  {
    topic: "Hot drink or cold drink?",
    sideA: { label: "Hot drink ☕", points: [
      "A hot drink warms you.",
      "It is good in the morning.",
      "It helps you relax.",
      "It is nice in winter.",
    ]},
    sideB: { label: "Cold drink 🧊", points: [
      "A cold drink is fresh.",
      "It is perfect in summer.",
      "You can drink it fast.",
      "It gives you energy.",
    ]},
  },
  {
    topic: "Watching cartoons or films?",
    sideA: { label: "Cartoons 🐭", points: [
      "Cartoons are funny.",
      "They are short.",
      "The colours are beautiful.",
      "Children and adults both like them.",
    ]},
    sideB: { label: "Films 🎬", points: [
      "Films tell a big story.",
      "There are many types.",
      "You can watch with family.",
      "Some films teach you things.",
    ]},
  },
  {
    topic: "Walking or running?",
    sideA: { label: "Walking 🚶", points: [
      "You can walk and talk.",
      "It is easy for everyone.",
      "You see more around you.",
      "You do not get tired.",
    ]},
    sideB: { label: "Running 🏃", points: [
      "Running is good for your heart.",
      "It is fast.",
      "You feel strong after.",
      "You need only ten minutes.",
    ]},
  },
  {
    topic: "Flowers or trees?",
    sideA: { label: "Flowers 🌷", points: [
      "Flowers have beautiful colours.",
      "They smell nice.",
      "You can give them as a gift.",
      "They make a room happy.",
    ]},
    sideB: { label: "Trees 🌳", points: [
      "Trees give us clean air.",
      "They give shade in summer.",
      "Birds live in trees.",
      "Trees live for many years.",
    ]},
  },
  {
    topic: "Breakfast or dinner?",
    sideA: { label: "Breakfast 🍳", points: [
      "Breakfast gives you energy.",
      "It starts your day well.",
      "It is quick and simple.",
      "You are hungry in the morning.",
    ]},
    sideB: { label: "Dinner 🍽️", points: [
      "The family eats together.",
      "You have time to cook.",
      "The food is warm and big.",
      "You can relax after.",
    ]},
  },
  {
    topic: "Bag or backpack?",
    sideA: { label: "Bag 👜", points: [
      "A bag looks nice.",
      "You open it easily.",
      "It is light.",
      "It is good for the city.",
    ]},
    sideB: { label: "Backpack 🎒", points: [
      "Both your hands are free.",
      "It carries heavy books.",
      "It is better for your back.",
      "It is good for school.",
    ]},
  },
  {
    topic: "Many friends or one best friend?",
    sideA: { label: "Many friends 👥", points: [
      "There is always someone free.",
      "You learn from many people.",
      "Parties are more fun.",
      "You are never alone.",
    ]},
    sideB: { label: "One best friend 🤝", points: [
      "You can tell them everything.",
      "They know you very well.",
      "They always help you.",
      "It is a strong friendship.",
    ]},
  },
  {
    topic: "Winter clothes or summer clothes?",
    sideA: { label: "Winter clothes 🧥", points: [
      "They keep you warm.",
      "Coats look nice.",
      "You can wear many colours together.",
      "You feel safe in the cold.",
    ]},
    sideB: { label: "Summer clothes 👕", points: [
      "They are light and easy.",
      "You dress in one minute.",
      "They are cheap.",
      "You feel free.",
    ]},
  },
  {
    topic: "Talking or listening?",
    sideA: { label: "Talking 💬", points: [
      "You share your ideas.",
      "People understand you.",
      "It is good practice for English.",
      "You make friends faster.",
    ]},
    sideB: { label: "Listening 👂", points: [
      "You learn new things.",
      "People like a good listener.",
      "You understand better.",
      "You make fewer mistakes.",
    ]},
  },
  {
    topic: "Photos or drawings?",
    sideA: { label: "Photos 📷", points: [
      "A photo is fast.",
      "It shows the real moment.",
      "You can send it to friends.",
      "Everyone can take photos.",
    ]},
    sideB: { label: "Drawings 🎨", points: [
      "A drawing comes from you.",
      "It is special and different.",
      "You can draw anything you imagine.",
      "It is a nice gift.",
    ]},
  },
  {
    topic: "Own room or sharing a room?",
    sideA: { label: "Own room 🛏️", points: [
      "It is quiet for study.",
      "You keep your own things.",
      "You sleep better.",
      "You can be alone.",
    ]},
    sideB: { label: "Sharing 👬", points: [
      "You are never lonely.",
      "You can talk before sleep.",
      "You learn to share.",
      "It is more fun.",
    ]},
  },
  {
    topic: "Fruit or vegetables?",
    sideA: { label: "Fruit 🍓", points: [
      "Fruit is sweet.",
      "You can eat it with no cooking.",
      "It is a good snack.",
      "Fruit has vitamins.",
    ]},
    sideB: { label: "Vegetables 🥕", points: [
      "Vegetables are very healthy.",
      "They go with every meal.",
      "They are cheap.",
      "There are many colours and types.",
    ]},
  },
  {
    topic: "Board games or phone games?",
    sideA: { label: "Board games 🎲", points: [
      "You play with real people.",
      "You talk and laugh together.",
      "Your eyes can rest.",
      "You need no battery.",
    ]},
    sideB: { label: "Phone games 📱", points: [
      "You can play alone.",
      "The phone is always with you.",
      "There are new games every week.",
      "You can play for five minutes.",
    ]},
  },
  {
    topic: "Sitting by the window or by the door?",
    sideA: { label: "Window 🪟", points: [
      "You can see outside.",
      "There is more light.",
      "You get fresh air.",
      "The view is nice.",
    ]},
    sideB: { label: "Door 🚪", points: [
      "You leave quickly.",
      "You are the first outside.",
      "You can move easily.",
      "It is close to everything.",
    ]},
  },
  {
    topic: "Long hair or short hair?",
    sideA: { label: "Long hair 💇‍♀️", points: [
      "You can make many styles.",
      "It keeps your neck warm.",
      "It looks beautiful.",
      "You cut it less often.",
    ]},
    sideB: { label: "Short hair 💇‍♂️", points: [
      "It is easy to wash.",
      "It dries fast.",
      "It is cool in summer.",
      "It looks clean and tidy.",
    ]},
  },
  {
    topic: "Cooking or washing the dishes?",
    sideA: { label: "Cooking 👨‍🍳", points: [
      "You choose the food.",
      "Cooking is creative.",
      "The kitchen smells good.",
      "People say thank you.",
    ]},
    sideB: { label: "Washing dishes 🧽", points: [
      "It is finished quickly.",
      "You do not need any skill.",
      "You can listen to music.",
      "The kitchen looks clean after.",
    ]},
  },
  {
    topic: "Gift or money as a present?",
    sideA: { label: "A gift 🎁", points: [
      "A gift shows you thought about them.",
      "Opening a box is exciting.",
      "They remember the gift.",
      "It feels warmer.",
    ]},
    sideB: { label: "Money 💵", points: [
      "They buy what they really want.",
      "Nothing goes to waste.",
      "They can save it.",
      "It is useful for everyone.",
    ]},
  },
  {
    topic: "Tea with sugar or without sugar?",
    sideA: { label: "With sugar 🍬", points: [
      "It tastes sweeter.",
      "Sugar gives you energy.",
      "Children like it more.",
      "It is nice with bitter tea.",
    ]},
    sideB: { label: "Without sugar 🍵", points: [
      "You taste the real tea.",
      "It is better for your teeth.",
      "It is healthier.",
      "You drink it faster.",
    ]},
  },
  {
    topic: "Big breakfast or small breakfast?",
    sideA: { label: "Big 🥞", points: [
      "You are not hungry until lunch.",
      "You have energy for school.",
      "The morning feels good.",
      "You can eat with family.",
    ]},
    sideB: { label: "Small 🍏", points: [
      "You are ready in five minutes.",
      "You feel light.",
      "You can sleep longer.",
      "It is cheaper.",
    ]},
  },
  {
    topic: "Walking to school or going by car?",
    sideA: { label: "Walking 🚶", points: [
      "You get fresh air.",
      "You wake up on the way.",
      "It is free.",
      "You can walk with friends.",
    ]},
    sideB: { label: "By car 🚗", points: [
      "It is fast.",
      "You stay dry in the rain.",
      "You can carry heavy bags.",
      "You are never late.",
    ]},
  },
  {
    topic: "Old toys or new toys?",
    sideA: { label: "Old toys 🧸", points: [
      "You love them already.",
      "They have good memories.",
      "They cost nothing.",
      "You know how they work.",
    ]},
    sideB: { label: "New toys 🎁", points: [
      "They are exciting.",
      "You learn something new.",
      "They are not broken.",
      "Friends want to play too.",
    ]},
  },
  {
    topic: "Watching sport or playing sport?",
    sideA: { label: "Watching 📺", points: [
      "You can relax.",
      "You watch the best players.",
      "It is fun with friends.",
      "You never get tired.",
    ]},
    sideB: { label: "Playing ⚽", points: [
      "It is good for your body.",
      "You make new friends.",
      "You feel happy after.",
      "You learn new skills.",
    ]},
  },
  {
    topic: "A house or a flat?",
    sideA: { label: "House 🏡", points: [
      "You have a garden.",
      "There is more space.",
      "You can make noise.",
      "You have your own door.",
    ]},
    sideB: { label: "Flat 🏢", points: [
      "It is easy to clean.",
      "Neighbours are close.",
      "It is warmer in winter.",
      "It is usually cheaper.",
    ]},
  },
  {
    topic: "Morning shower or evening shower?",
    sideA: { label: "Morning 🌅", points: [
      "It wakes you up.",
      "Your hair looks fresh all day.",
      "You feel clean at school.",
      "It starts the day well.",
    ]},
    sideB: { label: "Evening 🌙", points: [
      "You sleep in a clean bed.",
      "It helps you relax.",
      "You have more time.",
      "You can sleep longer in the morning.",
    ]},
  },
  {
    topic: "Studying alone or with a friend?",
    sideA: { label: "Alone 📚", points: [
      "It is quiet.",
      "You go at your own speed.",
      "Nobody talks to you.",
      "You finish faster.",
    ]},
    sideB: { label: "With a friend 👭", points: [
      "You can ask questions.",
      "It is less boring.",
      "You explain and remember better.",
      "You help each other.",
    ]},
  },
  {
    topic: "Pizza or pasta?",
    sideA: { label: "Pizza 🍕", points: [
      "You eat it with your hands.",
      "It is good for sharing.",
      "You choose your toppings.",
      "It is nice cold too.",
    ]},
    sideB: { label: "Pasta 🍝", points: [
      "It is quick to cook at home.",
      "It is cheap.",
      "There are many sauces.",
      "It keeps you full.",
    ]},
  },
  {
    topic: "Blue or green?",
    sideA: { label: "Blue 💙", points: [
      "Blue is the colour of the sky.",
      "It is calm.",
      "Blue clothes go with everything.",
      "The sea is blue.",
    ]},
    sideB: { label: "Green 💚", points: [
      "Green is the colour of nature.",
      "It is fresh.",
      "Green is good for the eyes.",
      "Trees and grass are green.",
    ]},
  },
  {
    topic: "Mountains or forest?",
    sideA: { label: "Mountains ⛰️", points: [
      "The view from the top is amazing.",
      "The air is very clean.",
      "It is quiet.",
      "Climbing is good exercise.",
    ]},
    sideB: { label: "Forest 🌲", points: [
      "There is shade from the sun.",
      "You can hear the birds.",
      "The walk is easy.",
      "It smells wonderful.",
    ]},
  },
  {
    topic: "Swimming or cycling?",
    sideA: { label: "Swimming 🏊", points: [
      "It is good for the whole body.",
      "You feel cool in summer.",
      "It is easy on your legs.",
      "Water is relaxing.",
    ]},
    sideB: { label: "Cycling 🚴", points: [
      "You can go far.",
      "You see new places.",
      "You do not need a pool.",
      "It is also transport.",
    ]},
  },
  {
    topic: "Water or lemonade?",
    sideA: { label: "Water 💧", points: [
      "Water is the healthiest drink.",
      "It is free.",
      "You can drink a lot.",
      "It has no sugar.",
    ]},
    sideB: { label: "Lemonade 🍋", points: [
      "It tastes fresh and sweet.",
      "It is perfect on a hot day.",
      "It is nice at a party.",
      "You can make it at home.",
    ]},
  },
  {
    topic: "Homework now or later?",
    sideA: { label: "Now ⏰", points: [
      "You finish and feel free.",
      "You still remember the lesson.",
      "You can rest after.",
      "You never forget it.",
    ]},
    sideB: { label: "Later 🌙", points: [
      "You rest first.",
      "Your brain is fresh again.",
      "You can play with friends now.",
      "You work better in the evening.",
    ]},
  },
  {
    topic: "Window seat or aisle seat?",
    sideA: { label: "Window 🪟", points: [
      "You see everything outside.",
      "You can sleep on the wall.",
      "Nobody walks past you.",
      "The photos are better.",
    ]},
    sideB: { label: "Aisle 🚶", points: [
      "You can stand up any time.",
      "You leave first.",
      "There is more space for your legs.",
      "It is easier to reach your bag.",
    ]},
  },
  {
    topic: "A small shop or a big shop?",
    sideA: { label: "Small shop 🏪", points: [
      "It is near your home.",
      "You are finished in two minutes.",
      "The seller knows you.",
      "There is no long queue.",
    ]},
    sideB: { label: "Big shop 🏬", points: [
      "You find everything in one place.",
      "The prices are lower.",
      "There is more choice.",
      "You can look around.",
    ]},
  },
  {
    topic: "New clothes or old comfortable clothes?",
    sideA: { label: "New clothes 👗", points: [
      "You look good.",
      "You feel confident.",
      "They are clean and fresh.",
      "They are nice for photos.",
    ]},
    sideB: { label: "Old clothes 👕", points: [
      "They are very comfortable.",
      "You are not afraid to get dirty.",
      "They cost nothing.",
      "They feel like home.",
    ]},
  },
  {
    topic: "Learning with videos or with books?",
    sideA: { label: "Videos 📹", points: [
      "You hear the real sound.",
      "You can watch again.",
      "It is faster to understand.",
      "It is more interesting.",
    ]},
    sideB: { label: "Books 📕", points: [
      "You go at your own speed.",
      "You can write notes.",
      "You need no internet.",
      "Your eyes rest more.",
    ]},
  },
  {
    topic: "Cats or rabbits as a pet?",
    sideA: { label: "Cat 🐱", points: [
      "A cat plays with you.",
      "Cats are clean.",
      "They sleep near you.",
      "They live many years.",
    ]},
    sideB: { label: "Rabbit 🐰", points: [
      "Rabbits are very quiet.",
      "They are soft to hold.",
      "They need a small space.",
      "They eat simple food.",
    ]},
  },
  {
    topic: "Volleyball or basketball?",
    sideA: { label: "Volleyball 🏐", points: [
      "You can play on the beach.",
      "Nobody runs into you.",
      "The ball is light.",
      "It is easy to learn.",
    ]},
    sideB: { label: "Basketball 🏀", points: [
      "There is more running.",
      "You can play with two people.",
      "You can play in any weather inside.",
      "Scoring is exciting.",
    ]},
  },
  {
    topic: "Speaking English or writing English?",
    sideA: { label: "Speaking 🗣️", points: [
      "You use it every day.",
      "You learn faster.",
      "You make friends.",
      "People understand you now.",
    ]},
    sideB: { label: "Writing ✍️", points: [
      "You have time to think.",
      "You can check your mistakes.",
      "It helps you remember words.",
      "You need it for exams.",
    ]},
  },
  {
    topic: "Sitting or standing on the bus?",
    sideA: { label: "Sitting 💺", points: [
      "You can rest.",
      "You can read or listen to music.",
      "It is safer.",
      "Your bag is on your legs.",
    ]},
    sideB: { label: "Standing 🧍", points: [
      "You get off faster.",
      "You can see out of the window.",
      "You give your seat to someone.",
      "It is better than sitting all day.",
    ]},
  },
  {
    topic: "Nuts or chips?",
    sideA: { label: "Nuts 🥜", points: [
      "Nuts are healthy.",
      "A small bag is enough.",
      "They give you energy.",
      "They are good for your brain.",
    ]},
    sideB: { label: "Chips 🍟", points: [
      "Chips taste very good.",
      "They are cheap.",
      "They are nice with friends.",
      "They are perfect with a film.",
    ]},
  },
  {
    topic: "Honey or jam?",
    sideA: { label: "Honey 🍯", points: [
      "Honey is natural.",
      "It is good when you are ill.",
      "It is sweet and healthy.",
      "It keeps for a long time.",
    ]},
    sideB: { label: "Jam 🍓", points: [
      "There are many fruit flavours.",
      "It is cheaper.",
      "It is easy to put on bread.",
      "You can make it at home.",
    ]},
  },
  {
    topic: "A picnic or a restaurant?",
    sideA: { label: "Picnic 🧺", points: [
      "You are outside in the fresh air.",
      "It costs very little.",
      "You choose the food.",
      "Children can run and play.",
    ]},
    sideB: { label: "Restaurant 🍽️", points: [
      "You do not cook or clean.",
      "The food is warm.",
      "You sit comfortably.",
      "The weather does not matter.",
    ]},
  },
  {
    topic: "A watch or a phone for the time?",
    sideA: { label: "Watch ⌚", points: [
      "You look at it in one second.",
      "It never has an empty battery.",
      "It looks nice.",
      "It is polite in a meeting.",
    ]},
    sideB: { label: "Phone 📱", points: [
      "You already carry it.",
      "The time is always correct.",
      "It has an alarm too.",
      "You do not need two things.",
    ]},
  },
  {
    topic: "A paper map or a phone map?",
    sideA: { label: "Paper map 🗺️", points: [
      "It works with no internet.",
      "The battery never dies.",
      "You see the whole area.",
      "It is good for learning a city.",
    ]},
    sideB: { label: "Phone map 📲", points: [
      "It shows where you are.",
      "It tells you the way.",
      "It knows the traffic.",
      "It is always in your pocket.",
    ]},
  },
  {
    topic: "A short holiday or a long holiday?",
    sideA: { label: "Short 🎒", points: [
      "It is cheaper.",
      "You pack very little.",
      "You can go more often.",
      "You do not miss much school.",
    ]},
    sideB: { label: "Long 🏖️", points: [
      "You really relax.",
      "You see much more.",
      "You forget about work.",
      "The travel time is worth it.",
    ]},
  },
  {
    topic: "Waking up early or sleeping more?",
    sideA: { label: "Waking early 🌅", points: [
      "The morning is quiet.",
      "You have a long day.",
      "You are never late.",
      "You finish your work early.",
    ]},
    sideB: { label: "Sleeping more 😴", points: [
      "Your body rests well.",
      "You feel happier.",
      "You study better after sleep.",
      "You are not tired at school.",
    ]},
  },
  {
    topic: "Loud music or quiet music?",
    sideA: { label: "Loud 🔊", points: [
      "You feel the energy.",
      "It is great for dancing.",
      "It is fun at a party.",
      "You forget your problems.",
    ]},
    sideB: { label: "Quiet 🔉", points: [
      "You can still talk.",
      "It is better for your ears.",
      "You can study with it.",
      "It helps you relax.",
    ]},
  },
  {
    topic: "Snow games or beach games?",
    sideA: { label: "Snow games ⛄", points: [
      "You can build a snowman.",
      "Snowball fights are fun.",
      "It is free.",
      "The snow is beautiful.",
    ]},
    sideB: { label: "Beach games 🏐", points: [
      "The water is close.",
      "You are warm.",
      "You can play many games on sand.",
      "The sun feels good.",
    ]},
  },
  {
    topic: "A warm bath or a cold shower?",
    sideA: { label: "Warm bath 🛁", points: [
      "It is very relaxing.",
      "It is good after a cold day.",
      "You can stay for a long time.",
      "It helps you sleep.",
    ]},
    sideB: { label: "Cold shower 🚿", points: [
      "It wakes you up fast.",
      "It takes two minutes.",
      "It is good in summer.",
      "It uses less water.",
    ]},
  },
  {
    topic: "Working with your hands or with a computer?",
    sideA: { label: "With hands 🔨", points: [
      "You see what you made.",
      "You move your body.",
      "Your eyes do not get tired.",
      "It is a useful skill.",
    ]},
    sideB: { label: "With a computer 💻", points: [
      "You can work anywhere.",
      "It is clean and warm.",
      "You can fix mistakes easily.",
      "There are many jobs.",
    ]},
  },
  {
    topic: "One big meal or many small meals?",
    sideA: { label: "One big meal 🍛", points: [
      "You cook only once.",
      "You feel really full.",
      "You save time.",
      "You eat with the family.",
    ]},
    sideB: { label: "Many small meals 🥪", points: [
      "You never feel too hungry.",
      "You have energy all day.",
      "It is easier for your stomach.",
      "You do not feel heavy.",
    ]},
  },
  {
    topic: "A quiet street or a busy street?",
    sideA: { label: "Quiet street 🌳", points: [
      "You can sleep well.",
      "It is safer for children.",
      "The air is cleaner.",
      "There is no noise.",
    ]},
    sideB: { label: "Busy street 🏙️", points: [
      "Shops are very close.",
      "There is always transport.",
      "You feel safe with people around.",
      "There is something to see.",
    ]},
  },
];

const normalTopics = [
  {
    topic: "Cats or dogs — which pet is better?",
    sideA: { label: "Cats 🐱", points: [
      "Cats are independent and don't need daily walks.",
      "Cats are cheaper to keep — less food, no dog walker.",
      "Cats clean themselves.",
      "Cats are quiet and fit well in small apartments.",
      "Cats can be left alone for a full day without stress.",
    ]},
    sideB: { label: "Dogs 🐶", points: [
      "Dogs are loyal and always happy to see you.",
      "Dogs protect the house and the family.",
      "Dogs get you outside and moving every day.",
      "Dogs can be trained to do useful things.",
      "Dogs are better company for children.",
    ]},
  },
  {
    topic: "Winter or summer — which season is better?",
    sideA: { label: "Winter ❄️", points: [
      "Snow makes everything look beautiful.",
      "You can drink hot tea and stay cozy at home.",
      "Winter holidays like New Year feel special.",
      "No mosquitoes or extreme heat.",
      "Skiing and snowball fights are fun.",
    ]},
    sideB: { label: "Summer ☀️", points: [
      "Long, sunny days give you more free time outside.",
      "You can swim in the sea or a pool.",
      "Summer holidays are longer.",
      "Fresh fruit and barbecues taste better.",
      "No heavy coats or icy roads.",
    ]},
  },
  {
    topic: "Tea or coffee — which drink is better?",
    sideA: { label: "Tea 🍵", points: [
      "Tea has less caffeine, so it's calmer.",
      "There are hundreds of flavours to try.",
      "Tea is a big part of Azerbaijani culture.",
      "It's gentler on your stomach.",
      "You can drink it any time of day.",
    ]},
    sideB: { label: "Coffee ☕", points: [
      "Coffee wakes you up fast in the morning.",
      "It helps you focus while working or studying.",
      "Coffee shops are great places to meet friends.",
      "There are so many ways to make it — espresso, latte, cold brew.",
      "The smell alone makes people happier.",
    ]},
  },
  {
    topic: "City life or village life — which is better?",
    sideA: { label: "City 🏙️", points: [
      "More jobs and higher salaries.",
      "Better hospitals, schools and universities.",
      "Restaurants, cinemas and events are close by.",
      "Public transport takes you everywhere.",
      "You meet more people and ideas.",
    ]},
    sideB: { label: "Village 🌾", points: [
      "Fresh air and quiet — no traffic noise.",
      "Fresh, homegrown food.",
      "Life is cheaper.",
      "Everyone knows each other; strong community.",
      "Less stress, slower pace of life.",
    ]},
  },
  {
    topic: "Books or movies — which tells a story better?",
    sideA: { label: "Books 📚", points: [
      "You imagine the characters yourself.",
      "Books go deeper into a character's thoughts.",
      "Reading improves your vocabulary.",
      "A book can be enjoyed at your own pace.",
      "The book is almost always better than the film.",
    ]},
    sideB: { label: "Movies 🎬", points: [
      "Movies tell a full story in two hours.",
      "Music and visuals add emotion words can't.",
      "You can watch a movie with friends together.",
      "Great acting brings characters to life.",
      "Movies are easier to enjoy after a tiring day.",
    ]},
  },
  {
    topic: "Morning person or night owl — which is better?",
    sideA: { label: "Early bird 🌅", points: [
      "Mornings are quiet, so it's easier to focus.",
      "You get things done before the day gets busy.",
      "Waking up early means an earlier, better sleep too.",
      "Sunrise is a great way to start the day.",
      "Most schools and jobs start early anyway.",
    ]},
    sideB: { label: "Night owl 🌙", points: [
      "Nights are calm — no calls, no interruptions.",
      "Creative ideas often come late at night.",
      "You can relax after everyone else is asleep.",
      "Some of the best conversations happen late at night.",
      "Not everyone's brain works the same — mornings aren't for everyone.",
    ]},
  },
  {
    topic: "Beach holiday or mountain holiday — which is better?",
    sideA: { label: "Beach 🏖️", points: [
      "Swimming in the sea is the best way to relax.",
      "Sunbathing and sea breeze reduce stress.",
      "Beach towns usually have great food nearby.",
      "Easy holiday — you just lie down and relax.",
      "Beautiful sunsets over the water.",
    ]},
    sideB: { label: "Mountains ⛰️", points: [
      "Fresh, cool air is better for your health.",
      "Hiking keeps you active on holiday.",
      "Mountain views are more dramatic and unique.",
      "Fewer crowds than a popular beach.",
      "You can enjoy both summer and winter mountain activities.",
    ]},
  },
  {
    topic: "Texting or calling — which is the better way to talk?",
    sideA: { label: "Texting 💬", points: [
      "You can reply whenever you're free.",
      "It's quieter — you can text anywhere, even in class.",
      "You can think about your words before sending.",
      "Easy to share photos, links and voice notes too.",
      "It doesn't interrupt what the other person is doing.",
    ]},
    sideB: { label: "Calling 📞", points: [
      "You hear tone of voice, so less misunderstanding.",
      "Calls are faster than typing a long message.",
      "It feels more personal and warm.",
      "You can solve a problem in one call instead of ten texts.",
      "Some things are just easier to explain out loud.",
    ]},
  },
  {
    topic: "Cooking at home or eating out — which is better?",
    sideA: { label: "Cooking at home 🍳", points: [
      "It's much cheaper than restaurants.",
      "You control exactly what goes into your food.",
      "Cooking together is a nice family activity.",
      "Home food is usually healthier.",
      "You can cook exactly what you're craving.",
    ]},
    sideB: { label: "Eating out 🍽️", points: [
      "You save time — no cooking or washing dishes.",
      "You can try foods you don't know how to cook.",
      "Restaurants are good for meeting friends.",
      "Professional chefs often cook better than we can.",
      "It feels like a treat, especially after a long week.",
    ]},
  },
  {
    topic: "Online shopping or shopping in a store — which is better?",
    sideA: { label: "Online 🛒", points: [
      "You can shop anytime, even at midnight.",
      "Prices are easier to compare between stores.",
      "No traffic, no crowds, no queues.",
      "Items get delivered straight to your door.",
      "Huge choice — way more than one store can offer.",
    ]},
    sideB: { label: "In-store 🏬", points: [
      "You can try clothes on before buying.",
      "You get the item immediately, no waiting for delivery.",
      "You can ask staff questions right away.",
      "No risk of the item looking different than the photo.",
      "Shopping in person can be a fun outing with friends.",
    ]},
  },
  {
    topic: "Football or basketball — which sport is better?",
    sideA: { label: "Football ⚽", points: [
      "It's the most popular sport in the world.",
      "You only need a ball and some space to play.",
      "Matches build incredible team spirit.",
      "Ninety minutes of constant tension and excitement.",
      "Huge stadiums and passionate fans everywhere.",
    ]},
    sideB: { label: "Basketball 🏀", points: [
      "Games have much more non-stop scoring and action.",
      "It rewards speed, skill and clever teamwork.",
      "You can play it indoors in any weather.",
      "Even one-on-one games are fun.",
      "Players show amazing individual skill and creativity.",
    ]},
  },
  {
    topic: "Pizza or burgers — which food wins?",
    sideA: { label: "Pizza 🍕", points: [
      "So many topping combinations to choose from.",
      "Great for sharing with a group.",
      "Good both hot and cold the next day.",
      "Feels a bit lighter than a heavy burger.",
      "Goes with almost any drink or side dish.",
    ]},
    sideB: { label: "Burgers 🍔", points: [
      "Juicy, filling and satisfying in one bite.",
      "Comes with fries — a perfect combo.",
      "Easy to customize — cheese, sauce, extra patty.",
      "Faster to eat when you're in a hurry.",
      "Great at a barbecue with friends.",
    ]},
  },
  {
    topic: "Sweet food or salty food — which do you prefer?",
    sideA: { label: "Sweet 🍰", points: [
      "Sweet food instantly lifts your mood.",
      "Desserts make celebrations feel special.",
      "There's a huge variety — cakes, chocolate, fruit.",
      "A little something sweet is the perfect end to a meal.",
      "Sweet snacks give a quick boost of energy.",
    ]},
    sideB: { label: "Salty 🍟", points: [
      "Salty snacks are perfect with drinks or during a movie.",
      "You don't get tired of salty food as quickly.",
      "Savoury meals feel more like real food, not just a treat.",
      "Salty food pairs well with almost every cuisine.",
      "Chips and nuts are easy, satisfying snacks.",
    ]},
  },
  {
    topic: "Working from home or working in the office — which is better?",
    sideA: { label: "From home 🏠", points: [
      "No time wasted commuting every day.",
      "You can work in a comfortable, quiet space.",
      "More flexible hours around your own life.",
      "You save money on transport and eating out.",
      "Fewer interruptions from coworkers.",
    ]},
    sideB: { label: "In the office 🏢", points: [
      "Face-to-face talks solve problems faster.",
      "It's easier to build friendships with coworkers.",
      "A clear separation between work and home life.",
      "Fewer distractions from things at home.",
      "New employees learn faster by watching others.",
    ]},
  },
  {
    topic: "Saving money or spending money now — which is smarter?",
    sideA: { label: "Saving 💰", points: [
      "Savings protect you when something unexpected happens.",
      "You can afford bigger goals later — a home, a trip.",
      "It reduces stress about the future.",
      "Small savings add up a lot over time.",
      "It gives you more freedom to make choices later.",
    ]},
    sideB: { label: "Spending now 🛍️", points: [
      "Life is happening now, not only in the future.",
      "Experiences today create memories you keep forever.",
      "You never know what tomorrow brings, so enjoy today.",
      "Spending on yourself can improve your daily happiness.",
      "Money saved for too long can lose value over time.",
    ]},
  },
  {
    topic: "Reading books or watching TV — which is a better way to relax?",
    sideA: { label: "Reading 📖", points: [
      "Reading improves focus and imagination.",
      "It's a quiet activity that helps you fall asleep after.",
      "You learn new words and ideas as you go.",
      "A good book stays with you longer than a show.",
      "You can read anywhere, even without electricity.",
    ]},
    sideB: { label: "Watching TV 📺", points: [
      "It's an easy way to relax after a tiring day.",
      "Great for watching together with family or friends.",
      "Visual storytelling can be very powerful.",
      "There's something for every mood — comedy, drama, documentaries.",
      "You don't need to concentrate hard to enjoy it.",
    ]},
  },
  {
    topic: "Living alone or living with family — which is better?",
    sideA: { label: "Living alone 🏡", points: [
      "You get full independence and privacy.",
      "You can decorate and organize things your own way.",
      "No arguments about chores or schedules.",
      "It teaches responsibility fast.",
      "You choose exactly how to spend your evenings.",
    ]},
    sideB: { label: "With family 👨‍👩‍👧", points: [
      "You're never alone when something goes wrong.",
      "Meals and chores are shared, so it's easier.",
      "It's usually cheaper to live together.",
      "Strong family bonds grow from daily time together.",
      "There's always someone to talk to.",
    ]},
  },
  {
    topic: "Phone or laptop — which do you need more?",
    sideA: { label: "Phone 📱", points: [
      "It's always with you, in your pocket.",
      "Great for quick messages, calls and photos.",
      "Apps for almost everything you need daily.",
      "Easier to use while walking or traveling.",
      "Battery lasts long enough for a full day.",
    ]},
    sideB: { label: "Laptop 💻", points: [
      "A bigger screen makes work much easier.",
      "A real keyboard is faster for typing.",
      "Better for studying, writing or coding.",
      "More powerful for serious tasks.",
      "Easier to have multiple windows open at once.",
    ]},
  },
  {
    topic: "Weekend at home or weekend outside — which is better?",
    sideA: { label: "At home 🛋️", points: [
      "It's the perfect time to fully rest.",
      "No money spent, no crowds to deal with.",
      "You can catch up on sleep, shows or hobbies.",
      "Comfortable and stress-free.",
      "Great for recharging before the new week.",
    ]},
    sideB: { label: "Outside 🌳", points: [
      "Fresh air and movement are good for your health.",
      "You make more memories doing something new.",
      "It's a great chance to see friends.",
      "Sitting at home all weekend can feel boring.",
      "New places and people keep life interesting.",
    ]},
  },
  {
    topic: "Traveling solo or traveling with friends — which is better?",
    sideA: { label: "Solo 🎒", points: [
      "You decide everything — no compromises.",
      "It builds confidence and independence.",
      "You meet more new people on the way.",
      "You can change plans anytime you want.",
      "It's easier to really relax on your own schedule.",
    ]},
    sideB: { label: "With friends 👯", points: [
      "Memories are better when you share them.",
      "It's safer to travel in a group.",
      "You can split costs like hotels and taxis.",
      "Friends help when something goes wrong.",
      "Trying new food and activities is more fun together.",
    ]},
  },
  {
    topic: "Public transport or your own car — which is better?",
    sideA: { label: "Public transport 🚌", points: [
      "It is much cheaper than owning a car.",
      "You can read or rest instead of driving.",
      "It is far better for the environment.",
      "You never look for a parking space.",
      "Fewer cars means less traffic for everyone.",
    ]},
    sideB: { label: "Own car 🚗", points: [
      "You leave exactly when you want.",
      "You can carry heavy shopping easily.",
      "It is much better with small children.",
      "You can reach places buses never go.",
      "Your own space, your own music.",
    ]},
  },
  {
    topic: "Exams or projects — which shows real learning?",
    sideA: { label: "Exams 📝", points: [
      "Everyone is tested in exactly the same way.",
      "It is harder to copy someone else's work.",
      "Exams show what you truly remember.",
      "They teach you to work under pressure.",
      "Results come quickly and clearly.",
    ]},
    sideB: { label: "Projects 📊", points: [
      "You learn much more deeply over weeks.",
      "Projects are closer to real work life.",
      "You can be creative instead of memorising.",
      "Students who panic in exams get a fair chance.",
      "You practise teamwork and planning.",
    ]},
  },
  {
    topic: "Paper books or e-books — which is better?",
    sideA: { label: "Paper 📕", points: [
      "Paper is easier on your eyes.",
      "You remember more of what you read.",
      "No battery and no notifications.",
      "A bookshelf is part of your home.",
      "You can lend a paper book to a friend.",
    ]},
    sideB: { label: "E-books 📱", points: [
      "You carry a hundred books in one device.",
      "You can look up a word instantly.",
      "You can read in the dark.",
      "E-books are usually cheaper.",
      "You can change the text size.",
    ]},
  },
  {
    topic: "Films with subtitles or dubbed films — which is better?",
    sideA: { label: "Subtitles 💬", points: [
      "You hear the real voices of the actors.",
      "It is excellent practice for a foreign language.",
      "Nothing is lost in translation.",
      "You learn new words while you enjoy the film.",
      "The emotion in the original voice is kept.",
    ]},
    sideB: { label: "Dubbed 🔊", points: [
      "You watch the picture instead of reading.",
      "It is easier for children and older people.",
      "You do not miss fast scenes while reading.",
      "You can relax completely.",
      "Good dubbing sounds natural in your own language.",
    ]},
  },
  {
    topic: "Learning a language with an app or with a teacher?",
    sideA: { label: "With an app 📲", points: [
      "You can study any time, even for five minutes.",
      "It costs much less than lessons.",
      "You never feel shy about mistakes.",
      "The app tracks your progress automatically.",
      "You can repeat a lesson as often as you like.",
    ]},
    sideB: { label: "With a teacher 👩‍🏫", points: [
      "A teacher corrects the mistakes you cannot see.",
      "You practise real conversation, not just tapping.",
      "Lessons are planned for your exact level.",
      "A teacher keeps you motivated week after week.",
      "You can ask questions and get a real answer.",
    ]},
  },
  {
    topic: "Handwriting or typing — which should students use?",
    sideA: { label: "Handwriting ✍️", points: [
      "Writing by hand helps you remember better.",
      "It slows you down, so you think more.",
      "No screen, so fewer distractions.",
      "You can write anywhere with a cheap pen.",
      "Handwriting is a skill worth keeping.",
    ]},
    sideB: { label: "Typing ⌨️", points: [
      "Typing is much faster.",
      "Anyone can read it — no messy writing.",
      "You can edit and reorganise easily.",
      "Your work is saved and never lost.",
      "Almost every job needs typing today.",
    ]},
  },
  {
    topic: "Exercising at the gym or outdoors — which is better?",
    sideA: { label: "Gym 🏋️", points: [
      "The weather never stops you.",
      "There is equipment for every muscle.",
      "Trainers can show you the correct technique.",
      "It is easier to build a regular habit.",
      "You can train at any hour.",
    ]},
    sideB: { label: "Outdoors 🌤️", points: [
      "It is completely free.",
      "Fresh air and sunlight improve your mood.",
      "The scenery changes, so it stays interesting.",
      "You do not travel to a building first.",
      "Natural movement is good for the whole body.",
    ]},
  },
  {
    topic: "A vegetarian diet or eating meat — which is better?",
    sideA: { label: "Vegetarian 🥦", points: [
      "It is much better for the environment.",
      "Plenty of vegetables keeps you healthy.",
      "Vegetables and beans are cheaper than meat.",
      "No animals are harmed.",
      "It encourages you to cook more creatively.",
    ]},
    sideB: { label: "Eating meat 🍖", points: [
      "Meat is a strong source of protein and iron.",
      "It keeps you full for a long time.",
      "Meat dishes are central to our traditions.",
      "It is simple to cook a balanced meal.",
      "A little meat with vegetables is already balanced.",
    ]},
  },
  {
    topic: "A big wedding or a small wedding — which is better?",
    sideA: { label: "Big wedding 🎉", points: [
      "The whole family celebrates together.",
      "It happens once, so make it memorable.",
      "Relatives would feel hurt if not invited.",
      "The photos and the atmosphere are amazing.",
      "It is an important tradition.",
    ]},
    sideB: { label: "Small wedding 💐", points: [
      "You actually talk to every guest.",
      "It costs far less, so you can save for a home.",
      "There is much less stress in planning.",
      "The day feels personal, not like a show.",
      "You remember the people, not the crowd.",
    ]},
  },
  {
    topic: "Social media — more good or more harm?",
    sideA: { label: "More good 👍", points: [
      "You stay in touch with distant family.",
      "Small businesses find customers for free.",
      "You learn skills and news quickly.",
      "It gives ordinary people a voice.",
      "You can find people with the same interests.",
    ]},
    sideB: { label: "More harm 👎", points: [
      "It takes hours from your real life.",
      "People compare themselves and feel worse.",
      "False information spreads very fast.",
      "It hurts concentration and sleep.",
      "Online talk is often unkind.",
    ]},
  },
  {
    topic: "Video games — good or bad for children?",
    sideA: { label: "Good 🎮", points: [
      "Games improve reaction and problem solving.",
      "Children play together with friends online.",
      "Many games are in English, so they learn words.",
      "They teach patience and trying again after failing.",
      "It is a modern hobby, like sport or music.",
    ]},
    sideB: { label: "Bad 🚫", points: [
      "Too many hours sitting is unhealthy.",
      "Games can replace homework and sleep.",
      "Some games are far too violent.",
      "Children play alone instead of going outside.",
      "It is easy to become addicted.",
    ]},
  },
  {
    topic: "Living in your own country or moving abroad?",
    sideA: { label: "Own country 🏠", points: [
      "Your family and friends are here.",
      "You know the language and the customs.",
      "You can help your own country grow.",
      "No visa problems or paperwork.",
      "You never feel like a stranger.",
    ]},
    sideB: { label: "Abroad ✈️", points: [
      "You may find better work and salary.",
      "You learn a new language quickly.",
      "You see how other people live and think.",
      "It makes you independent and confident.",
      "You can always come back later.",
    ]},
  },
  {
    topic: "Travelling by plane or by train — which is better?",
    sideA: { label: "Plane ✈️", points: [
      "It is by far the fastest way.",
      "You can reach another continent in hours.",
      "Cheap tickets appear if you book early.",
      "More time at your destination.",
      "Long journeys become easy.",
    ]},
    sideB: { label: "Train 🚆", points: [
      "You see the countryside on the way.",
      "Stations are in the city centre, not far outside.",
      "You can walk around and sleep comfortably.",
      "There is no long security queue.",
      "Trains pollute much less.",
    ]},
  },
  {
    topic: "Camping or staying in a hotel — which is better?",
    sideA: { label: "Camping ⛺", points: [
      "You are close to nature and the stars.",
      "It costs almost nothing.",
      "You learn practical skills.",
      "It is a real adventure to remember.",
      "You can choose beautiful, quiet places.",
    ]},
    sideB: { label: "Hotel 🏨", points: [
      "A hot shower and a real bed.",
      "The weather does not ruin your trip.",
      "Breakfast is ready for you.",
      "It is safer and more comfortable.",
      "You carry much less luggage.",
    ]},
  },
  {
    topic: "Museums or amusement parks — which is a better day out?",
    sideA: { label: "Museum 🏛️", points: [
      "You learn something you keep forever.",
      "Tickets are usually much cheaper.",
      "It is calm and comfortable inside.",
      "You see real history and art.",
      "Good in any weather.",
    ]},
    sideB: { label: "Amusement park 🎢", points: [
      "It is pure excitement and fun.",
      "Children enjoy it much more.",
      "You are active all day, not just walking slowly.",
      "The whole family can enjoy it together.",
      "You come home with great stories.",
    ]},
  },
  {
    topic: "Team sports or individual sports — which is better?",
    sideA: { label: "Team sports ⚽", points: [
      "You learn to cooperate with others.",
      "Training with friends is more motivating.",
      "Winning together feels better.",
      "You build lasting friendships.",
      "Someone helps you when you have a bad day.",
    ]},
    sideB: { label: "Individual sports 🏊", points: [
      "You train whenever it suits you.",
      "Your progress depends only on you.",
      "You do not wait for a full team.",
      "It builds strong self-discipline.",
      "The success is completely your own.",
    ]},
  },
  {
    topic: "More money or more free time — which would you choose?",
    sideA: { label: "More money 💵", points: [
      "Money removes daily stress about bills.",
      "You can help your family.",
      "It buys better health care and education.",
      "You can save for the future.",
      "Money gives you choices later.",
    ]},
    sideB: { label: "More free time ⏳", points: [
      "Time is the one thing you cannot buy back.",
      "You spend it with people you love.",
      "You have space for hobbies and rest.",
      "Less stress means better health.",
      "A rich person with no free time is not free.",
    ]},
  },
  {
    topic: "Being famous or keeping your privacy?",
    sideA: { label: "Famous 🌟", points: [
      "You can influence people in a good way.",
      "Many opportunities come to you.",
      "You earn more from what you love doing.",
      "Your work reaches a huge audience.",
      "People listen when you support a cause.",
    ]},
    sideB: { label: "Private 🤫", points: [
      "You live a normal, peaceful life.",
      "Nobody judges your every mistake.",
      "Your family is not disturbed.",
      "Your friends like you, not your fame.",
      "You can change your mind without a scandal.",
    ]},
  },
  {
    topic: "Paying with cash or paying by card?",
    sideA: { label: "Cash 💵", points: [
      "You see exactly how much you spend.",
      "It works when the system is down.",
      "It is easier to keep to a budget.",
      "No bank fees.",
      "Small shops always accept it.",
    ]},
    sideB: { label: "Card 💳", points: [
      "You do not carry a lot of money.",
      "Every payment is recorded automatically.",
      "If it is stolen, you can block it.",
      "You can pay online.",
      "It is faster at the checkout.",
    ]},
  },
  {
    topic: "Old historic buildings or modern buildings?",
    sideA: { label: "Old buildings 🏛️", points: [
      "They carry the history of the city.",
      "The craftsmanship is extraordinary.",
      "They make a city unique for visitors.",
      "Restoring is greener than building new.",
      "They connect us to earlier generations.",
    ]},
    sideB: { label: "Modern buildings 🏢", points: [
      "They are warmer and cost less to heat.",
      "They fit many more people.",
      "Lifts and ramps make them accessible.",
      "They are safer in an earthquake.",
      "A city must grow with its people.",
    ]},
  },
  {
    topic: "Small classes or big classes — which is better for learning?",
    sideA: { label: "Small classes 👩‍🏫", points: [
      "The teacher notices every student.",
      "You get more chances to speak.",
      "Shy students are not forgotten.",
      "Lessons can follow the students' pace.",
      "Problems are found and fixed early.",
    ]},
    sideB: { label: "Big classes 👥", points: [
      "You hear many different opinions.",
      "It is cheaper, so more children can study.",
      "Group work and debates are livelier.",
      "You learn to speak in front of people.",
      "You make far more friends.",
    ]},
  },
  {
    topic: "Learning history or learning science — which matters more?",
    sideA: { label: "History 📜", points: [
      "It explains why the world is as it is.",
      "We avoid repeating old mistakes.",
      "It teaches you to judge sources critically.",
      "It builds understanding between nations.",
      "It gives you your own identity.",
    ]},
    sideB: { label: "Science 🔬", points: [
      "Science solves real problems like disease.",
      "It creates the technology we use daily.",
      "It teaches logical thinking.",
      "It leads to more job opportunities.",
      "It shapes the future, not just the past.",
    ]},
  },
  {
    topic: "Doing one thing very well or many things a little?",
    sideA: { label: "One thing 🎯", points: [
      "Real skill only comes from deep practice.",
      "Experts are paid more.",
      "You become the person people ask for help.",
      "Your work stands out from the crowd.",
      "Focus saves you time and energy.",
    ]},
    sideB: { label: "Many things 🎨", points: [
      "You adapt when the world changes.",
      "Different skills give you new ideas.",
      "Life is more interesting and varied.",
      "You are useful in many situations.",
      "If one path closes, another is open.",
    ]},
  },
  {
    topic: "Planning everything or being spontaneous?",
    sideA: { label: "Planning 📅", points: [
      "You waste far less time.",
      "You are ready when problems appear.",
      "Planning lowers stress and worry.",
      "You reach big goals step by step.",
      "Other people can rely on you.",
    ]},
    sideB: { label: "Spontaneous 🎲", points: [
      "The best memories are unplanned.",
      "You take chances that appear suddenly.",
      "Life feels free instead of controlled.",
      "You are not upset when plans change.",
      "You discover things you never looked for.",
    ]},
  },
  {
    topic: "A video call or meeting in person — which is better?",
    sideA: { label: "Video call 💻", points: [
      "You talk to anyone in the world instantly.",
      "You save the cost and time of travel.",
      "You can meet more often.",
      "It is easy to share your screen and files.",
      "You can join from home when you are ill.",
    ]},
    sideB: { label: "In person 🤝", points: [
      "You read body language properly.",
      "There is no bad connection or frozen screen.",
      "It builds much stronger relationships.",
      "People concentrate instead of checking phones.",
      "Conversation flows naturally.",
    ]},
  },
  {
    topic: "Homemade gifts or bought gifts — which is better?",
    sideA: { label: "Homemade 🎨", points: [
      "It shows you spent real time on them.",
      "It is completely unique.",
      "It costs little but means a lot.",
      "People keep it for years.",
      "You put your own personality into it.",
    ]},
    sideB: { label: "Bought 🛍️", points: [
      "You can choose exactly what they need.",
      "The quality is reliable.",
      "It saves time when you are busy.",
      "It does not look amateur.",
      "You can still choose it very thoughtfully.",
    ]},
  },
  {
    topic: "Living near the sea or near the mountains?",
    sideA: { label: "Near the sea 🌊", points: [
      "The climate is milder all year.",
      "Swimming is part of daily life.",
      "Sea air is good for your health.",
      "There is more work in trade and tourism.",
      "Sunsets over water are unbeatable.",
    ]},
    sideB: { label: "Near the mountains 🏔️", points: [
      "The air is cleaner and cooler.",
      "There are fewer tourists and less noise.",
      "Life is quieter and cheaper.",
      "You can hike and ski.",
      "The views change with every season.",
    ]},
  },
  {
    topic: "A job working with people or working alone?",
    sideA: { label: "With people 👥", points: [
      "The day is never boring.",
      "You build a network of contacts.",
      "You learn from your colleagues.",
      "Teamwork solves problems faster.",
      "You feel part of something.",
    ]},
    sideB: { label: "Alone 🧑‍💻", points: [
      "You concentrate much more deeply.",
      "No office politics or interruptions.",
      "You organise your day yourself.",
      "Quiet people do their best work this way.",
      "Your results speak for themselves.",
    ]},
  },
  {
    topic: "Following the rules or thinking creatively?",
    sideA: { label: "Rules 📏", points: [
      "Rules keep everyone safe.",
      "Everybody is treated the same way.",
      "You know exactly what to expect.",
      "Teams work smoothly together.",
      "Most rules exist because of past mistakes.",
    ]},
    sideB: { label: "Creativity 💡", points: [
      "Progress comes from questioning old rules.",
      "Some rules are simply out of date.",
      "New problems need new answers.",
      "Creative people find faster ways.",
      "Following blindly stops improvement.",
    ]},
  },
  {
    topic: "Reading the news online or watching it on TV?",
    sideA: { label: "Online 📰", points: [
      "You choose what to read and skip.",
      "News arrives within minutes.",
      "You can compare several sources.",
      "You can read again more carefully.",
      "It is usually free.",
    ]},
    sideB: { label: "On TV 📺", points: [
      "Video shows you what really happened.",
      "It is edited by professional journalists.",
      "You watch it with the family and discuss.",
      "There is less false information.",
      "You get a full summary in half an hour.",
    ]},
  },
  {
    topic: "Renting a home or buying a home?",
    sideA: { label: "Renting 🔑", points: [
      "You can move for a new job easily.",
      "The owner pays for big repairs.",
      "You need much less money to start.",
      "You can try a neighbourhood first.",
      "No long debt hanging over you.",
    ]},
    sideB: { label: "Buying 🏠", points: [
      "The money becomes yours, not the landlord's.",
      "Nobody can ask you to leave.",
      "You can change anything you like.",
      "It is security for your family.",
      "Payments end one day; rent never does.",
    ]},
  },
  {
    topic: "Having a daily routine or changing every day?",
    sideA: { label: "Routine ⏰", points: [
      "Your body and sleep improve.",
      "You make decisions faster.",
      "Habits get difficult things done.",
      "You waste less time each morning.",
      "Progress comes from repeating.",
    ]},
    sideB: { label: "Changing 🎭", points: [
      "You never get bored.",
      "You adapt easily to surprises.",
      "New situations teach you more.",
      "Life feels fresh.",
      "Too much routine can become a prison.",
    ]},
  },
  {
    topic: "Learning from your own mistakes or from others' advice?",
    sideA: { label: "Own mistakes 🔧", points: [
      "You never forget a lesson you lived.",
      "You understand the reason, not just the rule.",
      "It builds real confidence.",
      "Advice does not always fit your situation.",
      "Trying is how you find your own way.",
    ]},
    sideB: { label: "Others' advice 🗣️", points: [
      "You avoid painful and costly errors.",
      "Experienced people save you years.",
      "Some mistakes are too serious to make.",
      "You progress much faster.",
      "Asking is a strength, not a weakness.",
    ]},
  },
  {
    topic: "Being the leader or being part of the team?",
    sideA: { label: "The leader 👑", points: [
      "You decide the direction.",
      "You develop skills people value highly.",
      "You can protect and support your team.",
      "Your ideas actually get used.",
      "You grow fastest under responsibility.",
    ]},
    sideB: { label: "In the team 🤝", points: [
      "You focus on the work, not the politics.",
      "Far less stress and pressure.",
      "You can learn from a good leader.",
      "You finish work and go home.",
      "A team without good members achieves nothing.",
    ]},
  },
  {
    topic: "Zoos — should they exist?",
    sideA: { label: "Yes, keep them 🦁", points: [
      "They protect species that would disappear.",
      "Children learn to love animals.",
      "Zoos fund real research.",
      "Injured animals are cared for.",
      "Most people would never see these animals otherwise.",
    ]},
    sideB: { label: "No, close them 🚫", points: [
      "Cages are far too small for wild animals.",
      "Animals behave abnormally in captivity.",
      "Documentaries can teach the same lessons.",
      "It is entertainment, not education.",
      "Money would be better spent protecting habitats.",
    ]},
  },
  {
    topic: "Public school or private school — which is better?",
    sideA: { label: "Public 🏫", points: [
      "Education should be free for everyone.",
      "Students meet all kinds of people.",
      "Many public schools have excellent teachers.",
      "Families are not put under financial pressure.",
      "It keeps society more equal.",
    ]},
    sideB: { label: "Private 🎓", points: [
      "Classes are smaller and more personal.",
      "Better facilities and equipment.",
      "More languages and extra activities.",
      "Parents can choose the teaching style.",
      "Competition raises standards for all schools.",
    ]},
  },
  {
    topic: "Electric cars or petrol cars — which is better?",
    sideA: { label: "Electric ⚡", points: [
      "No exhaust fumes in our cities.",
      "Electricity costs less than petrol.",
      "They are almost silent.",
      "Fewer parts, so less to repair.",
      "They can charge from renewable energy.",
    ]},
    sideB: { label: "Petrol ⛽", points: [
      "You refuel in five minutes anywhere.",
      "They are cheaper to buy today.",
      "They go much further on one tank.",
      "Petrol stations already exist everywhere.",
      "Battery production also harms the environment.",
    ]},
  },
  {
    topic: "Doing sport for fun or for competition?",
    sideA: { label: "For fun 😄", points: [
      "You keep doing it for your whole life.",
      "No pressure, no injuries from overtraining.",
      "You play with anyone at any level.",
      "It reduces stress instead of adding it.",
      "Health matters more than medals.",
    ]},
    sideB: { label: "For competition 🏆", points: [
      "Competition makes you improve fast.",
      "It teaches discipline and dealing with defeat.",
      "Goals keep you training regularly.",
      "Winning is a real, earned joy.",
      "You discover your true limits.",
    ]},
  },
  {
    topic: "Watching sport at the stadium or on TV?",
    sideA: { label: "At the stadium 🏟️", points: [
      "The atmosphere is unforgettable.",
      "You see the whole field, not one camera.",
      "Singing with thousands of fans is special.",
      "You are part of the event, not a viewer.",
      "The memory lasts for years.",
    ]},
    sideB: { label: "On TV 📺", points: [
      "You see close-ups and replays.",
      "Commentators explain what is happening.",
      "It is far cheaper.",
      "You are warm, dry and comfortable.",
      "You can watch matches from anywhere in the world.",
    ]},
  },
  {
    topic: "Owning many things or living simply with few?",
    sideA: { label: "Many things 📦", points: [
      "You always have what you need.",
      "You can lend things to friends.",
      "Things you own show your interests.",
      "Buying good equipment improves hobbies.",
      "Replacing later costs more.",
    ]},
    sideB: { label: "Living simply 🍃", points: [
      "Fewer things means less cleaning and stress.",
      "You save a lot of money.",
      "You value what you actually keep.",
      "Moving house becomes easy.",
      "It is far better for the planet.",
    ]},
  },
  {
    topic: "Learning a musical instrument or learning a sport?",
    sideA: { label: "Instrument 🎸", points: [
      "Music trains memory and patience.",
      "You can play for your whole life.",
      "It is a beautiful way to express feelings.",
      "You can perform for family and friends.",
      "It helps concentration in other subjects.",
    ]},
    sideB: { label: "Sport 🏃", points: [
      "It keeps your body healthy.",
      "You make friends through a team.",
      "It releases stress after study.",
      "It teaches fair play and rules.",
      "Exercise improves sleep and mood.",
    ]},
  },
  {
    topic: "School uniform or your own clothes?",
    sideA: { label: "Uniform 👔", points: [
      "Nobody is judged for expensive clothes.",
      "Mornings are quick and simple.",
      "It creates a feeling of one school.",
      "Parents spend less on clothes.",
      "Students focus on lessons, not fashion.",
    ]},
    sideB: { label: "Own clothes 👕", points: [
      "You express who you are.",
      "You wear what is comfortable for the weather.",
      "Uniforms can be expensive too.",
      "It prepares you for adult life.",
      "Learning has nothing to do with clothing.",
    ]},
  },
  {
    topic: "Homework — useful or a waste of time?",
    sideA: { label: "Useful ✅", points: [
      "Repeating at home fixes the lesson in memory.",
      "It teaches you to work independently.",
      "Parents can see what is being studied.",
      "Teachers find out who needs help.",
      "It prepares you for exams and university.",
    ]},
    sideB: { label: "Waste of time ❌", points: [
      "Children already study for six hours.",
      "It takes time from sport and family.",
      "Copying is very common.",
      "Some parents can help and some cannot — that is unfair.",
      "Rest is also necessary for learning.",
    ]},
  },
  {
    topic: "Working part-time while studying or focusing only on study?",
    sideA: { label: "Work too 💼", points: [
      "You earn your own money.",
      "You gain real experience for your CV.",
      "You learn to manage time seriously.",
      "You meet people outside school.",
      "You understand the value of money.",
    ]},
    sideB: { label: "Study only 📚", points: [
      "Your grades stay high.",
      "You have energy to learn properly.",
      "These study years never come back.",
      "A better diploma brings a better job later.",
      "Tiredness makes both work and study worse.",
    ]},
  },
  {
    topic: "Many cheap clothes or few good-quality clothes?",
    sideA: { label: "Many cheap 🛍️", points: [
      "You can change your style often.",
      "You are not upset if something is ruined.",
      "You dress for every occasion.",
      "Fashion changes quickly anyway.",
      "It fits a small budget.",
    ]},
    sideB: { label: "Few good ones 🧥", points: [
      "Good clothes last for years.",
      "In the end you spend less.",
      "You always look smart.",
      "Choosing what to wear takes seconds.",
      "It creates far less waste.",
    ]},
  },
  {
    topic: "Talking about your problems or dealing with them quietly?",
    sideA: { label: "Talking 💬", points: [
      "Saying it out loud makes it smaller.",
      "Others may have the answer already.",
      "You realise you are not alone.",
      "Keeping everything inside harms your health.",
      "It brings you closer to people.",
    ]},
    sideB: { label: "Quietly 🤐", points: [
      "You solve it without worrying others.",
      "You think more clearly alone.",
      "Not every problem needs an audience.",
      "You avoid gossip.",
      "It builds independence.",
    ]},
  },
  {
    topic: "A job you love or a job that pays well?",
    sideA: { label: "A job you love ❤️", points: [
      "You spend most of your life at work.",
      "You do it better because you enjoy it.",
      "Less stress and fewer health problems.",
      "You keep learning without forcing yourself.",
      "Money cannot fix hating every morning.",
    ]},
    sideB: { label: "A job that pays 💰", points: [
      "It supports your family properly.",
      "Money buys the free time for your passions.",
      "Financial worry ruins any job.",
      "You can save and change career later.",
      "Passion can stay a hobby.",
    ]},
  },
  {
    topic: "Has technology made life better or worse?",
    sideA: { label: "Better 🚀", points: [
      "Medicine saves lives it could not before.",
      "Anyone can learn almost anything free online.",
      "Families stay connected across countries.",
      "Hard, dangerous work is now done by machines.",
      "Information reaches everyone, not only the rich.",
    ]},
    sideB: { label: "Worse ⚠️", points: [
      "People sit alone with screens instead of talking.",
      "Many jobs have disappeared.",
      "Privacy has almost gone.",
      "Constant notifications damage concentration and sleep.",
      "Old skills and crafts are being lost.",
    ]},
  },
  {
    topic: "Starting work early or studying for longer first?",
    sideA: { label: "Start work 🧰", points: [
      "You earn money years earlier.",
      "Experience teaches what books cannot.",
      "You avoid large student debt.",
      "You find out early what you enjoy.",
      "Many successful people started young.",
    ]},
    sideB: { label: "Study longer 🎓", points: [
      "Higher qualifications open more doors.",
      "You start at a better salary level.",
      "You have time to choose wisely.",
      "Studying later is much harder.",
      "Deep knowledge lasts a whole career.",
    ]},
  },
  {
    topic: "Spending free time alone or with other people?",
    sideA: { label: "Alone 🧘", points: [
      "You recover your energy properly.",
      "You do exactly what you want.",
      "You think and understand yourself better.",
      "No arguments or compromises.",
      "Hobbies get real attention.",
    ]},
    sideB: { label: "With people 🎉", points: [
      "Shared time creates memories.",
      "Friendships need time to survive.",
      "Laughing together lifts your mood.",
      "You hear new ideas.",
      "Too much time alone becomes loneliness.",
    ]},
  },
  {
    topic: "Trying new food or ordering what you know?",
    sideA: { label: "Trying new 🍜", points: [
      "You discover dishes you will love.",
      "Food teaches you about other cultures.",
      "It makes travelling far more interesting.",
      "You widen what you can cook at home.",
      "One bad meal is a small risk.",
    ]},
    sideB: { label: "What you know 🍲", points: [
      "You are never disappointed.",
      "You do not waste money on food you dislike.",
      "It is safer with allergies.",
      "You order in seconds.",
      "Familiar food is comforting after a hard day.",
    ]},
  },
  {
    topic: "Giving advice or just listening?",
    sideA: { label: "Giving advice 🗣️", points: [
      "People often genuinely want a solution.",
      "Your experience can save them trouble.",
      "Silence can feel like you do not care.",
      "A clear opinion helps someone decide.",
      "Real friends say the difficult thing.",
    ]},
    sideB: { label: "Just listening 👂", points: [
      "Most people only need to be heard.",
      "They usually know the answer already.",
      "Advice can sound like judgement.",
      "Listening builds trust.",
      "You rarely know the whole story.",
    ]},
  },
  {
    topic: "Doing things quickly or doing things carefully?",
    sideA: { label: "Quickly ⚡", points: [
      "You finish more in a day.",
      "Opportunities do not wait.",
      "Done is better than perfect.",
      "You get feedback sooner and improve.",
      "Slow work can mean never finishing.",
    ]},
    sideB: { label: "Carefully 🔍", points: [
      "Fewer mistakes to repair later.",
      "Quality is what people remember.",
      "Repeating the work costs more time.",
      "In some jobs an error is dangerous.",
      "Careful work builds your reputation.",
    ]},
  },
  {
    topic: "Always being early or being relaxed about time?",
    sideA: { label: "Always early ⏱️", points: [
      "You are calm instead of rushing.",
      "It shows respect for other people.",
      "You have time if something goes wrong.",
      "People trust you.",
      "You never miss a train or an interview.",
    ]},
    sideB: { label: "Relaxed 😌", points: [
      "You waste less time waiting.",
      "Life has less pressure.",
      "Plans change anyway.",
      "You fit more into your day.",
      "In many cultures this is completely normal.",
    ]},
  },
  {
    topic: "Keeping old traditions or trying new ways?",
    sideA: { label: "Traditions 🕌", points: [
      "They connect generations of a family.",
      "They give you a clear identity.",
      "Celebrations bring everyone together.",
      "They carry the wisdom of the past.",
      "Without them a culture disappears.",
    ]},
    sideB: { label: "New ways 🌱", points: [
      "Society changes, so customs must too.",
      "Some old habits were unfair to people.",
      "New ideas solve today's problems.",
      "Young people should choose for themselves.",
      "Cultures stay alive by growing.",
    ]},
  },
];

// Deterministic interleave: simple, normal, simple, normal, ...
// A pure function of the two arrays, so every device builds the identical
// order — that is what keeps the two peers in sync as topicIndex advances.
// Never replace this with a runtime shuffle.
// `level` is attached here rather than written on each of the 150 entries, so
// it can never disagree with which array the topic actually came from.
function interleave(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i]) out.push({ ...a[i], level: 'simple' });
    if (b[i]) out.push({ ...b[i], level: 'normal' });
  }
  return out;
}

export const debateTopics = interleave(simpleTopics, normalTopics);
