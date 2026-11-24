import type { ShippedLoreEntry } from './lorebook'
export const CITY_LIFE_LORE: readonly ShippedLoreEntry[] = [
  { ref: 'city_life_dance_studio', id: 'dance_studio', keys: ['Dance Studio', 'dance studio', 'dance lesson', 'dance class'],
    text: "Dance Studio is a welcoming Downtown studio open every day and evening, with a sprung maple floor, mirrored walls, ballet barres, tall windows, a sound system and benches with cubbies. Anyone may visit, practice, take part in lessons or enjoy social dancing with friends or a willing date, regardless of dance skill, stats or employment. Dance Instructor is a paid job obtained only through the Jobs board after the player meets its requirements; merely visiting or narrating a lesson does not hire or pay the player. Robin Ellis directs the studio. During an actual scheduled instructor shift, the reader teaches beginners, demonstrates routines and supports nervous students. Background: dance_studio. Default clothing at this venue is PE wear for students and instructors, during visits, practice, lessons and teaching shifts. Use each character's existing PE outfit and _pe emotion sprites when that wardrobe is available; otherwise use their main outfit and available sprites. Keep the PE suffix until they change clothes. Honor an explicitly chosen different outfit or a change established in the scene. Preserve realistic physical limits and personal boundaries. Visits do not automatically award affection, improve stats or deduct fees; normal scene and job settlement handles rewards." },
  {
    "ref": "city_life_bowling_alley",
    "id": "bowling_alley",
    "keys": [
      "Lucky Strike Lanes",
      "bowling",
      "bowling alley"
    ],
    "text": "Lucky Strike Lanes is a casual Downtown bowling alley near the cheap food and entertainment district. It opens every day and evening, with rental shoes, polished lanes, ball returns, comfortable seats and a snack counter. Friends can play friendly games, practice alone or arrange a low-pressure bowling date. Background: bowling_alley. Keep bowling scores and outcomes plausible; no automatic victories or affection rewards. Admission and rental prices are descriptive unless the player explicitly purchases something through an existing supported transaction; do not invent automatic money deductions."
  },
  {
    "ref": "city_life_roller_rink",
    "id": "roller_rink",
    "keys": [
      "Starlight Roller Rink",
      "roller skating",
      "roller rink",
      "skating rink"
    ],
    "text": "Starlight Roller Rink is a retro indoor roller-skating venue in Downtown, open every day and evening. It has a smooth maple rink, rental quad skates, benches, a snack lounge, pastel neon and a disco ball. Beginners can practice near the rail while experienced skaters enjoy laps and music. Friends, solo visitors and dates are welcome; offer encouragement and realistic stumbles without forcing touch, romance or success. Background: roller_rink. Admission and rental prices are descriptive unless explicitly purchased through an existing supported transaction; do not invent automatic money deductions."
  },
  {
    "ref": "city_life_cat_cafe",
    "id": "cat_cafe",
    "keys": [
      "Purr & Pour",
      "cat cafe",
      "cat café",
      "cat lounge"
    ],
    "text": "Purr & Pour Cat Café is a cozy Downtown cafe open during native day and evening slots. Coffee and snacks are prepared in a separate counter area; the quiet cat lounge has climbing shelves, toys and comfortable seats. Visitors can enjoy a drink, read or gently play with cats who choose to approach. Staff explain house rules: respect resting cats, no chasing or forced handling, and keep human food away from them. Suitable for solo visits, friends or dates. Background: cat_cafe. No automatic affection or money deductions merely for visiting."
  }
]
