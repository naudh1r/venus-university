import type { TalentPack } from '../talentTypes'
const pack = {
  "id": "echoes",
  "name": "Echoes",
  "author": "Maestro Leeds",
  "trees": [
    {
      "id": "echoes",
      "name": "Echoes",
      "description": "Develop your aspect bonds and channel spirit more efficiently."
    }
  ],
  "skills": [
    {
      "id": "matching",
      "tree": "echoes",
      "chain": "Resonance",
      "name": "Shared Wavelength",
      "notes": ["Applies to new positive memories; existing memories keep their recorded affinity."],
      "costs": [
        15,
        30,
        45
      ],
      "description": "Matching Echoes earn more affection from positive moments. Their usual +25% bonus becomes +30% at rank I, +35% at II, or +40% at III.",
      "requires": [
        "echo"
      ],
      "effects": {
        "matchingBonus": [
          0.05,
          0.1,
          0.15
        ]
      }
    },
    {
      "id": "neutral",
      "tree": "echoes",
      "chain": "Resonance",
      "name": "Common Frequency",
      "notes": ["Applies to new positive memories; existing memories keep their recorded affinity."],
      "costs": [
        25,
        40
      ],
      "description": "Neutral Echo pairings earn +5% affection from positive moments at rank I, or +10% at II.",
      "prerequisites": [
        {
          "id": "matching",
          "rank": 1
        }
      ],
      "requires": [
        "echo"
      ],
      "effects": {
        "neutralBonus": [
          0.05,
          0.1
        ]
      }
    },
    {
      "id": "competing",
      "tree": "echoes",
      "chain": "Harmony",
      "name": "Embrace the Difference",
      "notes": ["Applies to new positive memories; existing memories keep their recorded affinity."],
      "costs": [
        15,
        30,
        45
      ],
      "description": "Soften the affection penalty between competing Echoes. The usual 25% reduction becomes 15% at rank I, 5% at II, and none at III.",
      "requires": [
        "echo"
      ],
      "effects": {
        "competingRelief": [
          0.1,
          0.2,
          0.25
        ]
      }
    },
    {
      "id": "spark",
      "tree": "echoes",
      "chain": "Harmony",
      "name": "Shared Spark",
      "costs": [
        25,
        40
      ],
      "description": "When a positive interaction earns spirit with a matching Echo, gain +3 extra spirit at rank I or +6 at II. Applies once per time slot.",
      "prerequisites": [
        {
          "id": "competing",
          "rank": 1
        }
      ],
      "requires": [
        "echo",
        "breakthrough"
      ],
      "effects": {
        "matchingSpirit": [
          3,
          6
        ]
      }
    },
    {
      "id": "kindling",
      "tree": "echoes",
      "chain": "Spirit",
      "name": "Kindling",
      "costs": [
        15,
        30,
        45
      ],
      "description": "Earn more spirit from positive interactions: +10% at rank I, +20% at II, or +30% at III. Spirit still caps at 100; losses are unchanged.",
      "requires": [
        "echo",
        "breakthrough"
      ],
      "effects": {
        "spiritRate": [
          0.1,
          0.2,
          0.3
        ]
      }
    },
    {
      "id": "breath",
      "tree": "echoes",
      "chain": "Spirit",
      "name": "Measured Breath",
      "notes": ["Echo abilities must be enabled to use this discount."],
      "costs": [
        25,
        40
      ],
      "description": "Echo abilities cost 5 less spirit at rank I or 10 less at II, to a minimum of 15. Ordinary Breakthrough still costs 100 spirit.",
      "prerequisites": [
        {
          "id": "kindling",
          "rank": 1
        }
      ],
      "requires": [
        "echo",
        "breakthrough"
      ],
      "effects": {
        "echoDiscount": [
          5,
          10
        ]
      }
    }
  ]
} as const satisfies TalentPack
export default pack
