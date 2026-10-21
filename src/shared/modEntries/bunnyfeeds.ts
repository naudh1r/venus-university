import type { ModDef } from '../mods'
import { BUNNYFEEDS } from '../bunnyfeeds'

const mod: ModDef = {
  id: BUNNYFEEDS,
  name: 'Bunnyfeeds',
  author: 'naudh1r',
  version: '1.1.0',
  scope: 'anytime',
  defaultOn: false,
  blurb:
    "Comment on your friends' posts on Bunnyboard. She replies in her own words, her friends and other students join the conversation, and she remembers what you said. Girls also comment on each other's posts, and Notifications under Updates lists every answer to you. Costs a little extra AI each time you close the phone after commenting; just scrolling is free.",
  options: [
    {
      id: 'announce',
      label: 'Announce feed memories',
      hint: 'Off, the closing no longer says what she made of your comments; she still remembers it.',
      default: true
    },
    // One of these is on at a time: the store turns the others off.
    {
      id: 'faces-gradient',
      label: 'Gradient',
      hint: 'Soft, blurred colour, like a photo out of focus.',
      default: true,
      group: 'faces'
    },
    {
      id: 'faces-identicon',
      label: 'Identicon',
      hint: 'A small mirrored pattern of squares.',
      default: false,
      group: 'faces'
    },
    {
      id: 'faces-shapes',
      label: 'Shapes',
      hint: 'A few overlapping shapes.',
      default: false,
      group: 'faces'
    },
    {
      id: 'faces-monogram',
      label: 'Monogram',
      hint: 'The first letter of her handle.',
      default: false,
      group: 'faces'
    },
    {
      id: 'faces-mixed',
      label: 'Mixed',
      hint: 'Each student gets one of the styles above, and keeps it.',
      default: false,
      group: 'faces'
    }
  ],
  optionGroups: [
    {
      id: 'faces',
      label: 'Faces of other students',
      hint: 'What a student who is not one of the girls shows as under posts. Each keeps the same face wherever she comments.'
    }
  ],
  offNote:
    'Off, you cannot comment and the threads under posts are hidden. Threads and what she remembered are kept, and come back when it is on again.'
}
export default mod
