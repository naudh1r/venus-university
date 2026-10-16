import type { MiniGameDef } from '../minigameKit'

const DARTS: MiniGameDef = {
  id: 'darts', modId: 'naudh1r-darts', name: 'Darts', icon: '🎯',
  blurb: 'full-screen darts with one or two girls, cooperatively against the house or as 301 rivals',
  format: 'One or two girls play full-screen darts with the reader. Beat the House shares a 301, 501 or 701 countdown and rotates reader then each girl; the reader gets three visits and each girl two. Rival Match gives every player a separate 301 balance for three rounds. Each visit has up to three darts. Exactly zero checks out on any scoring region. Going below zero busts that visit and restores its opening balance. In Rival Match, the lowest balance wins if nobody checks out.',
  players: { min: 1, max: 2 }, locations: ['btb_arcade', 'stalestein_bar', 'pino_cola_lounge'],
  suggest: 'sometimes', suggestAt: { btb_arcade: 'often' }, surface: 'screen', keys: true,
  stepped: false,
  controls: 'Pointer or arrow keys to aim. Hold left click or Space to lock the ellipse, release at the moving dot. Change turn hands over to the girls; My turn takes the darts back.',
  skillBrief: 'A good darts player aims accurately, repeats her throw consistently and stays composed near a checkout. A beginner scatters widely, especially under pressure.',
  skillAxes: [
    { id: 'accuracy', label: 'natural precision', brief: 'Judge hand-eye coordination, patience and attention to detail.' },
    { id: 'consistency', label: 'repeatability', brief: 'Judge discipline, steadiness and whether her performance swings.' },
    { id: 'composure', label: 'performance under pressure', brief: 'Judge confidence, emotional control and response to stakes.' }
  ],
  options: [
    { id: 'darts-mode', label: 'Game mode', describe: 'cooperate against the house or give every player a separate 301 countdown', min: 1, max: 2, default: 1, values: { 1: 'Beat the House', 2: '301 Rival Match' } },
    { id: 'darts-start', label: 'House starting score', describe: 'the shared countdown used by Beat the House; Rival Match always starts everyone at 301', min: 1, max: 3, default: 2, values: { 1: '301', 2: '501', 3: '701' } }
  ]
}
export default DARTS
