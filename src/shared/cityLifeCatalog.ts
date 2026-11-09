import type { LocationDef } from './locations'
import type { JobDef } from './jobs'

export const CITY_LIFE_LOCATIONS: readonly LocationDef[] = [
  { id: "dance_studio", label: "Dance Studio", icon: "💃",
    blurb: "a welcoming Downtown dance studio with mirrored walls, a sprung floor and space for practice, lessons and social dancing; visitors of every skill level are welcome" },
  {
    "id": "bowling_alley",
    "label": "Lucky Strike Lanes",
    "blurb": "a casual Downtown bowling alley with shoe rental, friendly games and a snack counter",
    "icon": "🎳"
  },
  {
    "id": "roller_rink",
    "label": "Starlight Roller Rink",
    "blurb": "a retro Downtown roller rink with quad-skate rental, disco lights and a snack lounge",
    "icon": "🛼"
  },
  {
    "id": "cat_cafe",
    "label": "Purr & Pour Cat Café",
    "blurb": "a cozy Downtown cat café with coffee, quiet seating and a separate cat lounge",
    "icon": "🐈"
  }
]

export const CITY_LIFE_JOBS: readonly JobDef[] = [
  {
  "id": "ex_dance_instructor",
  "title": "Dance Instructor",
  "employer": "Dance Studio",
  "workplaceKey": "Dance Studio",
  "locationId": "dance_studio",
  "boss": {
    "name": "Robin Ellis",
    "title": "Studio Director, Dance Studio",
    "emoji": "💃"
  },
  "pay": 300,
  "hours": [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13
  ],
  "requires": {
    "body": 3,
    "heart": 3
  },
  "requiresSkills": [
    {
      "id": "body.dancer",
      "label": "Dancer III",
      "rank": 3
    }
  ],
  "gains": [
    {
      "stats": [
        "body"
      ],
      "text": "Demonstrating steps and leading practice improved your coordination..."
    },
    {
      "stats": [
        "heart"
      ],
      "text": "Encouraging nervous students improved your confidence and patience..."
    }
  ],
  "duty": "teaching beginner dance classes, demonstrating footwork, helping students build confidence, and preparing group routines; adapt lessons to students and available space",
  "blurb": "Turn your dance skills into a teaching career. $300 per shift.",
  "description": "DANCE STUDIO — DANCE INSTRUCTOR (PART-TIME)\n\nHelp beginners find their rhythm and lead welcoming group classes at our Downtown studio.\n\nPlayer requirements: Dancer III through Campus Talents, Good Body and Good Heart. You must meet all three to apply. Choose shifts around your classes.\n\n$300 per shift before raises. Completed shifts improve Body or Heart. No application fee.\n\nEveryone is welcome to visit and practice, regardless of rank; these qualifications are for paid teaching only.",
  "messages": {
    "intro": "Welcome to the studio! I'm Robin, your director. Your first teaching shift is on the calendar. We'll start with beginners: clear demonstrations, patience, and room for everyone to learn.",
    "raise": "Your classes are making a difference. I have approved a raise—thank you for helping our students grow.",
    "missed": "Your class had no instructor today. Please check your roster. This is your first missed shift.",
    "missed2": "That is a second missed teaching shift. Students are counting on you; one more and we will have to end your contract.",
    "fired": "After three missed shifts, we have to end your teaching contract. You are still welcome to visit the studio.",
    "quit": "Thanks for letting me know. Good luck with your studies, and keep dancing.",
    "shiftApproved": "Your new class schedule is approved. It starts Sunday morning; please cover your current shifts until then.",
    "shiftChange": "Your new teaching schedule is now active. Please check your calendar.",
    "sick1": "Rest up. I will arrange cover for your class.",
    "sick2": "We cannot excuse another absence this semester. Missing this shift will count as a strike.",
    "welcomeBack": "Welcome back! Your previous pay rate is restored and your attendance record starts fresh. Let us get your classes going again.",
    "coldNotice": "There is a flu going around. Please stay home if you are ill; I will cover your classes while you recover."
  }
},
  {
    "id": "ex_bowling",
    "title": "Lane & Counter Attendant",
    "employer": "Lucky Strike Lanes",
    "workplaceKey": "Lucky Strike Lanes",
    "locationId": "bowling_alley",
    "boss": {
      "name": "Casey Park",
      "title": "Floor Manager, Lucky Strike Lanes",
      "emoji": "🎳"
    },
    "pay": 125,
    "requires": {
      "body": 2
    },
    "gains": [
      {
        "stats": [
          "body"
        ],
        "text": "Moving equipment and keeping the lanes running improved your stamina..."
      },
      {
        "stats": [
          "heart"
        ],
        "text": "Helping bowlers and managing the counter improved your confidence..."
      }
    ],
    "duty": "checking in bowlers, fitting rental shoes, restocking bowling balls and tidying lane seating; leave pinsetter repairs to trained staff",
    "blurb": "Friendly student shifts. Body tier 2 required; $125 per shift.",
    "hours": [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13
    ],
    "description": "LUCKY STRIKE LANES — LANE & COUNTER ATTENDANT (PART-TIME)\n\nFriendly student shifts. Body tier 2 required; $125 per shift. No application fee. Training provided. Duties: checking in bowlers, fitting rental shoes, restocking bowling balls and tidying lane seating; leave pinsetter repairs to trained staff. Choose shifts around your classes through the normal hiring screen.",
    "messages": {
      "intro": "Welcome to the team! Your shifts are on the schedule. Come find me when you arrive and I will show you the ropes.",
      "raise": "You have been doing solid work. I have approved a raise—thanks for keeping things running smoothly.",
      "missed": "You missed a scheduled shift. Please check your calendar; this is your first strike.",
      "missed2": "That is a second missed shift. We need reliable coverage. One more strike means we will have to let you go.",
      "fired": "After three missed shifts, we have to end your employment. Take care, and good luck with university.",
      "quit": "Thanks for letting me know. Good luck with your studies—you are welcome to visit any time.",
      "shiftApproved": "Your schedule change is approved. It starts Sunday morning; cover your existing shifts until then.",
      "shiftChange": "Your new schedule is active now. Please check your updated shifts.",
      "sick1": "Rest up. I will arrange coverage for this shift.",
      "sick2": "We cannot cover another absence right now. Missing this shift will count as a strike.",
      "welcomeBack": "Good to have you back! Your old pay rate stands and your record starts clean. Your shifts are on the schedule.",
      "coldNotice": "There is a flu going around and a few of the staff are already out sick. If you are feeling unwell, stay home and I will cover your shifts. No strikes."
    }
  },
  {
    "id": "ex_roller",
    "title": "Rink & Rental Attendant",
    "employer": "Starlight Roller Rink",
    "workplaceKey": "Starlight Roller Rink",
    "locationId": "roller_rink",
    "boss": {
      "name": "Jamie Santos",
      "title": "Rink Manager, Starlight Roller Rink",
      "emoji": "🛼"
    },
    "pay": 150,
    "requires": {
      "body": 2,
      "heart": 2
    },
    "gains": [
      {
        "stats": [
          "body"
        ],
        "text": "Patrolling the rink and handling skate rentals improved your stamina..."
      },
      {
        "stats": [
          "heart"
        ],
        "text": "Encouraging beginners and keeping the rink welcoming improved your confidence..."
      }
    ],
    "duty": "issuing and checking rental skates, helping beginners safely, monitoring rink rules and cleaning seating between sessions",
    "blurb": "Keep the good times rolling. Body and Heart tier 2 required; $150 per shift.",
    "hours": [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13
    ],
    "description": "STARLIGHT ROLLER RINK — RINK & RENTAL ATTENDANT (PART-TIME)\n\nKeep the good times rolling. Body and Heart tier 2 required; $150 per shift. No application fee. Training provided. Duties: issuing and checking rental skates, helping beginners safely, monitoring rink rules and cleaning seating between sessions. Choose shifts around your classes through the normal hiring screen.",
    "messages": {
      "intro": "Welcome to the team! Your shifts are on the schedule. Come find me when you arrive and I will show you the ropes.",
      "raise": "You have been doing solid work. I have approved a raise—thanks for keeping things running smoothly.",
      "missed": "You missed a scheduled shift. Please check your calendar; this is your first strike.",
      "missed2": "That is a second missed shift. We need reliable coverage. One more strike means we will have to let you go.",
      "fired": "After three missed shifts, we have to end your employment. Take care, and good luck with university.",
      "quit": "Thanks for letting me know. Good luck with your studies—you are welcome to visit any time.",
      "shiftApproved": "Your schedule change is approved. It starts Sunday morning; cover your existing shifts until then.",
      "shiftChange": "Your new schedule is active now. Please check your updated shifts.",
      "sick1": "Rest up. I will arrange coverage for this shift.",
      "sick2": "We cannot cover another absence right now. Missing this shift will count as a strike.",
      "welcomeBack": "Good to have you back! Your old pay rate stands and your record starts clean. Your shifts are on the schedule.",
      "coldNotice": "There is a flu going around and a few of the staff are already out sick. If you are feeling unwell, stay home and I will cover your shifts. No strikes."
    }
  },
  {
    "id": "ex_cat_cafe",
    "title": "Café & Cat Lounge Assistant",
    "employer": "Purr & Pour Cat Café",
    "workplaceKey": "Purr & Pour",
    "locationId": "cat_cafe",
    "boss": {
      "name": "Rowan Bell",
      "title": "Café Manager, Purr & Pour",
      "emoji": "🐈"
    },
    "pay": 140,
    "requires": {
      "brain": 2,
      "heart": 2
    },
    "gains": [
      {
        "stats": [
          "brain"
        ],
        "text": "Learning drink orders and the cats’ care routines sharpened your attention..."
      },
      {
        "stats": [
          "heart"
        ],
        "text": "Welcoming guests and patiently explaining cat-lounge rules improved your confidence..."
      }
    ],
    "duty": "taking drink orders in the separate café area, supervising respectful cat interactions and helping staff with cleaning and routine cat care; follow hygiene rules and leave medical care to professionals",
    "blurb": "Patient, attentive students wanted. Brain and Heart tier 2 required; $140 per shift.",
    "hours": [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13
    ],
    "description": "PURR & POUR CAT CAFÉ — CAFÉ & CAT LOUNGE ASSISTANT (PART-TIME)\n\nPatient, attentive students wanted. Brain and Heart tier 2 required; $140 per shift. No application fee. Training provided. Duties: taking drink orders in the separate café area, supervising respectful cat interactions and helping staff with cleaning and routine cat care; follow hygiene rules and leave medical care to professionals. Choose shifts around your classes through the normal hiring screen.",
    "messages": {
      "intro": "Welcome to the team! Your shifts are on the schedule. Come find me when you arrive and I will show you the ropes.",
      "raise": "You have been doing solid work. I have approved a raise—thanks for keeping things running smoothly.",
      "missed": "You missed a scheduled shift. Please check your calendar; this is your first strike.",
      "missed2": "That is a second missed shift. We need reliable coverage. One more strike means we will have to let you go.",
      "fired": "After three missed shifts, we have to end your employment. Take care, and good luck with university.",
      "quit": "Thanks for letting me know. Good luck with your studies—you are welcome to visit any time.",
      "shiftApproved": "Your schedule change is approved. It starts Sunday morning; cover your existing shifts until then.",
      "shiftChange": "Your new schedule is active now. Please check your updated shifts.",
      "sick1": "Rest up. I will arrange coverage for this shift.",
      "sick2": "We cannot cover another absence right now. Missing this shift will count as a strike.",
      "welcomeBack": "Good to have you back! Your old pay rate stands and your record starts clean. Your shifts are on the schedule.",
      "coldNotice": "There is a flu going around and a few of the staff are already out sick. If you are feeling unwell, stay home and I will cover your shifts. No strikes."
    }
  }
]
