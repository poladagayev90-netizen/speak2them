/**
 * SpeakLab Serialized Listening Course (Episodic Curriculum)
 * Protagonist: Alex (and recurring ensemble: Maya, Sam)
 * 
 * Chapter 13: Hobbies & Free Time - "The Great Hobby Disaster"
 * Extended Durations (+20s):
 *  - Level A2: ~74s (95 WPM, 117 words)
 *  - Level B1: ~92s (120 WPM, 189 words)
 *  - Level B2: ~106s (140 WPM, 247 words)
 */

export const chapterStories = {
  chapter13: {
    id: "ch-13-hobbies",
    chapterNumber: 13,
    topicTitle: "Hobbies & Free Time 🎨",
    episodeTitle: "The Great Hobby Disaster",
    protagonist: "Alex",
    sideCharacters: ["Maya", "Sam"],
    synopsis: "Alex wastes his evenings doomscrolling. Maya gives him an ultimatum to pick up a real hobby before Sunday. Alex tries an artisan pottery workshop with disastrously hilarious consequences.",
    
    // 4 Cinematic Visual Scenes for UI Storyboard
    scenes: [
      {
        sceneIndex: 1,
        title: "The Evening Trap",
        caption: "Alex scrolling endlessly on the sofa in the dark.",
        imageSrc: "/listening/scene1_alex_sofa.jpg",
        imagePrompt: "3D animated style, cozy dim living room, young man 26 with brown hair wearing casual sweater slumped on comfortable sofa, blue smartphone light illuminating his tired face, clock on wall reads 11:15 PM, cinematic lighting."
      },
      {
        sceneIndex: 2,
        title: "Maya's Intervention",
        caption: "Maya demands that Alex find a real creative outlet.",
        imageSrc: "/listening/scene2_mayas_intervention.jpg",
        imagePrompt: "3D animated style, athletic organized young woman with crossed arms standing in doorway holding a planner calendar, looking critically at her lazy friend on the sofa, bright modern apartment."
      },
      {
        sceneIndex: 3,
        title: "The Pottery Catastrophe",
        caption: "Centrifugal force sends spinning wet clay flying across the studio!",
        imageSrc: "/listening/scene3_pottery_disaster.jpg",
        imagePrompt: "3D animated style, chaotic art studio, pottery wheel spinning frantically, terrified young man with clay smeared on face and clothes, a huge chunk of grey wet clay airborne flying across room, splash effect, dynamic action shot."
      },
      {
        sceneIndex: 4,
        title: "The Coffee Confession",
        caption: "Alex and Maya laughing at a café, clay still in Alex's hair.",
        imageSrc: "/listening/scene4_coffee_confession.jpg",
        imagePrompt: "3D animated style, bright sunny urban cafe outdoor terrace, young man and woman sitting at table with iced coffee, young man has dried grey clay smudge in hair and on jacket, both laughing hysterically, warm afternoon light."
      }
    ],

    levels: {
      a2: {
        levelCode: "A2",
        levelName: "Foundation / Gentle Flow",
        targetDurationSec: 74,
        wpm: 95,
        wordCount: 117,
        audioSrc: "/listening/ch13_a2_alex_pottery.mp3",
        script: `Alex had a problem that many people know. Every evening after work, he sat on his comfortable sofa with his smartphone. He scrolled through social media for three long hours just to kill time.

One Friday evening, his best friend Maya came over. She looked at him and shook her head: "Alex, this is so boring! You are wasting your life on screens. You need to pick up a new hobby before Sunday!"

Alex wanted to show her that he could be creative. So on Saturday afternoon, he joined a beginner pottery workshop. He sat down in front of a spinning pottery wheel with a lump of wet, cold clay.

At first, he tried to shape a simple tea cup. But when he pressed too hard, the wheel started spinning crazy fast!

Suddenly—SPLAT!

A huge piece of wet clay flew into the air and landed right on the teacher’s clean white shirt!

The whole room went quiet. Alex turned red, smiled shyly and said: "Well, I think my tea cup decided to fly!"

Maybe pottery was not his talent, but his weekend was definitely not boring anymore.`,

        goldenChunks: [
          {
            chunk: "kill time",
            meaningAZ: "vaxt öldürmək (gözləyərkən / boş vaxtda)",
            definition: "to do something that keeps you busy while waiting or bored",
            example: "I scrolled on my phone just to kill time."
          },
          {
            chunk: "pick up a new hobby",
            meaningAZ: "yeni bir hobbi ilə məşğul olmağa başlamaq",
            definition: "to start doing a new activity in your leisure time",
            example: "Maya told him to pick up a new hobby before Sunday."
          },
          {
            chunk: "free time",
            meaningAZ: "asudə / boş vaxt",
            definition: "time when you do not have to work or study",
            example: "How do you spend your free time on weekends?"
          },
          {
            chunk: "try your best",
            meaningAZ: "əlindən gələni etmək / cəhd etmək",
            definition: "to do something with maximum effort",
            example: "Alex tried his best to shape the wet clay."
          },
          {
            chunk: "waste time on screens",
            meaningAZ: "ekran qarşısında vaxtı boş yerə xərcləmək",
            definition: "spending unproductive hours on phones or tablets",
            example: "Stop wasting time on screens and go outside."
          }
        ],

        comprehensionQuestions: [
          {
            id: "q1",
            question: "Why did Alex sit on the sofa for three hours every evening?",
            options: [
              "He was working overtime for his company",
              "He was just scrolling on his phone to kill time",
              "He was practicing how to meditate"
            ],
            correctIndex: 1,
            explanation: "Alex sat on his sofa scrolling social media just to kill time after work."
          },
          {
            id: "q2",
            question: "What happened when Alex pressed too hard on the pottery wheel?",
            options: [
              "The clay turned into a beautiful coffee mug",
              "The electricity in the studio went off",
              "Wet clay flew into the air and hit the teacher's shirt"
            ],
            correctIndex: 2,
            explanation: "The wheel spun fast and a huge piece of wet clay hit the teacher's white shirt."
          },
          {
            id: "q3",
            question: "How did Alex feel at the end of the weekend?",
            options: [
              "His weekend was embarrassing, but definitely not boring",
              "He decided to become a professional potter",
              "He was angry at Maya and stopped speaking to her"
            ],
            correctIndex: 0,
            explanation: "He laughed with Maya and concluded that his weekend was certainly not boring anymore."
          }
        ],

        speakingMission: {
          title: "The Clumsy Hobby Confession",
          context: "Alex failed hilariously at pottery, but it made for a great story.",
          roles: {
            student: "Tell your teacher/partner about a hobby or skill you once tried and failed at (or found surprisingly hard).",
            partner: "Listen actively, ask 2 follow-up questions, and laugh along."
          },
          mandatoryChunks: ["kill time", "pick up a new hobby", "try your best"],
          promptQuestion: "Have you ever tried an activity (cooking, sports, painting, musical instrument) that went completely wrong? Describe what happened!"
        }
      },

      b1: {
        levelCode: "B1",
        levelName: "Intermediate / Natural Dialogue",
        targetDurationSec: 92,
        wpm: 120,
        wordCount: 189,
        audioSrc: "/listening/ch13_b1_alex_pottery.mp3",
        script: `Maya: "Alex, put that phone face-down on the table right now. You’ve been staring at that screen for two hours without blinking."

Alex: "I’m not wasting time, Maya! I’m doing research. I’m watching a craftsman build a wooden canoe from scratch. It’s deeply educational."

Maya: "Watching strangers live their lives on YouTube is not a hobby. You need an actual creative outlet—something you can be dedicated to."

Determined to prove her wrong, Alex signed up for an intensive weekend pottery workshop. His ambitious goal was simple: craft a handmade coffee mug.

When the session began, the instructor showed them how to center the spinning clay. It looked effortless on video. However, the moment Alex pressed his thumbs into the center, the clay wobbled violently out of balance.

The instructor shouted: "Ease up, Alex! Be gentle!"

But Alex panicked and stepped harder on the speed pedal.

Within seconds, the centrifugal force tore a massive chunk of wet clay from the base. It sailed across the studio like a wet cannonball, landing with a loud thud straight inside an elderly lady's designer handbag.

Alex froze in absolute horror. He turned around, looked at the furious lady, and asked: "On the bright side... would you like a free matching saucer?"`,

        goldenChunks: [
          {
            chunk: "creative outlet",
            meaningAZ: "yaradıcı çıxış yolu (emosiya və enerjini ifadə etmək üçün)",
            definition: "an activity that allows you to express your imagination and feelings",
            example: "You need an actual creative outlet outside your office work."
          },
          {
            chunk: "dedicated to",
            meaningAZ: "bir işə vaxt və enerji ayıran / həsr olunmuş",
            definition: "giving a lot of your energy and focus to an activity",
            example: "He wanted to find something he could be truly dedicated to."
          },
          {
            chunk: "prove someone wrong",
            meaningAZ: "kiminsə yanıldığını sübut etmək",
            definition: "to show by actions that someone's negative opinion was mistaken",
            example: "Determined to prove Maya wrong, Alex signed up for the workshop."
          },
          {
            chunk: "out of balance",
            meaningAZ: "tarazlıqdan çıxmış / qeyri-sabit",
            definition: "losing steady physical equilibrium or stability",
            example: "The wet clay wobbled violently out of balance on the wheel."
          },
          {
            chunk: "on the bright side",
            meaningAZ: "yaxşı tərəfdən baxsaq / hər şər işdə bir xeyir var",
            definition: "looking at the one positive aspect of an otherwise bad situation",
            example: "On the bright side, at least nobody was injured!"
          }
        ],

        comprehensionQuestions: [
          {
            id: "q1",
            question: "How did Alex justify his YouTube screen time to Maya?",
            options: [
              "He claimed he was learning how to trade stocks",
              "He argued that watching canoe-building was educational research",
              "He said he was chatting with their mutual friends"
            ],
            correctIndex: 1,
            explanation: "Alex claimed he was researching and watching a craftsman build a wooden canoe."
          },
          {
            id: "q2",
            question: "Why did the pottery wheel spin so dangerously fast?",
            options: [
              "The machine malfunctioned on its own",
              "Alex panicked and stepped harder on the foot pedal",
              "The instructor told him to accelerate"
            ],
            correctIndex: 1,
            explanation: "Instead of easing up, Alex panicked and accidentally stepped harder on the speed pedal."
          },
          {
            id: "q3",
            question: "Where did the airborne chunk of clay land?",
            options: [
              "Directly inside a lady's designer handbag",
              "On the instructor's laptop keyboard",
              "Out the window onto the street"
            ],
            correctIndex: 0,
            explanation: "The clay sailed across the studio and landed straight into an elderly lady's designer handbag."
          }
        ],

        speakingMission: {
          title: "Passive Consumer vs Active Creator",
          context: "Maya claims watching videos of people doing crafts isn't a hobby.",
          roles: {
            student: "Defend or challenge Maya's perspective. Are DIY/cooking/craft videos a legitimate hobby, or just sophisticated procrastination?",
            partner: "Argue the opposing side and challenge with: 'If you don't produce anything, it's just consumption!'"
          },
          mandatoryChunks: ["creative outlet", "prove someone wrong", "on the bright side"],
          promptQuestion: "Do you spend more time watching others do interesting things online, or doing them yourself? How can we escape the passive consumption trap?"
        }
      },

      b2: {
        levelCode: "B2",
        levelName: "Upper-Intermediate / Wit & Irony",
        targetDurationSec: 106,
        wpm: 140,
        wordCount: 247,
        audioSrc: "/listening/ch13_b2_alex_pottery.mp3",
        script: `In our hyper-connected world, modern urbanites suffer from a peculiar psychological affliction: the persistent guilt of enjoying genuine leisure time. Alex was practically the poster child for this modern condition.

After a grueling week in software development, his default coping mechanism was collapsing onto his sofa, numbing his brain with endless short-form videos. Maya, an unapologetic productivity evangelist, staged what could only be described as a free-time intervention.

"You’re squandering your cognitive potential, Alex," she declared. "Consumerism is not leisure. You need a tactile pursuit to counteract your digital burnout."

That was how Alex found himself reluctantly enrolled in an artisanal pottery masterclass. Enter the romantic illusion: soothing ambient music, aesthetic aprons, and the soulful promise of mindful creation.

The reality, however, proved merciless. The moment the motorized wheel kicked into gear, the cold lump of stoneware clay resisted every attempt at symmetry. When Alex attempted to hollow out what was intended to be a minimalist Scandinavian vase, the structural integrity collapsed. In a desperate bid to salvage the spinning monstrosity, he applied erratic pressure.

The clay morphed into a projectile, catapulting across the studio and narrowly missing the instructor’s prize-winning kiln display before obliterating a potted fern in the corner.

Nursing an iced Americano at a café afterward, covered in grey slip and chalky dust, Alex looked at Maya and delivered his verdict: "You know, maybe the real problem isn't my lack of a hobby. Maybe society’s obsession with turning every waking minute into a quantifiable pursuit of self-improvement is the real trap. Sometimes, absolute idleness is the ultimate act of rebellion."`,

        goldenChunks: [
          {
            chunk: "leisure time",
            meaningAZ: "işdən kənar asudə / istirahət vaxtı",
            definition: "time when one is not working or preoccupied with duties; relaxation",
            example: "Why does modern culture make us feel guilty about pure leisure time?"
          },
          {
            chunk: "squander potential",
            meaningAZ: "öz potensialını havayı / boş yerə xərcləmək",
            definition: "to waste thought, energy, or opportunity foolishly",
            example: "She accused him of squandering his cognitive potential on short clips."
          },
          {
            chunk: "digital burnout",
            meaningAZ: "rəqəmsal tükənmə (ekran və informasiya yorğunluğu)",
            definition: "mental exhaustion caused by prolonged exposure to digital screens and notifications",
            example: "Tactile activities like pottery are marketed as cures for digital burnout."
          },
          {
            chunk: "tactile pursuit",
            meaningAZ: "toxunularaq edilən fiziki / əl işi məşğuliyyəti",
            definition: "a hands-on, physical activity involving real touch and craftsmanship",
            example: "He needed a tactile pursuit away from keyboards and monitors."
          },
          {
            chunk: "quantifiable self-improvement",
            meaningAZ: "ölçülə bilən şəxsi inkişaf (hər dəqiqəni faydaya çevirmək cəhdi)",
            definition: "the obsession with measuring every minute in terms of productivity and gains",
            example: "We feel anxious if our hobbies don't lead to quantifiable self-improvement."
          }
        ],

        comprehensionQuestions: [
          {
            id: "q1",
            question: "According to the passage, what is the 'peculiar psychological affliction' modern people suffer from?",
            options: [
              "The physical inability to fall asleep without background noise",
              "The persistent guilt of relaxing without being productive",
              "The fear of socializing outside the workplace"
            ],
            correctIndex: 1,
            explanation: "Modern urbanites suffer from the persistent guilt of enjoying leisure without feeling productive."
          },
          {
            id: "q2",
            question: "What romantic expectation contrasted with Alex's actual pottery experience?",
            options: [
              "A serene, mindful experience with ambient music versus chaotic, destructive reality",
              "Meeting a romantic partner versus being stuck with children",
              "Selling his art for high prices versus giving it away for free"
            ],
            correctIndex: 0,
            explanation: "The illusion was ambient music and mindful creation; the reality was clay obliterating a potted fern."
          },
          {
            id: "q3",
            question: "What philosophical conclusion did Alex present at the café?",
            options: [
              "That he should open his own ceramic studio",
              "That Maya was 100% right and he should join a gym",
              "That constant hustle culture is a trap and idleness can be a form of rebellion"
            ],
            correctIndex: 2,
            explanation: "Alex argued that society's obsession with quantifiable self-improvement is a trap and idleness is rebellion."
          }
        ],

        speakingMission: {
          title: "The Hustle-Culture Trap vs JOMO",
          context: "Alex questions whether modern society has ruined hobbies by demanding they be productive or monetized.",
          roles: {
            student: "Take a stand: Should hobbies be purely unproductive fun, or is it better to develop hobbies that improve your career or health?",
            partner: "Play devil's advocate: 'If you just sit on the sofa, you're not rebelling—you're just decaying!'"
          },
          mandatoryChunks: ["leisure time", "digital burnout", "quantifiable self-improvement"],
          promptQuestion: "Have you felt guilty for 'doing nothing' on a Sunday? Why has modern society stigmatized peaceful idleness?"
        }
      }
    }
  },

  chapter14: {
    id: "ch-14-fashion",
    chapterNumber: 14,
    topicTitle: "Fashion & Style 👗",
    episodeTitle: "The Wardrobe Emergency",
    protagonist: "Alex",
    sideCharacters: ["Maya"],
    synopsis: "Invited to a formal dinner with an intimidating dress code, Alex realizes his wardrobe consists entirely of identical grey hoodies. Maya drags him to a high-end boutique, leading to a catastrophic fitting room malfunction.",
    
    scenes: [
      {
        sceneIndex: 1,
        title: "The Sad Wardrobe",
        caption: "Alex discovering his entire wardrobe is 7 identical grey hoodies.",
        imageSrc: "/listening/scene1_alex_closet.jpg",
        imagePrompt: "3D animated style, 26-year-old young man with brown messy hair looking into closet filled with 7 identical grey hoodies."
      },
      {
        sceneIndex: 2,
        title: "The Boutique Intervention",
        caption: "Maya presenting an extravagant emerald green velvet blazer.",
        imageSrc: "/listening/scene2_maya_boutique.jpg",
        imagePrompt: "3D animated style, Maya holding up shiny emerald green velvet blazer in boutique while Alex looks terrified."
      },
      {
        sceneIndex: 3,
        title: "The Fitting Room Disaster",
        caption: "A silver button dramatically pops off with bullet speed!",
        imageSrc: "/listening/scene3_fitting_room.jpg",
        imagePrompt: "3D animated style, Alex in tight suit as button pops off flying towards mirror."
      },
      {
        sceneIndex: 4,
        title: "Dressed to Impress",
        caption: "Alex looking sharp in a classic navy blazer at the gala with Maya.",
        imageSrc: "/listening/scene4_gala_triumph.jpg",
        imagePrompt: "3D animated style, Alex confident in dark navy blazer at gala party with Maya giving a thumbs up."
      }
    ],

    levels: {
      a2: {
        levelCode: "A2",
        levelName: "Foundation / Gentle Flow",
        targetDurationSec: 84,
        wpm: 95,
        wordCount: 134,
        audioSrc: "/listening/ch14_a2_alex_fashion.mp3",
        script: `Alex had a fashion emergency. His company invited him to a big dinner. The card said: "Dress code: Smart and Elegant."

Alex opened his wardrobe, but he only owned five grey t-shirts and old jeans. He never cared about fashion trends.

His friend Maya came to help. She looked at his closet and shook her head: "Alex, you cannot wear sneakers to a gala! We must go shopping and dress to impress!"

At the shop, Alex tried on a fancy black jacket, but it was too tight. When he tried to button it—POP! The silver button flew across the room and hit a mirror!

Alex laughed shyly: "Well, my button has great aim!"

Finally, they found a simple navy blazer that fit properly. Alex looked in the mirror and smiled: maybe dressing well wasn't so terrible after all.`,

        goldenChunks: [
          {
            chunk: "fashion emergency",
            meaningAZ: "dəb təşvişi / geyim böhranı",
            definition: "an urgent situation where you have nothing suitable to wear for an event",
            example: "Alex called Maya because he had a sudden fashion emergency."
          },
          {
            chunk: "dress to impress",
            meaningAZ: "təsir bağışlamaq üçün ən yaxşı paltarları geyinmək",
            definition: "to wear elegant or smart clothes to create a strong positive impression",
            example: "Maya told him they must go shopping and dress to impress."
          },
          {
            chunk: "fashion trends",
            meaningAZ: "dəb meylləri / trendlər",
            definition: "popular clothing styles that change over time",
            example: "He never paid attention to modern fashion trends."
          },
          {
            chunk: "dress code",
            meaningAZ: "geyim qaydası / dres-kod",
            definition: "a set of rules about what clothes people should wear to an event",
            example: "The invitation card stated that the dress code was smart and elegant."
          },
          {
            chunk: "fit properly",
            meaningAZ: "əyninə tam / düzgün oturmaq",
            definition: "to be the correct size and comfortable on your body",
            example: "They found a simple navy blazer that fit properly."
          }
        ],

        comprehensionQuestions: [
          {
            id: "q1",
            question: "Why did Alex have a fashion emergency?",
            options: [
              "He lost his luggage at the airport",
              "His company invited him to a formal dinner with a smart dress code",
              "He was going to a rock concert with Maya"
            ],
            correctIndex: 1,
            explanation: "Alex had to attend a company dinner where the dress code was Smart and Elegant."
          },
          {
            id: "q2",
            question: "What happened when Alex tried to button the black jacket?",
            options: [
              "The zipper got stuck permanently",
              "The silver button popped off and flew across the room",
              "The fabric changed color"
            ],
            correctIndex: 1,
            explanation: "The jacket was too tight and the button flew across the room, hitting a mirror."
          },
          {
            id: "q3",
            question: "What outfit did Alex and Maya finally choose?",
            options: [
              "A simple navy blazer that fit properly",
              "A bright green velvet tuxedo",
              "His favorite grey hoodie and sneakers"
            ],
            correctIndex: 0,
            explanation: "They found a classic navy blazer that fit properly and looked elegant."
          }
        ],

        speakingMission: {
          title: "The Dreaded Dress Code",
          context: "Alex had to dress up for a corporate gala despite hating formalwear.",
          roles: {
            student: "Tell your teacher or partner about your relationship with dress codes. Do you love dressing up, or do you prefer hoodies and sneakers?",
            partner: "Ask follow-up questions: 'What would you wear if you met the President tomorrow?'"
          },
          mandatoryChunks: ["dress code", "dress to impress", "fit properly"],
          promptQuestion: "Do you believe 'clothes make the person', or should people only care about comfort?"
        }
      },

      b1: {
        levelCode: "B1",
        levelName: "Intermediate / Natural Dialogue",
        targetDurationSec: 92,
        wpm: 120,
        wordCount: 181,
        audioSrc: "/listening/ch14_b1_alex_fashion.mp3",
        script: `Maya asked Alex to show his outfit options for tomorrow's formal dinner, pointing out that the invitation explicitly specified smart casual attire.

Alex argued that he had plenty of choices, presenting his collection of dark grey, light grey, and charcoal hoodies.

Maya complained that this wasn't a proper wardrobe, but rather fifty shades of laundry, reminding him that he needed to look sharp to represent the company.

Dragged reluctantly to an upscale boutique, Alex felt completely out of his depth among racks of tailored suits and silk ties. He pleaded to simply purchase something cheap off the rack, but Maya insisted he try on an emerald green velvet blazer, claiming it was very in fashion this season.

Inside the fitting room, Alex struggled into the jacket. It felt as stiff as cardboard. As he leaned forward to inspect the back in the mirror, the seam under his armpit loudly ripped in two.

Alex poked his head through the curtain, blushing furiously, and joked: "Good news: it's very breathable now. Bad news: I think I just bought a broken jacket."`,

        goldenChunks: [
          {
            chunk: "proper wardrobe",
            meaningAZ: "düzgün / zəngin qarderob",
            definition: "a complete and versatile collection of suitable clothes for different occasions",
            example: "Maya complained that five hoodies did not make a proper wardrobe."
          },
          {
            chunk: "off the rack",
            meaningAZ: "hazır / standart ölçüdə tikilmiş (fərdi sifarişsiz)",
            definition: "ready-made clothing bought directly from a shop, not custom tailored",
            example: "He pleaded to simply buy something cheap off the rack and go home."
          },
          {
            chunk: "in fashion",
            meaningAZ: "dəbdə olan / populyar",
            definition: "currently stylish, popular, or trendy",
            example: "Maya claimed that emerald velvet blazers were very in fashion."
          },
          {
            chunk: "look sharp",
            meaningAZ: "səliqəli və zövqlü görünmək",
            definition: "to look exceptionally smart, well-dressed, and stylish",
            example: "You need to look sharp when representing your firm at an industry gala."
          },
          {
            chunk: "out of one's depth",
            meaningAZ: "özünü yad / təcrübəsiz hiss etmək",
            definition: "in a situation that is beyond one's capability, familiarity, or comfort level",
            example: "Surrounded by Italian silk ties, Alex felt completely out of his depth."
          }
        ],

        comprehensionQuestions: [
          {
            id: "q1",
            question: "How did Maya describe Alex's collection of grey hoodies?",
            options: [
              "A timeless minimalist collection",
              "Fifty shades of laundry",
              "A very practical wardrobe for developers"
            ],
            correctIndex: 1,
            explanation: "Maya joked that his four grey hoodies were 'fifty shades of laundry'."
          },
          {
            id: "q2",
            question: "Why did Alex want to buy something 'off the rack'?",
            options: [
              "He wanted to save time and avoid fitting rooms",
              "He was shopping for a friend's wedding",
              "He was looking for second-hand vintage bargains"
            ],
            correctIndex: 0,
            explanation: "Alex felt out of his depth and pleaded to quickly buy something cheap off the rack."
          },
          {
            id: "q3",
            question: "What happened when Alex leaned forward in the velvet blazer?",
            options: [
              "The security alarm went off",
              "The seam under his armpit loudly ripped in two",
              "He realized it was two sizes too big"
            ],
            correctIndex: 1,
            explanation: "The stiff jacket tore under his armpit as he tried to look into the mirror."
          }
        ],

        speakingMission: {
          title: "Fast Fashion vs Investment Pieces",
          context: "Alex hates shopping and buys cheap off-the-rack basics, while Maya believes in tailored quality.",
          roles: {
            student: "Do you prefer buying lots of cheap clothes frequently, or investing in a few durable, high-quality items? What is your shopping philosophy?",
            partner: "Argue the environmental side: 'Cheap fast fashion is destroying the planet!'"
          },
          mandatoryChunks: ["proper wardrobe", "off the rack", "in fashion"],
          promptQuestion: "How much does clothing influence your self-confidence? Do you feel different when you look sharp?"
        }
      },

      b2: {
        levelCode: "B2",
        levelName: "Upper-Intermediate / Wit & Irony",
        targetDurationSec: 104,
        wpm: 138,
        wordCount: 232,
        audioSrc: "/listening/ch14_b2_alex_fashion.mp3",
        script: `For Alex, personal style had always been governed by a principle of ruthless minimalism: if a garment was clean and comfortable, it was deemed wearable. His wardrobe was an austere monoculture of muted neutrals, dominated by oversized hoodies and beaten-up trainers.

However, an impending black-tie charity gala organized by his company shattered this comfortable apathy. The dress code was unyielding: cocktail attire with individual flair.

Maya immediately staged an emergency wardrobe intervention. "Fashion isn't superficial vanity, Alex," she insisted as she marched him through a boutique district. "It's visual communication. What you wear broadcasts your confidence before you even utter a syllable."

Determined to convert him from fast fashion to sustainable fashion, Maya selected an eclectic vintage tuxedo from an artisan designer, crafted from midnight-blue wool with satin lapels.

In the opulent fitting room, Alex examined his reflection. The silhouette was undeniably striking, but the trousers lacked any meaningful flexibility. Determined to test their durability, Alex attempted a tentative squat, only for a catastrophic tearing sound to echo off the marble tiles as the center seam surrendered completely.

Peering sheepishly from behind the velvet curtain, Alex whispered: "Remember your speech about fashion being visual communication? Well, right now, my trousers are communicating a terrifying lack of structural integrity."

Luckily, the in-house tailor worked a minor miracle with needle and thread, and Alex walked into the gala that evening turning heads for all the right reasons.`,

        goldenChunks: [
          {
            chunk: "sustainable fashion",
            meaningAZ: "davamlı / ekoloji təmiz dəb",
            definition: "clothing designed, manufactured, and distributed in ways that preserve the environment",
            example: "Maya wanted to convert him to sustainable fashion and vintage craftsmanship."
          },
          {
            chunk: "visual communication",
            meaningAZ: "vizual ünsiyyət (sözsüz mesaj ötürmək)",
            definition: "conveying meaning, personality, and social status through aesthetics and attire",
            example: "Fashion is visual communication that speaks before you utter a syllable."
          },
          {
            chunk: "austere monoculture",
            meaningAZ: "sadə və eynicinsli / yeknəsəq seçim",
            definition: "an extremely plain, unvaried collection of identical items",
            example: "His closet was an austere monoculture of muted grey sweatshirts."
          },
          {
            chunk: "superficial vanity",
            meaningAZ: "səthi şöhrətpərəstlik / təkəbbür",
            definition: "excessive pride in one's appearance that lacks genuine substance",
            example: "She reminded him that caring about aesthetics is not mere superficial vanity."
          },
          {
            chunk: "turn heads",
            meaningAZ: "diqqəti cəlb etmək / heyran qoymaq",
            definition: "to attract a great deal of admiring attention from people around you",
            example: "He walked into the gala that evening, turning heads for all the right reasons."
          }
        ],

        comprehensionQuestions: [
          {
            id: "q1",
            question: "How did Alex traditionally choose what to wear?",
            options: [
              "He hired an online stylist once a month",
              "By a rule of ruthless minimalism: if it was clean and comfortable, it was wearable",
              "He strictly imitated high-fashion magazine models"
            ],
            correctIndex: 1,
            explanation: "Alex practiced ruthless minimalism: if it was clean and comfortable, it was wearable."
          },
          {
            id: "q2",
            question: "What philosophical argument did Maya make to justify caring about fashion?",
            options: [
              "That expensive clothes guarantee high salary promotions",
              "That fashion is visual communication that broadcasts confidence before speaking",
              "That people who dress poorly are scientifically less intelligent"
            ],
            correctIndex: 1,
            explanation: "Maya argued that fashion is visual communication broadcasting confidence before speaking."
          },
          {
            id: "q3",
            question: "What caused the catastrophic sound in the fitting room?",
            options: [
              "Alex dropped an expensive vintage porcelain vase",
              "Alex attempted a tentative squat, tearing the center back seam of the trousers",
              "The fitting room ceiling collapsed"
            ],
            correctIndex: 1,
            explanation: "Alex tried to test the pants' durability with a squat, ripping the center seam."
          }
        ],

        speakingMission: {
          title: "Fashion as Armor vs Fashion as Pressure",
          context: "Maya views clothing as visual communication and empowerment; Alex initially saw it as superficial vanity.",
          roles: {
            student: "Evaluate Maya's quote: 'What you wear broadcasts your confidence before you speak.' Is judging someone by clothing superficial or natural human psychology?",
            partner: "Play devil's advocate: 'Mark Zuckerberg and Steve Jobs wore the same clothes every day. Real geniuses don't waste brain cells on fashion!'"
          },
          mandatoryChunks: ["sustainable fashion", "visual communication", "turn heads"],
          promptQuestion: "Should companies enforce strict professional dress codes, or does casual dress foster better productivity?"
        }
      }
    }
  }
};
