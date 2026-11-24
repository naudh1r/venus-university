import { CHAT_OPTIONS, MINI_GAMES, SUGGEST_OFTEN, OFFER_TRAINING } from '../minigames'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: MINI_GAMES,
  name: 'Mini-games',
  author: 'morrowkiln',
  version: '0.2.5',
  scope: 'anytime',
  // Off until the player turns it on, as every new mod in the build ships.
  defaultOn: false,
  blurb:
    'Play a game inside a scene, alone or with the people who are there. This is the frame alone: the games come as mods of their own. In beta: to report a problem, press Copy bug report at the table or on a game’s page and paste it with what happened.',
  offNote: 'A game already played stays in the story and in the memories of whoever played.',
  options: [
    {
      id: OFFER_TRAINING,
      label: 'Offer mini-games when committing to a slot',
      hint: 'Experimental: include suitable solo games in the landing’s Improve Stats activities. Finish the selected game to train its stat. People may still be encountered at the location; joining requires their agreement. Walking away spends the slot without a completion reward.',
      default: false
    },
    {
      id: SUGGEST_OFTEN,
      label: 'People suggest games often',
      hint: 'Off: each game says how readily someone brings it up, by place.\nOn: they are keen to play any game, wherever it can be played.\nNever in a class or on a shift, either way.',
      default: false
    },
    {
      id: CHAT_OPTIONS.quiet,
      label: 'Quiet',
      hint: 'They play, and speak when you speak to them.',
      default: false,
      group: 'talk'
    },
    {
      id: CHAT_OPTIONS.some,
      label: 'Some',
      hint: 'A remark at the moments worth one.',
      default: true,
      group: 'talk'
    },
    {
      id: CHAT_OPTIONS.lots,
      label: 'Lots',
      hint: 'They have something to say about most of what happens. Games run slower.',
      default: false,
      group: 'talk'
    }
  ],
  optionGroups: [
    {
      id: 'talk',
      label: 'How much they talk during a game',
      hint: 'Each thing they say is written as it happens, and takes a moment.'
    }
  ]
}

export default def
