import type { MiniGameDef } from '../minigameKit'

const DARTS: MiniGameDef = {
  trainingStat: 'body',
  trainingActivity: 'by practising darts',
  id: 'darts', modId: 'naudh1r-darts', name: 'Darts', icon: '🎯',
  calledAs: ['dart'],
  blurb: 'darts countdowns, team rivalry, leader challenges and precision duels',
  format: 'The reader can play Beat the House alone, or with one or two companions. Alone, the reader has five visits against a 301, 501 or 701 countdown. A team shares that countdown and rotates from the reader to each companion. The reader gets three visits and each companion gets two. Rival Match requires at least one companion and gives every player a separate 301 balance for three rounds. Each visit has up to three darts. Exactly zero checks out on any scoring region. Going below zero busts that visit and restores its opening balance. In Rival Match, the lowest balance wins if nobody checks out. Player vs Pair requires two companions. The first companion throws, then the second, then the reader. The companions share a balance and have twice as many darts. Each player gets three rounds, and the side with the lower balance wins if nobody checks out. Chase the Leader requires two companions. Play 3 or 9 rounds with a rotating leader. Each challenger scores 1 for matching or beating the leader, or the leader scores 1 if both fail. Precision Duel requires exactly one companion at Darts skill tier 4 or 5: five identical targets, two doubles, two triples and one bullseye, three darts per target, 1 point per exact hit. Exact Total requires exactly one companion at Darts skill tier 3 or higher: five identical total targets, three darts per target. A bust resets that visit total to 0 without refunding darts. A successful finish beats a failure and fewer used darts wins each target. Equal successful finishes share 1 point. Most points wins these challenge modes. Tied highest totals share the win. These are engine-enforced requirements, never promise a locked mode or change NPC skill to unlock it.',
  players: { min: 0, max: 2 }, locations: ['btb_arcade', 'stalestein_bar', 'pino_cola_lounge'],
  suggest: 'sometimes', suggestAt: { btb_arcade: 'often' }, surface: 'screen',
  stepped: false,
  resultBrief: [
    'AFTER DARTS: The final dart has already landed, the score has already settled, and the player has already watched the result animation. Begin AFTER that moment. Do not describe a dart flying or landing, points being counted down, or a victory animation or fanfare starting again.',
    'For this result turn, your FIRST line opens in the aftermath: let the participants react to the settled outcome, their shared experience or rivalry, and any agreed stake. This takes precedence over the usual instruction to reword the reader’s action in the opening line. They may recall a memorable hit. Do not stage it happening again.'
  ],
  controls: 'Move the mouse to aim. Hold left click to lock the ellipse, then release at the moving dot. In solo play, Next round starts your next three darts. Change turn hands the darts to your companions. My turn takes them back.',
  skillBrief: 'A good darts player aims accurately, repeats their throw consistently and stays composed near a checkout. A beginner scatters widely, especially under pressure.',
  skillAxes: [
    { id: 'accuracy', label: 'natural precision', brief: 'Judge hand-eye coordination, patience and attention to detail.' },
    { id: 'consistency', label: 'repeatability', brief: 'Judge discipline, steadiness and whether their performance swings.' },
    { id: 'composure', label: 'performance under pressure', brief: 'Judge confidence, emotional control and response to stakes.' }
  ],
  options: [
    { id: 'darts-mode', label: 'Game mode', describe: '1 solo/co-op. 2 individual rivals. 3 pair team (two companions). 4 leader (two companions). 5 precision (one companion, tier 4+). 6 exact total (one companion, tier 3+)', min: 1, max: 6, default: 1, values: { 1: 'Beat the House', 2: '301 Rival Match', 3: 'Player vs Pair', 4: 'Chase the Leader', 5: 'Precision Duel', 6: 'Exact Total' } },
    { id: 'darts-start', label: 'House starting score', describe: 'Starting countdown for Beat the House and Player vs Pair. Individual Rival Match stays at 301.', min: 1, max: 3, default: 2, values: { 1: '301', 2: '501', 3: '701' } },
    { id: 'darts-leader-length', label: 'Chase the Leader length', describe: 'Only used for Chase the Leader. Everyone leads equally often.', min: 1, max: 2, default: 1, values: { 1: 'Quick: 3 rounds', 2: 'Full: 9 rounds' } }
  ]
}
export default DARTS
