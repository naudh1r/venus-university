// Copy to src/shared/talentPacks/guest.ts to include this pack in a source build.
import type { TalentPack } from '../../src/shared/talentTypes'
// After copying, change the import above to: import type { TalentPack } from '../talentTypes'

const pack = {
  id: 'guest',
  name: 'Guest skill pack',
  author: 'Your name',
  trees: [{ id: 'guest.opportunity', name: 'Opportunity', description: 'A small example tree.' }],
  skills: [
    {
      id: 'guest.network', tree: 'guest.opportunity', chain: 'Connections',
      name: 'Good Connections', description: 'Completed shifts pay 5 / 10% more.',
      costs: [20, 35], effects: { wageRate: [0.05, 0.10] }
    },
    {
      id: 'guest.insider', tree: 'guest.opportunity', chain: 'Connections',
      name: 'Insider Price', description: 'Shop purchases cost 5% less, up to the shared discount cap.',
      costs: [30], prerequisites: [{ id: 'guest.network', rank: 1 }],
      effects: { shopDiscount: [0.05] }
    }
  ]
} as const satisfies TalentPack

export default pack
