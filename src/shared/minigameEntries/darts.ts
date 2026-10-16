import type { MiniGameDef } from '../minigameKit'

const DARTS: MiniGameDef = {
  id: 'darts', modId: 'naudh1r-darts', name: 'Darts', icon: '🎯',
  blurb: 'cooperative darts: the reader and one girl take turns against a shared countdown',
  format: 'The reader and one girl are teammates against the house, not opponents. They share a countdown from 301, 501 or 701. There are five visits of up to three darts: reader, partner, reader, partner, reader. Standard singles, doubles, triples, outer bull 25 and inner bull 50. Exactly zero wins for both, finishing on any scoring region. Going below zero busts the entire visit, restores its starting balance and ends the visit immediately. A positive balance after visit five loses for both. No draws or extra visits.',
  players: { min: 1, max: 1 }, locations: ['btb_arcade', 'stalestein_bar', 'pino_cola_lounge'],
  suggest: 'sometimes', suggestAt: { btb_arcade: 'often' }, surface: 'screen', keys: true,
  stepped: false,
  controls: 'Pointer or arrow keys to aim. Hold left click or Space to lock the ellipse, release at the moving dot. Change turn hands over to your teammate; My turn takes the darts back.',
  skillBrief: 'A good darts player aims accurately, repeats her throw consistently and stays composed near a checkout. A beginner scatters widely, especially under pressure. Both share the team result.',
  options: [{ id: 'darts-start', label: 'Starting score', describe: 'the shared countdown: 1 is 301, 2 is 501, 3 is 701, with five alternating visits in every case', min: 1, max: 3, default: 2, values: { 1: '301', 2: '501', 3: '701' } }]
}
export default DARTS
