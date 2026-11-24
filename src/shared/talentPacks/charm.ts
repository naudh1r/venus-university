import type { TalentPack } from '../talentTypes'

const affectionNotes = ['Combines with other eligible Charm bonuses, up to +50% total. Any Echo affinity applies separately. This affection bonus does not increase BP rewards.'] as const

const pack = {
  // Keep the original skill/effect IDs so earlier purchases and saved memories survive.
  id: 'charm', name: 'Charm', author: 'Maestro Leeds',
  trees: [{ id: 'charm', name: 'Charm', description: 'Make new moments count, together or apart.' }],
  skills: [
    { id: 'heart.warmth', tree: 'charm', chain: 'Connection', name: 'Warm Welcome', costs: [15, 30, 45],
      notes: affectionNotes,
      description: "Liked moments earn more affection: +5% at rank I, +10% at II, and +15% at III.", effects: { 'heart.liked': [.05, .1, .15] } },
    { id: 'heart.spark', tree: 'charm', chain: 'Connection', name: 'Lasting Impression', costs: [25, 40, 55],
      notes: affectionNotes,
      prerequisites: [{ id: 'heart.warmth', rank: 1 }],
      description: "Loved moments earn more affection: +10% at rank I, +20% at II, and +30% at III.", effects: { 'heart.loved': [.1, .2, .3] } },
    { id: 'heart.group', tree: 'charm', chain: 'Together', name: 'Group Therapy', costs: [20, 35],
      notes: affectionNotes,
      description: "When you spend time with two or more characters, positive scene memories earn +5% affection at rank I or +10% at II. Texts and gifts do not count.", effects: { 'heart.group': [.05, .1] } },
    { id: 'heart.grace', tree: 'charm', chain: 'Together', name: 'A Little Grace', costs: [25, 40],
      prerequisites: [{ id: 'heart.group', rank: 1 }],
      description: "Disliked moments reduce affection by 10% less at rank I or 20% less at II. Hated moments and jealousy keep their usual penalties.", effects: { 'heart.grace': [.1, .2] } },
    { id: 'heart.text', tree: 'charm', chain: 'Thoughtfulness', name: 'Keep in Touch', costs: [15, 30],
      notes: affectionNotes,
      description: "Positive text conversations earn +5% affection at rank I or +10% at II.", effects: { 'heart.text': [.05, .1] } },
    { id: 'heart.gift', tree: 'charm', chain: 'Thoughtfulness', name: 'Thoughtful Gifts', costs: [25, 40],
      notes: affectionNotes,
      prerequisites: [{ id: 'heart.text', rank: 1 }],
      description: "Gifts that are liked or loved earn +10% affection at rank I or +20% at II. Total Charm bonuses on gifts cannot exceed +50%.", effects: { 'heart.gift': [.1, .2] } }
  ]
} as const satisfies TalentPack
export default pack
