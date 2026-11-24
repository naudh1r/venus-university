import type { TalentPack } from '../talentTypes'

const pack = {
  id: 'brain', name: 'Brain', author: 'Maestro Leeds',
  trees: [{ id: 'brain', name: 'Brain', description: 'Turn steady study into better work.' }],
  skills: [
    { id: 'brain.focus', tree: 'brain', chain: 'Study', name: 'Deep Focus', costs: [20, 40],
      description: "When a solo activity earns Brain, gain +1 extra Brain at rank I or +2 at II. Classes and work shifts do not qualify.", effects: { 'brain.solo': [1, 2] } },
    { id: 'brain.notes', tree: 'brain', chain: 'Study', name: 'Active Listening', costs: [30],
      prerequisites: [{ id: 'brain.focus', rank: 1 }],
      description: "Gain +1 extra Brain when you attend a class that improves Brain.", effects: { 'brain.class': [1] } },
    { id: 'brain.method', tree: 'brain', chain: 'Projects', name: 'Work Smarter', costs: [20, 35],
      description: "Get 25% more progress from each project work session at rank I, or 50% more at II. Each session still takes the usual amount of time.", effects: { 'brain.work': [.25, .5] } },
    { id: 'brain.cram', tree: 'brain', chain: 'Projects', name: 'Late-Night Cram', costs: [40],
      prerequisites: [{ id: 'brain.method', rank: 1 }],
      description: "Project work at night gives double progress in the usual amount of time. This replaces the Work Smarter bonus for that session.", effects: { 'brain.night-work': [1] } },
    { id: 'brain.exam', tree: 'brain', chain: 'Assessment', name: 'Test Strategy', costs: [20, 35, 50],
      notes: ['Applies to future exams; previously recorded grades stay the same. Your Brain stat still affects the base exam score.'],
      description: "Add 3 percentage points to exam scores at rank I, 6 at II, or 9 at III. You must attend and answer a question; missed exams still score zero.", effects: { 'brain.exam': [3, 6, 9] } },
    { id: 'brain.polish', tree: 'brain', chain: 'Assessment', name: 'Final Polish', costs: [25, 40, 55],
      notes: ['Applies to future project showcases; previously recorded grades stay the same. Your Brain stat still affects the base showcase score.'],
      prerequisites: [{ id: 'brain.exam', rank: 1 }],
      description: "Add 3 percentage points to project showcase scores at rank I, 6 at II, or 9 at III. You must attend and have done some work. Unfinished projects cannot score 100%.", effects: { 'brain.showcase': [3, 6, 9] } }
  ]
} as const satisfies TalentPack
export default pack
