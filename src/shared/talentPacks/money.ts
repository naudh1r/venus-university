import type { TalentPack } from '../talentTypes'
const pack = {
  "id": "money",
  "name": "Money",
  "author": "Maestro Leeds",
  "trees": [
    {
      "id": "money",
      "name": "Money",
      "description": "Earn more, spend thoughtfully, and build a savings cushion."
    }
  ],
  "skills": [
    {
      "id": "wages",
      "tree": "money",
      "chain": "Earn",
      "name": "Worth Your While",
      "costs": [
        15,
        30,
        45
      ],
      "description": "Earn more from completed work shifts: +10% pay at rank I, +20% at II, or +30% at III.",
      "effects": {
        "wageRate": [
          0.1,
          0.2,
          0.3
        ]
      }
    },
    {
      "id": "reliable",
      "tree": "money",
      "chain": "Earn",
      "name": "Reliable Hand",
      "costs": [
        25,
        40
      ],
      "description": "Earn an extra $25 every third consecutive shift at rank I, or $50 at II. A strike at work resets this streak.",
      "prerequisites": [
        {
          "id": "wages",
          "rank": 1
        }
      ],
      "effects": {
        "streakCash": [
          25,
          50
        ]
      }
    },
    {
      "id": "bargain",
      "tree": "money",
      "chain": "Spend",
      "name": "Bargain Hunter",
      "costs": [
        15,
        30,
        45
      ],
      "description": "Pay less for shop purchases: 5% off at rank I, 10% at II, or 15% at III.",
      "effects": {
        "shopDiscount": [
          0.05,
          0.1,
          0.15
        ]
      }
    },
    {
      "id": "regular",
      "tree": "money",
      "chain": "Spend",
      "name": "Regular Customer",
      "costs": [
        25,
        40
      ],
      "description": "Every third shop purchase gets an extra 5% off at rank I or 10% at II. Combined shop discounts cannot exceed 25%.",
      "prerequisites": [
        {
          "id": "bargain",
          "rank": 1
        }
      ],
      "effects": {
        "thirdPurchaseDiscount": [
          0.05,
          0.1
        ]
      }
    },
    {
      "id": "reserve",
      "tree": "money",
      "chain": "Save",
      "name": "Rainy Day Fund",
      "costs": [
        20
      ],
      "description": "Set cash aside in savings using the controls below. Deposit or withdraw here; shopping uses only the money in your wallet.",
      "effects": {
        "savingsAccess": [
          1
        ]
      }
    },
    {
      "id": "interest",
      "tree": "money",
      "chain": "Save",
      "name": "Nest Egg",
      "costs": [
        25,
        40,
        55
      ],
      "description": "Savings earn interest every seven days: 1% at rank I, 2% at II, or 3% at III, up to $25, $50, or $75. Interest uses the lowest balance held for the full period.",
      "prerequisites": [
        {
          "id": "reserve",
          "rank": 1
        }
      ],
      "effects": {
        "savingsRate": [
          0.01,
          0.02,
          0.03
        ],
        "savingsCap": [
          25,
          50,
          75
        ]
      }
    }
  ]
} as const satisfies TalentPack
export default pack
