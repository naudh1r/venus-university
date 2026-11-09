import type { TalentPack } from '../talentTypes'

const pack = {
  id: 'heart', name: 'Heart', author: 'Maestro Leeds',
  trees: [{ id: 'heart', name: 'Heart', description: 'Build confidence and grow your Heart stat through practice.' }],
  skills: [
    { id: 'heart.confidence', tree: 'heart', chain: 'Confidence', name: 'Quiet Confidence', costs: [20, 40],
      description: 'Solo activities that already earn Heart give +1 extra Heart at rank I or +2 at II. Classes and shifts do not qualify.', effects: { 'heart.solo': [1, 2] } },
    { id: 'heart.ease', tree: 'heart', chain: 'Confidence', name: 'Social Ease', costs: [25, 40],
      prerequisites: [{ id: 'heart.confidence', rank: 1 }],
      description: 'Activities with company that already earn Heart give +1 extra Heart at rank I or +2 at II. Classes and shifts do not qualify.', effects: { 'heart.company': [1, 2] } },
    { id: 'heart.class', tree: 'heart', chain: 'Practice', name: 'Class Act', costs: [20],
      description: 'Attending a class that awards Heart gives +1 extra Heart.', effects: { 'heart.class': [1] } },
    { id: 'heart.work', tree: 'heart', chain: 'Practice', name: 'People Person', costs: [30],
      prerequisites: [{ id: 'heart.class', rank: 1 }],
      description: 'A completed work shift that awards Heart gives +1 extra Heart. Other shifts give no bonus.', effects: { 'heart.shift': [1] } },
    // Keep the saved rank ID and prices so existing purchases transfer to Show Up.
    { id: 'heart.pride', tree: 'heart', chain: 'Growth', name: 'Show Up', costs: [20, 35],
      description: 'Earn +1 Heart at rank I or +2 at II when you attend an accepted invitation or agreed plan and someone you came to meet likes or loves the meeting. Once per day.', effects: { 'heart.show-up': [1, 2] } },
    { id: 'heart.feet', tree: 'heart', chain: 'Growth', name: 'Finding Your Feet', costs: [40],
      prerequisites: [{ id: 'heart.pride', rank: 1 }],
      description: 'While your Heart stat is below zero, activities, classes and shifts that already earn Heart give another +1 Heart. Stacks with your training bonus. Grades alone do not qualify.', effects: { 'heart.recovery': [1] } }
  ]
} as const satisfies TalentPack
export default pack
