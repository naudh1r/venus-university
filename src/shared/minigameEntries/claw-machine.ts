import type { MiniGameDef } from '../minigameKit'

const CLAW_MACHINE: MiniGameDef = {
  id: 'claw-machine',
  modId: 'morrowkiln-arcade-games',
  name: 'Claw Machine',
  calledAs: ['claw', 'crane game'],
  icon: '🧸',
  blurb:
    'a claw machine full of plush toys: the reader works the claw for a few paid goes and tries to fish a toy out, with whoever is with him watching at the glass',
  format:
    'A claw machine, played by the reader alone: a girl with him watches at the glass and does not play. He pays for a set number of goes. Each go he runs the claw across once and stops it, runs it back into the cabinet once and stops it, and it drops by itself; if both stops line up with a plush toy the claw closes on it, and whether the toy is then carried to the chute or slips out on the way depends on how easy that toy is to hold, how well centred the grab was and the machine\'s own luck. A toy that slips lands somewhere new in the pile, and a near miss can knock a toy aside. The small toys are easy to hold and the two big ones are hard; one toy lies pinned under another and cannot be taken until the one on top is gone. Before the first go a girl with him says which toy she has her eye on. There is no score and nobody to beat: he comes away with the toy she wanted, with some other toy, or with nothing. Whatever he wins is his, to keep or to give: the machine hands nothing to anyone.',
  options: [
    {
      id: 'tries',
      label: 'Goes paid for',
      describe: 'how many goes at the machine the reader pays for',
      min: 1,
      max: 5,
      default: 3
    }
  ],
  locations: ['btb_arcade'],
  suggest: 'often',
  surface: 'board',
  keys: true,
  // Alone, or with one girl beside him: she watches and picks, and never takes the stick.
  players: { min: 0, max: 1 },
  aids: [
    {
      id: 'target',
      label: 'Show what the claw would grab',
      describe: 'Lights up the toy under the claw while you steer, or nothing where it would come up empty.',
      on: true
    }
  ],
  controls:
    'Hold Right or D to run the claw across and let go to stop it, then hold Up or W to run it back into the cabinet and let go: it drops by itself. Each way moves once, and a countdown drops it if you wait. A grab off a toy\'s middle is likelier to slip.',
  stepped: false,
  skillBrief:
    'Nobody but the reader works the claw; someone good at these machines knows which toys the claw can really hold and can tell an unlucky slip from a bad grab, and someone poor at them wants the biggest toy in the cabinet.'
}

export default CLAW_MACHINE
