// The lessons: how to actually do the thing the app asks you to do.
//
// WHY THIS EXISTS, measured rather than assumed. In the production numbers of
// 27 Aug the median call ran FORTY SECONDS and 43 of 71 calls never reached a
// minute; 111 of 155 calls opened no activity at all, and the ones that did ran
// three times longer (81 s against 27 s). More than half of the real analysis
// reports held fewer than twenty words. Nobody was refusing to speak — they
// connected, said hello, and then ran out of things to say, because "describe
// this picture" is an instruction, not a skill.
//
// So these are not grammar lessons. Each one is a small speaking move with the
// exact sentences to use, and each module ends by handing the learner straight
// into the real activity where the move pays off.
//
// RULES FOR THIS FILE
// • The interface is English (CLAUDE.md). The ONE translation here is the
//   `az`/`tr` meaning of a phrase, tapped open on purpose — the same deal as
//   KeywordChips: English is the default, the meaning is one tap away, in the
//   learner's L1 from users.preferredLanguage, never the phone's language.
// • No locks. A lesson is a suggestion, and the map recommends the next one
//   rather than barring the rest. The forced word-gate in the describe activity
//   was rolled back for exactly this reason: a learner who is already speaking
//   well must never be held behind a checkbox.
// • Ids are written to disk (lessonProgress/{uid}), so RENAMING an id silently
//   un-completes it for everyone. Add, don't rename.

// A card is whatever it needs to be: prose, a set of phrases, a worked example,
// a trap, an out-loud prompt. The reader renders the fields that are present.
export const lessonModules = [
  {
    id: 'describe',
    title: 'Describe a picture',
    blurb: 'Turn one sentence into five.',
    practice: { label: 'Describe pictures with AInur', to: '/practice' },
    lessons: [
      {
        id: 'describe-see',
        title: 'Start with what is there',
        minutes: 3,
        why: 'The photo is on screen and nothing comes out. Naming things is the way in — it needs no ideas, only nouns.',
        cards: [
          {
            title: 'One structure does most of the work',
            body: 'There is for one thing, there are for several. You can describe any picture in the world with these two.',
            phrases: [
              { en: 'There is a man in a blue jacket.', az: 'Mavi gödəkçəli bir kişi var.', tr: 'Mavi montlu bir adam var.' },
              { en: 'There are two children on the grass.', az: 'Otun üstündə iki uşaq var.', tr: 'Çimende iki çocuk var.' },
              { en: 'I can see a small table and some cups.', az: 'Kiçik bir masa və bir neçə fincan görürəm.', tr: 'Küçük bir masa ve birkaç fincan görüyorum.' },
            ],
          },
          {
            title: 'Move your eyes across the photo',
            body: 'Take the picture in four pieces instead of all at once. Four pieces are four sentences.',
            phrases: [
              { en: 'In the middle of the picture…', az: 'Şəklin ortasında…', tr: 'Fotoğrafın ortasında…' },
              { en: 'On the left / On the right…', az: 'Solda / Sağda…', tr: 'Solda / Sağda…' },
              { en: 'In the background…', az: 'Arxa planda…', tr: 'Arka planda…' },
              { en: 'At the front…', az: 'Ön tərəfdə…', tr: 'Ön tarafta…' },
            ],
          },
          {
            title: 'What this sounds like',
            example: {
              label: 'One photo, five seconds of looking',
              lines: [
                'There is a woman at a bus stop.',
                'On the left there are two bags.',
                'In the background I can see a red bus.',
                'At the front there is a small dog.',
              ],
            },
            say: 'Look up from your phone. Say three "There is / There are" sentences about the room you are in.',
          },
        ],
      },
      {
        id: 'describe-where',
        title: 'Say where things are',
        minutes: 3,
        why: 'Position is free detail. Every object you have already named can earn a second sentence.',
        cards: [
          {
            title: 'Eight words, and you never run short',
            phrases: [
              { en: 'on the table', az: 'masanın üstündə', tr: 'masanın üstünde' },
              { en: 'under the chair', az: 'stulun altında', tr: 'sandalyenin altında' },
              { en: 'next to the window', az: 'pəncərənin yanında', tr: 'pencerenin yanında' },
              { en: 'behind the man', az: 'kişinin arxasında', tr: 'adamın arkasında' },
              { en: 'in front of the door', az: 'qapının qarşısında', tr: 'kapının önünde' },
              { en: 'between the two cars', az: 'iki maşının arasında', tr: 'iki arabanın arasında' },
            ],
          },
          {
            title: 'Join two things and the sentence grows',
            body: 'A position word turns two nouns into one real sentence. This is the cheapest length there is.',
            example: {
              label: 'Same objects, longer answer',
              lines: [
                'A cat. A window. → There is a cat sitting next to the window.',
                'A boy. A bicycle. → There is a boy standing in front of an old bicycle.',
              ],
            },
            say: 'Name two things you can see right now and put them in one sentence with next to, behind or between.',
          },
        ],
      },
      {
        id: 'describe-doing',
        title: 'Say what is happening',
        minutes: 4,
        why: 'A list of objects stops after four sentences. Actions keep going, and they are what the picture is actually about.',
        cards: [
          {
            title: 'Right now means is + -ing',
            phrases: [
              { en: 'He is holding a cup.', az: 'O, əlində fincan tutub.', tr: 'Elinde bir fincan tutuyor.' },
              { en: 'They are waiting for someone.', az: 'Onlar kimisə gözləyirlər.', tr: 'Birini bekliyorlar.' },
              { en: 'She is looking at her phone.', az: 'O, telefonuna baxır.', tr: 'Telefonuna bakıyor.' },
              { en: 'Nobody is talking.', az: 'Heç kim danışmır.', tr: 'Kimse konuşmuyor.' },
            ],
          },
          {
            title: 'The mistake almost everybody makes',
            trap: {
              wrong: 'He wear a red hat. She talk on the phone.',
              right: 'He is wearing a red hat. She is talking on the phone.',
            },
            body: 'For what is happening in the photo, the is is not optional. Say it slowly until it stops feeling strange.',
          },
          {
            title: 'Bodies say a lot',
            body: 'When you cannot tell what someone is doing, describe how they are standing, sitting or looking.',
            phrases: [
              { en: 'He is leaning against the wall.', az: 'O, divara söykənib.', tr: 'Duvara yaslanmış.' },
              { en: 'She is bending down to pick something up.', az: 'O, nəyi isə götürmək üçün əyilir.', tr: 'Bir şey almak için eğiliyor.' },
              { en: 'They are standing very close to each other.', az: 'Onlar bir-birinə çox yaxın dayanıb.', tr: 'Birbirlerine çok yakın duruyorlar.' },
            ],
            say: 'Describe what the person nearest to you is doing, in three sentences, out loud.',
          },
        ],
      },
      {
        id: 'describe-guess',
        title: 'Guess the story',
        minutes: 4,
        why: 'This is the move that doubles your answer. A photo holds about five facts and an unlimited number of guesses.',
        cards: [
          {
            title: 'You are allowed to be wrong',
            body: 'Nobody can check your guess, so it costs nothing and it is where the interesting English lives.',
            phrases: [
              { en: 'It looks like they are celebrating something.', az: 'Deyəsən, nəyi isə qeyd edirlər.', tr: 'Bir şeyi kutluyor gibi görünüyorlar.' },
              { en: 'Maybe she is waiting for her sister.', az: 'Bəlkə bacısını gözləyir.', tr: 'Belki kız kardeşini bekliyor.' },
              { en: 'I think it is early morning, because the street is empty.', az: 'Məncə, səhər tezdir, çünki küçə boşdur.', tr: 'Sanırım sabah erken, çünkü sokak boş.' },
              { en: 'It could be a school, or maybe an office.', az: 'Məktəb ola bilər, bəlkə də ofis.', tr: 'Okul olabilir, belki de ofis.' },
            ],
          },
          {
            title: 'Because is the whole trick',
            body: 'Every guess gets a because. That one word turns a short sentence into two, and it is what a report counts as real speaking.',
            example: {
              label: 'Guess, then justify',
              lines: [
                'Maybe they are tourists — because they are looking at a map.',
                'I think he is tired, because he has closed his eyes on the train.',
                'It looks like it has just rained: the road is shining.',
              ],
            },
            say: 'Think of the last photo you took. Say two guesses about it, each one with because.',
          },
        ],
      },
      {
        id: 'describe-feel',
        title: 'Say how it feels, and what it reminds you of',
        minutes: 3,
        why: 'The picture is only the starting point. Your own life is the part nobody else can say, and it is where a description becomes a conversation.',
        cards: [
          {
            title: 'Give it a mood',
            phrases: [
              { en: 'The whole picture feels calm.', az: 'Bütün şəkil sakit görünür.', tr: 'Fotoğrafın tamamı sakin bir hava veriyor.' },
              { en: 'It looks a bit sad to me.', az: 'Mənə bir az kədərli görünür.', tr: 'Bana biraz hüzünlü geliyor.' },
              { en: 'There is a lot going on — it feels busy.', az: 'Çox şey baş verir — qarışıq görünür.', tr: 'Çok şey oluyor — kalabalık bir hava var.' },
            ],
          },
          {
            title: 'Then step out of the photo',
            phrases: [
              { en: 'This reminds me of my grandmother’s house.', az: 'Bu, mənə nənəmin evini xatırladır.', tr: 'Bu bana anneannemin evini hatırlatıyor.' },
              { en: 'I have never done this, but I would like to try.', az: 'Mən bunu heç vaxt etməmişəm, amma sınamaq istərdim.', tr: 'Bunu hiç yapmadım ama denemek isterim.' },
              { en: 'We do the same thing in my city, but in winter.', az: 'Bizim şəhərdə də eyni şeyi edirlər, amma qışda.', tr: 'Benim şehrimde de aynısını yapıyorlar ama kışın.' },
            ],
            say: 'Finish this out loud, twice, about two different memories: "This reminds me of…"',
          },
        ],
      },
    ],
  },

  {
    id: 'talk',
    title: 'Keep a conversation going',
    blurb: 'The moves that stop a call ending in forty seconds.',
    practice: { label: 'Talk to someone now', to: '/live' },
    lessons: [
      {
        id: 'talk-open',
        title: 'The first thirty seconds',
        minutes: 3,
        why: 'The hardest part of a call is the beginning, and it is the one part you can prepare word for word. Say it once out loud today and it is yours for every call after.',
        cards: [
          {
            title: 'Four sentences, always the same four',
            phrases: [
              { en: 'Hi! Can you hear me all right?', az: 'Salam! Məni yaxşı eşidirsən?', tr: 'Merhaba! Beni iyi duyuyor musun?' },
              { en: 'I’m Aysel. What’s your name?', az: 'Mən Ayseləm. Sənin adın nədir?', tr: 'Ben Aysel. Senin adın ne?' },
              { en: 'I’m calling from Baku. Where are you from?', az: 'Mən Bakıdan zəng edirəm. Sən haradansan?', tr: 'Bakü’den arıyorum. Sen neredensin?' },
              { en: 'I’m learning English for my job. How about you?', az: 'Mən işim üçün ingilis dili öyrənirəm. Sən necə?', tr: 'İş için İngilizce öğreniyorum. Sen neden öğreniyorsun?' },
            ],
          },
          {
            title: 'Then say what you want from the call',
            body: 'One sentence about the plan, and neither of you has to wonder who goes first.',
            phrases: [
              { en: 'Shall we start with today’s topic?', az: 'Bugünkü mövzudan başlayaq?', tr: 'Bugünün konusuyla başlayalım mı?' },
              { en: 'Do you want to open the picture and describe it together?', az: 'Şəkli açıb birlikdə təsvir edək?', tr: 'Resmi açıp birlikte anlatalım mı?' },
              { en: 'You go first, then me.', az: 'Sən başla, sonra mən.', tr: 'Sen başla, sonra ben.' },
            ],
            say: 'Say all four opening sentences out loud now, with your own name and city.',
          },
        ],
      },
      {
        id: 'talk-ask-back',
        title: 'Always give the ball back',
        minutes: 3,
        why: 'Two people answering questions is an interview. Two people asking them is a conversation — and it is the difference between a minute and ten.',
        cards: [
          {
            title: 'Never let your answer be the end of the turn',
            body: 'Answer, then hand it back. Four words are enough to do it.',
            phrases: [
              { en: 'What about you?', az: 'Sən necə?', tr: 'Sen ne dersin?' },
              { en: 'Do you think the same?', az: 'Sən də belə düşünürsən?', tr: 'Sen de aynı şeyi mi düşünüyorsun?' },
              { en: 'Has that ever happened to you?', az: 'Səninlə heç belə olub?', tr: 'Senin başına hiç böyle bir şey geldi mi?' },
            ],
          },
          {
            title: 'Questions that cannot be answered with yes',
            trap: {
              wrong: 'Do you like your city? → Yes. (silence)',
              right: 'What do you like most about your city? → …',
            },
            phrases: [
              { en: 'Why do you think that is?', az: 'Sənə görə bunun səbəbi nədir?', tr: 'Sence bunun nedeni ne?' },
              { en: 'How long have you been doing that?', az: 'Nə vaxtdan bunu edirsən?', tr: 'Ne zamandan beri bunu yapıyorsun?' },
              { en: 'What happened after that?', az: 'Ondan sonra nə oldu?', tr: 'Ondan sonra ne oldu?' },
              { en: 'Tell me more about that.', az: 'Bu barədə daha ətraflı danış.', tr: 'Bundan biraz daha bahset.' },
            ],
            say: 'Take one closed question — "Do you like films?" — and say three open versions of it out loud.',
          },
        ],
      },
      {
        id: 'talk-no-word',
        title: 'When you don’t know the word',
        minutes: 4,
        why: 'This is the moment most calls die: the word is missing, the learner stops, apologises, and switches language. Describing your way around the gap is a skill, and it is worth more than the word itself.',
        cards: [
          {
            title: 'Say what it is like, what it does, where it lives',
            phrases: [
              { en: 'It’s a thing you use for cutting bread.', az: 'Bu, çörək kəsmək üçün istifadə etdiyin bir şeydir.', tr: 'Ekmek kesmek için kullandığın bir şey.' },
              { en: 'It’s like a bag, but much smaller.', az: 'Çantaya bənzəyir, amma çox kiçikdir.', tr: 'Çantaya benziyor ama çok daha küçük.' },
              { en: 'You see them at the airport.', az: 'Onları hava limanında görürsən.', tr: 'Onları havalimanında görürsün.' },
              { en: 'It’s the opposite of cheap.', az: '«Ucuz» sözünün əksidir.', tr: '«Ucuz»un tersi.' },
            ],
          },
          {
            title: 'Buy yourself two seconds instead of stopping',
            phrases: [
              { en: 'How can I say this…', az: 'Bunu necə deyim…', tr: 'Bunu nasıl söylesem…' },
              { en: 'I forgot the word — it’s when you…', az: 'Söz yadımdan çıxdı — o zaman olur ki…', tr: 'Kelimeyi unuttum — hani şu…' },
              { en: 'What’s the word for this in English?', az: 'Bunun ingiliscəsi nədir?', tr: 'Bunun İngilizcesi ne?' },
            ],
            body: 'Asking your partner for the word is a normal part of a conversation between two learners. Going silent is not.',
            say: 'Explain three things without naming them: a fridge, a passport, a traffic jam.',
          },
        ],
      },
      {
        id: 'talk-not-understand',
        title: 'When you don’t understand',
        minutes: 3,
        why: 'Pretending to understand ends the conversation two turns later. Asking keeps it alive, and it is one short sentence.',
        cards: [
          {
            title: 'Ask, in a way that sounds easy',
            phrases: [
              { en: 'Sorry, could you say that again?', az: 'Bağışla, bir daha deyə bilərsən?', tr: 'Özür dilerim, tekrar söyler misin?' },
              { en: 'Could you speak a little more slowly, please?', az: 'Zəhmət olmasa, bir az yavaş danışa bilərsən?', tr: 'Biraz daha yavaş konuşabilir misin?' },
              { en: 'Do you mean that you…?', az: 'Sən demək istəyirsən ki…?', tr: 'Şunu mu demek istiyorsun…?' },
              { en: 'I didn’t catch the last word.', az: 'Sonuncu sözü tutmadım.', tr: 'Son kelimeyi yakalayamadım.' },
            ],
          },
          {
            title: 'Repeat it back and you check yourself',
            body: 'Saying it back in your own words tells your partner you followed, and gives you one more sentence of practice for free.',
            example: {
              label: 'Checking, out loud',
              lines: [
                '"So you moved to Baku last year and you are still looking for a job — is that right?"',
                '"You mean the exam is in June, not in July?"',
              ],
            },
            say: 'Say the four asking sentences out loud now. They have to come out without thinking.',
          },
        ],
      },
      {
        id: 'talk-close',
        title: 'Finish well, and set up the next one',
        minutes: 2,
        why: 'A call that ends with "ok… bye" rarely happens twice. A call that ends with a time happens every week.',
        cards: [
          {
            title: 'Three sentences at the end',
            phrases: [
              { en: 'It was really nice talking to you.', az: 'Səninlə danışmaq çox xoş oldu.', tr: 'Seninle konuşmak gerçekten güzeldi.' },
              { en: 'You explained that very clearly.', az: 'Bunu çox aydın izah etdin.', tr: 'Bunu çok net anlattın.' },
              { en: 'Same time next week?', az: 'Gələn həftə eyni vaxtda?', tr: 'Haftaya aynı saatte?' },
            ],
          },
          {
            title: 'One thing you learned',
            body: 'Before you hang up, say one word or phrase you took from the call. Your partner hears that they helped, and you remember it.',
            example: {
              label: 'The last thirty seconds',
              lines: [
                '"I’m taking one word from today: crowded. I will use it tomorrow."',
                '"Good luck with your interview on Monday — tell me how it went."',
              ],
            },
            say: 'Say the three closing sentences out loud, then add one real compliment.',
          },
        ],
      },
    ],
  },

  {
    id: 'taboo',
    title: 'Play Taboo',
    blurb: 'Explain a word without saying it.',
    practice: { label: 'Start a call and open Taboo', to: '/live' },
    lessons: [
      {
        id: 'taboo-how',
        title: 'How the game works',
        minutes: 2,
        why: 'Taboo is the fastest fluency exercise in the app, because it removes the one word you were relying on and you have to keep talking anyway.',
        cards: [
          {
            title: 'The rules, in four lines',
            body: 'One of you sees a word. You explain it in English until your partner says it. You may not say the word itself, or the same word in another form — and never in your own language. Then you swap.',
          },
          {
            title: 'Why it is worth it',
            body: 'In normal conversation you can avoid everything you do not know how to say. Here you cannot, so you learn the move that carries you through every real conversation: describing your way to the meaning.',
            say: 'Explain the word "breakfast" out loud without saying breakfast, eat or morning.',
          },
        ],
      },
      {
        id: 'taboo-moves',
        title: 'Four moves that always work',
        minutes: 4,
        why: 'Guessing which fact will help is what slows people down. Run the same four moves in the same order every time and you never have to decide.',
        cards: [
          {
            title: 'Category → use → place → opposite',
            phrases: [
              { en: 'It’s a kind of fruit.', az: 'Bu, bir meyvə növüdür.', tr: 'Bir meyve türü.' },
              { en: 'You use it to open doors.', az: 'Onu qapı açmaq üçün istifadə edirsən.', tr: 'Kapı açmak için kullanırsın.' },
              { en: 'You find it in every kitchen.', az: 'Onu hər mətbəxdə görərsən.', tr: 'Her mutfakta bulunur.' },
              { en: 'It’s the opposite of quiet.', az: '«Sakit» sözünün əksidir.', tr: '«Sessiz»in tersi.' },
            ],
          },
          {
            title: 'Then a story, if they still have not got it',
            body: 'A situation beats a definition. Put the word in a moment from your own life and your partner usually says it in the next second.',
            example: {
              label: 'The word is "umbrella"',
              lines: [
                'It’s a thing you carry. (category)',
                'You use it when it rains. (use)',
                'You leave it at the door of a café. (place)',
                'Yesterday I lost mine on the bus and I got completely wet.',
              ],
            },
            say: 'Run all four moves on one word: "hospital".',
          },
        ],
      },
      {
        id: 'taboo-keep-going',
        title: 'Keep talking under pressure',
        minutes: 3,
        why: 'The game is not lost when the word is hard. It is lost when you go quiet for five seconds.',
        cards: [
          {
            title: 'Fill the gap out loud',
            body: 'Think in English, audibly. Your partner can help a sentence they can hear; they can do nothing with silence.',
            phrases: [
              { en: 'Wait, let me explain it differently.', az: 'Dayan, başqa cür izah edim.', tr: 'Dur, başka türlü anlatayım.' },
              { en: 'It’s not exactly a car, but something similar.', az: 'Tam olaraq maşın deyil, amma ona bənzər bir şey.', tr: 'Tam olarak araba değil ama benzer bir şey.' },
              { en: 'Think about what you do every morning.', az: 'Hər səhər nə etdiyini düşün.', tr: 'Her sabah ne yaptığını düşün.' },
            ],
          },
          {
            title: 'When you are guessing, say your guesses',
            body: 'Wrong guesses are useful — they tell the explainer which way to push. Say them as they come.',
            phrases: [
              { en: 'Is it something you eat?', az: 'Yediyin bir şeydir?', tr: 'Yediğin bir şey mi?' },
              { en: 'Do you mean a bicycle?', az: 'Velosipedi deyirsən?', tr: 'Bisikleti mi kastediyorsun?' },
              { en: 'Give me one more clue.', az: 'Bir işarə də ver.', tr: 'Bir ipucu daha ver.' },
            ],
            say: 'Set a timer for sixty seconds and explain three words with no silence: "airport", "birthday", "neighbour".',
          },
        ],
      },
    ],
  },

  {
    id: 'debate',
    title: 'Take a side',
    blurb: 'Say what you think, and hold it for two minutes.',
    practice: { label: 'Start a call and open Debate', to: '/live' },
    lessons: [
      {
        id: 'debate-state',
        title: 'Your side in one sentence',
        minutes: 3,
        why: 'Most debates stall because nobody actually said what they think. One clear sentence at the start gives both of you something to talk about for ten minutes.',
        cards: [
          {
            title: 'Opinion, then reason, immediately',
            phrases: [
              { en: 'I think cats are better, because they are independent.', az: 'Məncə, pişiklər daha yaxşıdır, çünki müstəqildirlər.', tr: 'Bence kediler daha iyi, çünkü bağımsızlar.' },
              { en: 'In my opinion, working from home is better for families.', az: 'Mənim fikrimcə, evdən işləmək ailələr üçün daha yaxşıdır.', tr: 'Bence evden çalışmak aileler için daha iyi.' },
              { en: 'For me the main reason is the money.', az: 'Mənim üçün əsas səbəb puldur.', tr: 'Benim için ana sebep para.' },
            ],
          },
          {
            title: 'Two reasons are a position, one is an opinion',
            body: 'Say your side, then count your reasons out loud. Numbering them keeps you talking, and keeps your partner listening for the second one.',
            example: {
              label: 'Numbered, and therefore easy',
              lines: [
                'I think city life is better, for two reasons.',
                'First, everything is close — work, hospital, university.',
                'Second, there is always something to do in the evening.',
              ],
            },
            say: 'Pick one: tea or coffee. Say your side with two numbered reasons.',
          },
        ],
      },
      {
        id: 'debate-example',
        title: 'One example beats three arguments',
        minutes: 3,
        why: 'Abstract reasons run out after two sentences. A story from your own life runs as long as you like, and it is the English you will actually need.',
        cards: [
          {
            title: 'Get into the example fast',
            phrases: [
              { en: 'For example, last year my brother…', az: 'Məsələn, keçən il qardaşım…', tr: 'Örneğin, geçen yıl kardeşim…' },
              { en: 'In my city, this happens all the time.', az: 'Bizim şəhərdə bu, həmişə olur.', tr: 'Benim şehrimde bu her zaman oluyor.' },
              { en: 'I saw exactly this last week.', az: 'Məhz bunu keçən həftə gördüm.', tr: 'Tam olarak bunu geçen hafta gördüm.' },
            ],
          },
          {
            title: 'Then bring it back to the point',
            body: 'Finish the story with one sentence that says why you told it. That sentence is what makes it an argument instead of a story.',
            example: {
              label: 'Story, then the point',
              lines: [
                'For example, my cousin studied online for a year and he finished nothing.',
                'He needed people around him.',
                'That’s why I think a classroom is better for most students.',
              ],
            },
            say: 'Argue that phones should be banned at school, using one real story and one "that’s why".',
          },
        ],
      },
      {
        id: 'debate-disagree',
        title: 'Disagree without a fight',
        minutes: 3,
        why: 'You are talking to a stranger who is also nervous. Disagreeing softly keeps the conversation going; disagreeing flatly ends it.',
        cards: [
          {
            title: 'Agree with something first',
            phrases: [
              { en: 'I see your point, but…', az: 'Fikrini başa düşürəm, amma…', tr: 'Ne demek istediğini anlıyorum ama…' },
              { en: 'That’s true. However, in my country…', az: 'Bu doğrudur. Ancaq bizim ölkədə…', tr: 'Bu doğru. Ancak benim ülkemde…' },
              { en: 'I partly agree with you.', az: 'Qismən səninlə razıyam.', tr: 'Kısmen sana katılıyorum.' },
              { en: 'I’m not sure I agree, because…', az: 'Razı olduğumu deyə bilmərəm, çünki…', tr: 'Katıldığımdan emin değilim, çünkü…' },
            ],
          },
          {
            title: 'Ask before you push',
            body: 'A question is a stronger answer than a counter-argument: it makes your partner speak, which is the point of the call.',
            phrases: [
              { en: 'Why do you think that?', az: 'Niyə belə düşünürsən?', tr: 'Neden böyle düşünüyorsun?' },
              { en: 'Does that work for everyone, though?', az: 'Amma bu, hər kəs üçün işləyir?', tr: 'Ama bu herkes için geçerli mi?' },
              { en: 'Can you give me an example?', az: 'Nümunə gətirə bilərsən?', tr: 'Bir örnek verebilir misin?' },
            ],
            say: 'Someone says "money is the most important thing in a job". Disagree in three sentences, starting with agreement.',
          },
        ],
      },
      {
        id: 'debate-other-side',
        title: 'Argue the side you don’t believe',
        minutes: 3,
        why: 'In the app the sides swap on every topic, on purpose. Defending an opinion that is not yours is the exercise — you cannot fall back on what you already think, so you have to build the sentences.',
        cards: [
          {
            title: 'Speak for other people',
            phrases: [
              { en: 'Some people would say that…', az: 'Bəziləri deyərdi ki…', tr: 'Bazıları şöyle derdi…' },
              { en: 'One could argue that…', az: 'İddia etmək olar ki…', tr: 'Şu iddia edilebilir…' },
              { en: 'From a parent’s point of view…', az: 'Valideyn baxımından…', tr: 'Bir ebeveyn açısından…' },
              { en: 'If I were in that situation, I would…', az: 'Mən o vəziyyətdə olsaydım…', tr: 'O durumda olsaydım…' },
            ],
          },
          {
            title: 'Find the strongest version of the other side',
            body: 'Not the silly version — the one a reasonable person would actually hold. That is the sentence worth practising.',
            example: {
              label: 'You love the city, and you are arguing for the village',
              lines: [
                'Some people would say the city is exhausting.',
                'In a village you know your neighbours, and children can play outside.',
                'If I had small children, I would probably choose that too.',
              ],
            },
            say: 'Take an opinion you disagree with and speak for it for one minute, out loud, without laughing at it.',
          },
        ],
      },
    ],
  },
];

// Flat, in the order they are meant to be taken — the map, the reader's
// next/previous and the "recommended next" all walk this one list.
export const allLessons = lessonModules.flatMap((m) => m.lessons.map(
  (l) => ({ ...l, moduleId: m.id, moduleTitle: m.title }),
));

export const lessonCount = allLessons.length;

export const findLesson = (id) => allLessons.find((l) => l.id === id) || null;
export const findModule = (id) => lessonModules.find((m) => m.id === id) || null;
