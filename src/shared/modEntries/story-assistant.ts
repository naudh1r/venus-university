import type { ModDef } from '@vx/modkit/shared'
import { ASSISTANT_CHOICES, ASSISTANT_POPUP, STORY_ASSISTANT } from '../storyAssistant'

const mod: ModDef = {
  id: STORY_ASSISTANT,
  name: 'Story Assistant',
  author: 'Sharp',
  version: '1.0.0',
  scope: 'anytime',
  defaultOn: false,
  blurb:
    'A friend reading over your shoulder: on your turn in a scene, they say what they make of it and offer a few ways forward to pick from. Each read is one call to your writer.',
  offNote: 'It keeps nothing in your saves, and changes nothing in the story until you send a turn.',
  options: [
    {
      id: ASSISTANT_POPUP,
      label: 'Pop up every turn',
      hint: 'Off, it reads the scene only when you open it from the rail; on, it reads every turn, one call each.',
      default: true
    },
    {
      id: ASSISTANT_CHOICES.four,
      label: 'Exactly four',
      hint: 'Four ways forward every turn.',
      default: true,
      group: 'choices'
    },
    {
      id: ASSISTANT_CHOICES.fit,
      label: 'As many as fit',
      hint: 'Up to four, as many as the scene has room for.',
      default: false,
      group: 'choices'
    }
  ],
  optionGroups: [
    { id: 'choices', label: 'Choices per turn', hint: 'How many ways forward each read offers.' }
  ]
}
export default mod
