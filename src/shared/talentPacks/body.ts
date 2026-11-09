import type { TalentPack } from '../talentTypes'

const pack = {
  id: 'body', name: 'Body', author: 'Maestro Leeds',
  trees: [{ id: 'body', name: 'Body', description: 'Train consistently and weather the semester.' }],
  skills: [
    { id: 'body.training', tree: 'body', chain: 'Training', name: 'Personal Best', costs: [20, 40],
      description: "When a solo activity earns Body, gain +1 extra Body at rank I or +2 at II. Classes and work shifts do not qualify.", effects: { 'body.solo': [1, 2] } },
    { id: 'body.partner', tree: 'body', chain: 'Training', name: 'Training Partner', costs: [30],
      prerequisites: [{ id: 'body.training', rank: 1 }],
      description: "Gain +1 extra Body when an activity with another character improves Body. Classes and work shifts do not qualify.", effects: { 'body.company': [1] } },
    { id: 'body.pe', tree: 'body', chain: 'Practice', name: 'Varsity Effort', costs: [20],
      description: "Gain +1 extra Body when you attend PE and improve Body.", effects: { 'body.pe': [1] } },
    { id: 'body.shift', tree: 'body', chain: 'Practice', name: 'Working Strength', costs: [30],
      prerequisites: [{ id: 'body.pe', rank: 1 }],
      description: "Gain +1 extra Body from a completed work shift that improves Body. Other shifts give no bonus.", effects: { 'body.shift': [1] } },
    { id: 'body.resist', tree: 'body', chain: 'Resilience', name: 'Iron Constitution', costs: [15, 30, 45],
      notes: ['Helps prevent new infections; it does not cure a cold you already have.'],
      description: "Your chance of catching a cold from contact is 15% lower at rank I, 30% at II, or 45% at III. You are also less likely to catch a newly arriving strain.", effects: { 'body.resist': [.15, .3, .45] } },
    { id: 'body.mild', tree: 'body', chain: 'Resilience', name: 'Shake It Off', costs: [25, 40],
      prerequisites: [{ id: 'body.resist', rank: 1 }],
      description: "A new cold is more likely to be mild: +10 percentage points at rank I or +20 at II. This does not change a cold you already have.", effects: { 'body.mild': [.1, .2] } }
  ]
} as const satisfies TalentPack
export default pack
