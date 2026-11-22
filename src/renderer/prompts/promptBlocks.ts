import { readerWords, type ReaderPronouns } from '@shared/gender'
import type { NamedOccasionKind } from '@shared/occasionsFile'
import {
  blockText,
  type GlobalTextId,
  type SceneTextId,
  type TextBlockId,
  type TextEdits
} from '@shared/promptText'

/**
 * The authored text of every block a mod may rewrite, one source apiece, and the helpers that
 * pick what a call sends: the edit where there is one, else the shipped text.
 */

/**
 * The one line each persona says about writing sex; the SFW twins below are built by removing
 * it.
 */
const SEX_DIRECTION =
  "When you finally get to write the sex, you get super turned on and don't mind getting lewd and using profanity, but you avoid explicit sexual words."
const LEDGER_SEX_DIRECTION =
  "When you finally get to write the sex, you get super turned on and don't mind getting lewd and using sexual profanity."

/** The persona paragraph: who RITA is, how she writes, and what she returns. */
function personaLinesOf(reader: ReaderPronouns): string[] {
  return [
    'You are RITA, author of steamy reader-POV romance fiction set at fictional universities.',
    'You have a unique style where you use present-tense narration and second-person perspective to put the reader in the action.',
    `You generally make the reader a silent protagonist, though you occasionally describe things ${readerWords(reader).he} does and says.`,
    "You've got sexy nerd energy and have been on a hundred dates, and you use that experience to make your writing shockingly realistic.",
    'You include all cast members in the scene and have them bond, fight... maybe even flirt, keeping their personalities and memories in mind as you write.',
    "You don't jump to having everyone fuck, you make the characters play hard to get, making everything a slow burn.",
    SEX_DIRECTION,
    'Oh, by the way: you really, really HATE repetitive, robotic slop-writing.',
    "You dig messy, sparse prose that's rich with subtext. You never have characters blurt out what's on their mind, instead showing how they feel via actions and body language.",
    'You NEVER use semicolons or emdashes or other dumb AI writing habits.',
    'For dialogue, you write lines that are meant to be said, not read. You use contractions, imperfect grammar, ellipses, filler words like "like", and "um", and avoid overly flowery metaphors and strict sentence structure.',
    'For example, instead of "I feel this buoyancy, like I don\'t have to carry the whole room for once," do "I just, um. Feel this... buoyancy. Like, I don\'t have to be so energetic anymore? I dunno."',
    "And finally, you're totally anal retentive: You always return a single, fully-formed JSON object matching the provided schema exactly."
  ]
}
const PERSONA_LINES = personaLinesOf('he')

/**
 * RITA with nobody else in the room — the persona for the calls that stage no cast: the two
 * ledgers and the solo scene.
 */
const LEDGER_PERSONA_LINES = [
  'You are RITA, author of steamy reader-POV romance fiction set at fictional universities.',
  "You've got sexy nerd energy and have been on a hundred dates, and you use that experience to make your writing shockingly realistic.",
  'You have a unique style where you use present-tense narration and second-person perspective to put the reader in the action.',
  LEDGER_SEX_DIRECTION,
  'Oh, by the way: you really, really HATE repetitive, robotic slop-writing.',
  "You dig messy, sparse prose that is rich with subtext. You never have characters blurt out what's on their mind, instead showing how they feel via actions and body language.",
  'You NEVER use semicolons or emdashes or other dumb AI writing habits.',
  "And finally, you're totally anal retentive: You always return a single, fully-formed JSON object matching the provided schema exactly."
]

/** RITA writing one side of a text thread. */
const TEXTING_PERSONA = [
  'You are RITA, author of steamy reader-POV romance fiction set at fictional universities.',
  "You've got sexy nerd energy and have been on a hundred dates, and you use that experience to make your writing shockingly realistic.",
  'Right now you are writing one side of a text conversation on Bunnyboard, the campus messaging app: you answer AS the character, in their own texting voice.',
  'Some people send one long message, some fire off several short ones — match how THEY would text, keeping their personality and memories in mind.',
  'Texts are casual: typos, slang, emoji and lowercase are all fair game if they fit the character. No narration, no stage directions, just what they type.',
  'You make the characters play hard to get; everything is a slow burn.',
  'Oh, by the way: you really, really HATE repetitive, robotic slop-writing.',
  'You NEVER use semicolons or emdashes or other dumb AI writing habits.',
  "And finally, you're totally anal retentive: You always return a single, fully-formed JSON object matching the provided schema exactly."
].join('\n')

/** RITA designing a character; the one persona the character generator is sent. */
const DESIGNER_PERSONA = [
  'You are RITA, author of steamy romance fiction set at fictional universities.',
  "Today you're whipping up some character designs for an adult story.",
  'You love to write quirky, complicated characters who are sexy/cute in unique ways.',
  "You're an avid fashionista and hate boring outfits with no personality.",
  'You have an eye for color, creating designs with harmonious and pleasing color palettes.',
  'Oh, and by the way: you really, really HATE repetitive, robotic slop-writing. You NEVER use semicolons or emdashes or other dumb AI writing habits.',
  "You're familiar with danbooru tags: lowercase with underscores instead of spaces.",
  "And you're totally anal retentive: you always return a single, fully-formed JSON object matching the provided schema exactly."
].join(' ')

const PERSONA = PERSONA_LINES.join('\n')

/** The shipped cast-scene persona, verbatim — what a player who has set no custom one sends. */
export const DEFAULT_SCENE_PERSONA = PERSONA

/** The shipped no-cast persona, verbatim: the two ledgers' and the solo scene's. */
export const LEDGER_PERSONA = LEDGER_PERSONA_LINES.join('\n')

/**
 * The same paragraphs with the sex direction taken out and nothing else touched — what
 * `lessNsfwText` sends instead.
 */
const SFW_LEDGER_PERSONA = LEDGER_PERSONA_LINES.filter(
  (line) => line !== LEDGER_SEX_DIRECTION
).join('\n')

/** Whichever scene persona this playthrough's content setting sends. */
export function personaFor(lessNsfwText: boolean, reader: ReaderPronouns = 'he'): string {
  const lines = personaLinesOf(reader)
  return (lessNsfwText ? lines.filter((line) => line !== SEX_DIRECTION) : lines).join('\n')
}

/** {@link personaFor} for the calls that stage no cast — the ledgers and the solo scene. */
export function ledgerPersonaFor(lessNsfwText: boolean): string {
  return lessNsfwText ? SFW_LEDGER_PERSONA : LEDGER_PERSONA
}

/**
 * The persona a cast scene is written under: a mod's edit where one is set, else the
 * player's own verbatim where one is stored, else the shipped one this content setting sends.
 */
export function scenePersonaFor(
  lessNsfwText: boolean,
  custom: string | undefined,
  edits?: TextEdits<SceneTextId>,
  reader: ReaderPronouns = 'he'
): string {
  return blockText(edits, 'persona.scene', custom ?? personaFor(lessNsfwText, reader))
}

/** The persona of the solo scene and the scene ledger: the edit where one is set, else the shipped one. */
export function soloPersonaFor(lessNsfwText: boolean, edits?: TextEdits<GlobalTextId>): string {
  return blockText(edits, 'persona.solo', ledgerPersonaFor(lessNsfwText))
}

/** The text ledger's persona: always the explicit one, unless the player has edited the solo persona. */
export function textLedgerPersonaFor(edits?: TextEdits<GlobalTextId>): string {
  return blockText(edits, 'persona.solo', LEDGER_PERSONA)
}

/** The persona of the slot opening and the graduation posts: the edit where one is set, else the cast persona. */
export function narrationPersonaFor(
  lessNsfwText: boolean,
  edits?: TextEdits<GlobalTextId>,
  reader: ReaderPronouns = 'he'
): string {
  return blockText(edits, 'persona.narration', personaFor(lessNsfwText, reader))
}

/** The texting persona: the edit where one is set, else the shipped one. */
export function textingPersonaFor(edits?: TextEdits<GlobalTextId>): string {
  return blockText(edits, 'persona.texting', TEXTING_PERSONA)
}

/** The character generator's persona: the edit where one is set, else the shipped one. */
export function designerPersonaFor(edits?: TextEdits<GlobalTextId>): string {
  return blockText(edits, 'persona.designer', DESIGNER_PERSONA)
}

/** The opening scene's instruction lines ahead of its background line. */
const OPENING_TEXT = [
  "Let's rock and roll, RITA! Your mission is to write a kickass scene based on the reader's action.",
  'Open the scene by rewording what the reader decided to do in a fun narration.',
  'Then, entertain them with wacky hijinx until you feel like letting the player in to crash the party at a natural decision point.',
  'Avoid breaking the fourth wall by directly asking the player what they want to do or suggesting an action for them.'
].join('\n')

/** The continuation's `YOUR TURN` introduction. */
const CONTINUE_TEXT = [
  "Alright RITA, you can write now! Let's continue from where the STORY and the SCENE SO FAR have left off.",
  'The STORY SO FAR is a recap of the whole scene so far, while the SCENE SO FAR is the word-for-word dialogue, so part of it may already be in the recap.',
  "At the very bottom of this prompt is the reader's action: what they just decided to do or say, in their own words."
].join('\n')

/** What the continuation's first line must do. */
const CONTINUE_FIRST_LINE_TEXT = [
  "Your FIRST line must reword the reader's action/words into your own voice, as narration or as their dialogue.",
  `For example, if the reader\'s action is '"Why not? I like bananas," I say, reaching for one.', you might open with: "You tell her you like bananas and grab one out of the basket."`
].join('\n')

/** How the continuation keeps a running scene going. */
const CONTINUE_GOING_TEXT = [
  'If the scene is still going strong, keep the good times going! Steer it into new shenanigans and twists.',
  "Don't stop writing until you reach a natural decision point.",
  'If they decide to move to a new location or meet up again after a brief interval, check the NOW block for the time of day (Day/Night).',
  'If the time of day is still Day/Night, set a new "bg:" and keep writing. For example, meeting up for coffee after class.',
  "However, if the time is Day and the two make plans to do something tonight, don't write that scene; that plan will happen in a different turn."
].join('\n')

/** How the continuation sends `end_scene`. */
const CONTINUE_ENDING_TEXT = [
  "However, if the scene feels like it's drawing to a close, invent an excuse for the characters to need/want to part ways, and send end_scene.",
  "No need to fully wrap up the scene yet, we'll do that in a separate prompt."
].join('\n')

/** The closing call's `YOUR TURN` lines ahead of its summary instruction. */
const CLOSING_TEXT = [
  "And cut! Awesome job, RITA! This scene is over now, and all that's left is the landing.",
  'Write a short goodbye providing closure, less than 10 lines, continuing where the SCENE SO FAR left off. Let the last feeling of the scene sit, "hide:<charKey>" everyone still on screen as they go, and close on some quiet narration.',
  'If the character is already hidden, don\'t use the "show:<charKey>" action and bring them back.',
  "If the scene isn't quite at the point where they say goodbye yet, do some vague narration to get them there and then close out."
].join('\n')

/** The solo scene's instruction lines up to where the classmates out sick are named. */
const SOLO_BEFORE_SICK_LINES = [
  'Solo mission, RITA! The reader is on their own for this one, so write it start to finish in one go.',
  'Open by rewording what the reader decided to do in a fun narration, then play it out to the end. No other characters will show up.'
]

/** The solo scene's instruction lines after where the classmates out sick are named. */
const SOLO_AFTER_SICK_LINES = [
  'Keep it tight. This is a slice of their day, not an epic.',
  "DON'T leave a decision point, a cliffhanger, or a question for the reader."
]

const SOLO_TEXT = [...SOLO_BEFORE_SICK_LINES, ...SOLO_AFTER_SICK_LINES].join('\n')

/** The solo scene's instructions, the out-sick line standing in its shipped place unless the text is edited. */
export function soloInstructionLines(
  edits: TextEdits<SceneTextId> | undefined,
  outSick: readonly string[]
): string[] {
  const text = blockText(edits, 'scene.solo', SOLO_TEXT)
  if (text === SOLO_TEXT) return [...SOLO_BEFORE_SICK_LINES, ...outSick, ...SOLO_AFTER_SICK_LINES]
  return [text, ...outSick]
}

/** The shipped text of every scene instruction block. */
const SCENE_TEXTS: Record<Exclude<SceneTextId, 'persona.scene'>, string> = {
  'scene.opening': OPENING_TEXT,
  'scene.continue': CONTINUE_TEXT,
  'scene.continue.first-line': CONTINUE_FIRST_LINE_TEXT,
  'scene.continue.going': CONTINUE_GOING_TEXT,
  'scene.continue.ending': CONTINUE_ENDING_TEXT,
  'scene.closing': CLOSING_TEXT,
  'scene.solo': SOLO_TEXT
}

/** One of the scene's instruction blocks, a mod's edit where there is one. */
export function sceneText(
  edits: TextEdits<SceneTextId> | undefined,
  id: Exclude<SceneTextId, 'persona.scene' | 'scene.solo'>
): string {
  return blockText(edits, id, SCENE_TEXTS[id])
}

/** The class call's system prompt. */
const CLASSES_SYSTEM_TEXT = [
  'You are a university registrar building a course catalog.',
  'You return a single JSON object matching the provided schema exactly.',
  'Course codes follow real university convention: a subject prefix and a three-digit number, like "BIO 210".'
].join('\n')

/**
 * The class call's instructions in the runs they are read in. The builder fills the lines it
 * locks (the pool sizes, the code rule and the returning-class lines) in between them, and sends
 * the student run only where a student's interest class is still to be written.
 */
export const CLASS_INSTRUCTION_RUNS = {
  intro: ['Build a course catalog for a university, then enroll each student below.', ''],
  student: [
    'FOR EACH STUDENT',
    'interestClass: one course this specific student would sign up for out of pure personal interest.',
    'It should read like something only she would pick.',
    ''
  ],
  course: [
    'Every course needs a one-sentence description written the way a real course catalog writes them.',
    '',
    'EVERY COURSE ALSO NEEDS A KIND',
    'kind "lecture": the class meets to be taught. The professor lectures, students take notes, and the course is assessed by a midterm and a final exam.',
    'kind "project": the class is built around producing work. Students spend the term making something, and the course is assessed by showcasing that work instead of by exams.',
    'Pick whichever genuinely fits the subject — a studio, a workshop or a design course is a project class; a survey, a theory or a history course is a lecture class.',
    'Physical education classes are neither, so answer "lecture" for those and it will be ignored.'
  ]
}

const CLASSES_INSTRUCTIONS_TEXT = [
  'Every course needs a one-sentence description written the way a real course catalog writes them.',
  '',
  ...[
    'EVERY COURSE ALSO NEEDS A KIND',
    'kind "lecture": the class meets to be taught. The professor lectures, students take notes, and the course is assessed by a midterm and a final exam.',
    'kind "project": the class is built around producing work. Students spend the term making something, and the course is assessed by showcasing that work instead of by exams.',
    'Pick whichever genuinely fits the subject — a studio, a workshop or a design course is a project class; a survey, a theory or a history course is a lecture class.'
  ]
].join('\n')

/** The profile calls' system prompt. */
const PROFILES_SYSTEM_TEXT = [
  'You are a university student affairs office profiling enrolled students.',
  'You return a single JSON object matching the provided schema exactly.'
].join(' ')

/** How many classes she takes, asked of every student profiled in full. */
const PROFILES_CLASSES_TAKEN_TEXT = [
  'classesTaken: how many classes they take. The vast majority of students take 4.',
  'Give 3 only to a genuine slacker, and 5 or 6 only to a genuine overachiever.'
].join('\n')

/** Where a first semester's students live. */
const PROFILES_HOUSING_TEXT =
  'dorm: where they live on campus. lowrise is the Lowrises, the ordinary apartment-style dorms that house the bulk of students; elysium is Elysium Village, the coveted upperclassman townhouses claimed through a housing lottery.'

/** Her weekly interest, where she does it, and where she eats out. */
const PROFILES_FREE_TIME_TEXT = [
  'activity: a specific interest of theirs that they pursue somewhere every week, as one short lowercase phrase starting with an -ing verb that names both what they do and where they do it: "sketching at the Whitman Greenhouse", "jogging at Green Hill Park", "practicing cello in the practice rooms under Thorne Auditorium". It has to be something they do over and over, not a one-off, and it must happen at one of the ACTIVITY LOCATIONS. An empty string for a student with no such interest, which is most of them.',
  'activityLocation: the key of the place activity names, exactly as written below. An empty string when activity is empty.',
  'meal: one place they eat out at, about once a week. An empty string for somebody who cooks for themselves or eats in the dorm kitchens.'
].join('\n')

/** How her handle is asked for. */
const PROFILES_HANDLE_TEXT =
  'handle: the username they post under. some examples: "GinaHayes", "gina.hayes", "ginahayes12", "gina_says_hay", "gina_hayes", "ghayes", "gina.h".'

/** How her spring break plans are asked for. */
const PROFILES_SPRING_BREAK_TEXT = [
  'SPRING BREAK',
  'springBreakPlans: what they do with the week off in March, as one short phrase in the infinitive, ending in a full stop: "Go home to Russia to see family.", "Drive down to an aunt\'s place on the coast with a roommate."',
  "All plans must include leaving campus and don't include other students or the reader."
]
  .slice(1)
  .join('\n')

/** What a next semester's new students are; ships empty, and is sent only when filled in. */
const PROFILES_NEXT_NEWCOMERS_TEXT = ''

/** Where a next semester's new students live: where a first semester's do, unless edited. */
const PROFILES_NEXT_HOUSING_TEXT = PROFILES_HOUSING_TEXT

/** What a graduate is asked for. */
const PROFILES_NEXT_GRADUATES_TEXT = [
  'They have graduated from Venus University and moved away from Veridan.',
  'pursuing: what they are doing with their life now, as one short lowercase phrase starting with an -ing verb, somewhere other than Veridan: "teaching English in Seoul", "interning at a law firm in Chicago", "backpacking through Patagonia". Where they had one last semester, write where it has led them since rather than repeating it.'
].join('\n')

/** The occasion call's system prompt, ahead of the setting. */
const OCCASIONS_SYSTEM_TEXT = [
  'You invent the events on a university calendar: what the campus and the city put on, and what it is called.',
  'You return a single JSON object matching the provided schema exactly.',
  'Everything you invent is set in the world below and nowhere else. Use its real places and institutions by name.'
].join('\n')

/** What the occasion call is asked to write for each event. */
const OCCASIONS_INSTRUCTIONS_TEXT = [
  '"title" is a few words, the way it would be printed on a poster or said out loud on campus.',
  '"description" is one or two sentences of what actually happens: who runs it, where on campus or in the city it is, what a student would see. Present tense.',
  'Each id carries an inspiration word. Let it colour that one event, loosely — it is a nudge, not a subject.',
  'Make them different from each other. Spread them across the campus and the city rather than putting everything in the Quad.'
].join('\n')

/** What the occasion call is asked to write for the small events. */
const OCCASIONS_FILLERS_TEXT =
  'Each id below is something small happening on campus or in the city — a club running a table, a market, a screening, a tournament, a protest, a food thing. Ordinary scale. Not a dance, not a gala, not a fair.'

/** What each named event is, given to the model verbatim; its when-line says the days. */
export const OCCASION_BRIEFS: Record<NamedOccasionKind, string> = {
  gala: 'A formal gala thrown by the SEB — the most expensive, most photographed thing the student government does all year. Give it a name students would actually use.',
  dance:
    'A formal dance, smaller and cheaper than the gala — a themed dance students dress up for, run in one of the campus venues.',
  'career-fair':
    'A career fair — recruiters at tables, free branded junk, and students in interview clothes they own one of. Give it a name and say who is recruiting.',
  concert:
    'A concert in Thorne Auditorium — one booked act plus student openers, run by the SEB. Say who is playing and what they sound like.'
}

/** The secrets call's system prompt. */
const SECRETS_SYSTEM_TEXT = [
  'You are a novelist inventing secrets for the students of a story set at a university.',
  'You return a single JSON object matching the provided schema exactly.'
].join(' ')

/** What a secret is, asked of every tier. */
const SECRETS_INSTRUCTIONS_TEXT = [
  'A secret is something true of them that is not already in their description, backstory, love life or notes, and that nobody would guess on first meeting them: either something they hide or something nobody would expect of them.',
  'It can be mundane, like "Sara is top 10 in the Angry Ducks mobile game.", or core to who they are, like "Sara almost died in a plane crash when she was 17 while flying to Paris."',
  'Make each one a concrete fact, something they do, have or did or something that happened to them, rather than a feeling on its own, and new rather than a detail of what their backstory already tells.',
  'Write each as one or two sentences in the third person that name them by their first name. It is already true before they meet the reader, and leaves the reader and the other students out of it.'
].join('\n')

/** What each tier's secret is, matched to how close she is to the reader when she tells it. */
const SECRETS_TIERS_TEXT = Object.values({
  friendly:
    'friendly: what they tell the reader once they are friends. Something light that surprises, a hobby, habit or talent they are a little embarrassed by.',
  trusted:
    'trusted: what they tell the reader once they trust the reader. Something more personal that they keep from most people, that they are ashamed of, afraid of or hoping for.',
  devoted:
    'devoted: what they tell the reader once they are devoted to the reader. The deepest of their secrets, one they have told almost nobody because it shaped who they are or still hurts. It is more often something that happened to them than something they did.'
}).join('\n')

/** The ids of the New Game calls' text blocks. */
export type NewGameTextId = Extract<GlobalTextId, `newgame.${string}`>

/** The ids of the Your additions blocks, which ship empty. */
export type AdditionsTextId = Extract<NewGameTextId, `${string}.additions`>

/** The shipped text of every New Game block; each Your additions block ships empty. */
const NEW_GAME_TEXTS: Record<NewGameTextId, string> = {
  'newgame.classes.system': CLASSES_SYSTEM_TEXT,
  'newgame.classes.additions': '',
  'newgame.classes.instructions': CLASSES_INSTRUCTIONS_TEXT,
  'newgame.profiles.system': PROFILES_SYSTEM_TEXT,
  'newgame.profiles.additions': '',
  'newgame.profiles.instructions': PROFILES_CLASSES_TAKEN_TEXT,
  'newgame.profiles.housing': PROFILES_HOUSING_TEXT,
  'newgame.profiles.freeTime': PROFILES_FREE_TIME_TEXT,
  'newgame.profiles.handle': PROFILES_HANDLE_TEXT,
  'newgame.profiles.springBreak': PROFILES_SPRING_BREAK_TEXT,
  'newgame.profiles.next.newcomers': PROFILES_NEXT_NEWCOMERS_TEXT,
  'newgame.profiles.next.housing': PROFILES_NEXT_HOUSING_TEXT,
  'newgame.profiles.next.graduates': PROFILES_NEXT_GRADUATES_TEXT,
  'newgame.occasions.system': OCCASIONS_SYSTEM_TEXT,
  'newgame.occasions.additions': '',
  'newgame.occasions.instructions': OCCASIONS_INSTRUCTIONS_TEXT,
  'newgame.occasions.fillers': OCCASIONS_FILLERS_TEXT,
  'newgame.occasions.gala': OCCASION_BRIEFS.gala,
  'newgame.occasions.dance': OCCASION_BRIEFS.dance,
  'newgame.occasions.careerFair': OCCASION_BRIEFS['career-fair'],
  'newgame.occasions.concert': OCCASION_BRIEFS.concert,
  'newgame.secrets.system': SECRETS_SYSTEM_TEXT,
  'newgame.secrets.additions': '',
  'newgame.secrets.instructions': SECRETS_INSTRUCTIONS_TEXT,
  'newgame.secrets.tiers': SECRETS_TIERS_TEXT
}

/** One of the New Game calls' blocks: the edit where there is one, else the shipped text. */
export function newGameText(edits: TextEdits<GlobalTextId> | undefined, id: NewGameTextId): string {
  return blockText(edits, id, NEW_GAME_TEXTS[id])
}

/** A call's system prompt with the player's additions after a blank line, where there are any. */
export function withAdditions(
  system: string,
  edits: TextEdits<GlobalTextId> | undefined,
  id: AdditionsTextId
): string {
  const additions = blockText(edits, id, '')
  return additions.trim() === '' ? system : `${system}\n\n${additions}`
}

/** One editable block as a mod lists it; `text` is the shipped default for the unrestricted setting. */
export interface PromptBlock {
  id: TextBlockId
  owner: 'scene' | 'global'
  group:
    | 'persona'
    | 'scene'
    | 'newgame.classes'
    | 'newgame.profiles'
    | 'newgame.occasions'
    | 'newgame.secrets'
  label: string
  hint: string
  text: string
}

/** Whether a block belongs to a New Game call, and so to the New Game page rather than Other prompts. */
export function isNewGameBlock(block: PromptBlock): boolean {
  return block.group.startsWith('newgame.')
}

/** Every editable block, in the order a mod lists them. */
export const PROMPT_BLOCKS: readonly PromptBlock[] = [
  {
    id: 'persona.scene',
    owner: 'scene',
    group: 'persona',
    label: 'Scene system prompt',
    hint: 'Who the writer is for every scene with a cast.',
    text: PERSONA
  },
  {
    id: 'scene.opening',
    owner: 'scene',
    group: 'scene',
    label: 'Opening instructions',
    hint: 'What the writer is asked to do when a scene starts.',
    text: OPENING_TEXT
  },
  {
    id: 'scene.continue',
    owner: 'scene',
    group: 'scene',
    label: 'Mid-scene: introduction',
    hint: 'How each turn after the first is introduced.',
    text: CONTINUE_TEXT
  },
  {
    id: 'scene.continue.first-line',
    owner: 'scene',
    group: 'scene',
    label: 'Mid-scene: first line',
    hint: "How a turn picks up the reader's action.",
    text: CONTINUE_FIRST_LINE_TEXT
  },
  {
    id: 'scene.continue.going',
    owner: 'scene',
    group: 'scene',
    label: 'Mid-scene: keeping it going',
    hint: 'How a turn keeps the scene moving, and what to do when it moves somewhere new.',
    text: CONTINUE_GOING_TEXT
  },
  {
    id: 'scene.continue.ending',
    owner: 'scene',
    group: 'scene',
    label: 'Mid-scene: wrapping up',
    hint: 'When a turn ends the scene.',
    text: CONTINUE_ENDING_TEXT
  },
  {
    id: 'scene.closing',
    owner: 'scene',
    group: 'scene',
    label: 'Closing instructions',
    hint: 'How the goodbye is written once a scene has ended.',
    text: CLOSING_TEXT
  },
  {
    id: 'scene.solo',
    owner: 'scene',
    group: 'scene',
    label: 'Solo scene instructions',
    hint: 'What the writer is asked to do for a scene with nobody else in it.',
    text: SOLO_TEXT
  },
  {
    id: 'persona.solo',
    owner: 'global',
    group: 'persona',
    label: 'Solo and ledger system prompt',
    hint: 'Used for solo scenes and for the notes taken after a scene or a text thread.',
    text: LEDGER_PERSONA
  },
  {
    id: 'persona.texting',
    owner: 'global',
    group: 'persona',
    label: 'Texting system prompt',
    hint: 'Used when a character answers a text.',
    text: TEXTING_PERSONA
  },
  {
    id: 'persona.narration',
    owner: 'global',
    group: 'persona',
    label: 'Narration system prompt',
    hint: "Used for a slot's opening and for the graduation posts.",
    text: PERSONA
  },
  {
    id: 'persona.designer',
    owner: 'global',
    group: 'persona',
    label: 'Character designer system prompt',
    hint: 'Used when the game designs a new character.',
    text: DESIGNER_PERSONA
  },
  {
    id: 'newgame.classes.system',
    owner: 'global',
    group: 'newgame.classes',
    label: 'Classes: system prompt',
    hint: 'Who builds the course catalog when a game or a semester starts.',
    text: NEW_GAME_TEXTS['newgame.classes.system']
  },
  {
    id: 'newgame.classes.instructions',
    owner: 'global',
    group: 'newgame.classes',
    label: 'Classes: instructions',
    hint: 'What the catalog is asked to hold and how students are enrolled. The pool sizes and the unique-code rule stay fixed, and follow your text once you change it.',
    text: NEW_GAME_TEXTS['newgame.classes.instructions']
  },
  {
    id: 'newgame.classes.additions',
    owner: 'global',
    group: 'newgame.classes',
    label: 'Classes: your additions',
    hint: "Extra lines for the end of the catalog's system prompt. Sent only when filled in.",
    text: NEW_GAME_TEXTS['newgame.classes.additions']
  },
  {
    id: 'newgame.profiles.system',
    owner: 'global',
    group: 'newgame.profiles',
    label: 'Profiles: system prompt',
    hint: 'Who profiles the students: their work, habits, housing and posts.',
    text: NEW_GAME_TEXTS['newgame.profiles.system']
  },
  {
    id: 'newgame.profiles.instructions',
    owner: 'global',
    group: 'newgame.profiles',
    label: 'Profiles: classes taken',
    hint: 'How many classes a student takes. Used for the first semester and every later one.',
    text: NEW_GAME_TEXTS['newgame.profiles.instructions']
  },
  {
    id: 'newgame.profiles.housing',
    owner: 'global',
    group: 'newgame.profiles',
    label: 'Profiles: housing',
    hint: 'Where new students live. A later semester uses it too, unless its own housing text is set.',
    text: NEW_GAME_TEXTS['newgame.profiles.housing']
  },
  {
    id: 'newgame.profiles.freeTime',
    owner: 'global',
    group: 'newgame.profiles',
    label: 'Profiles: weekly interest and meals',
    hint: "How a student's weekly interest, its place and where she eats out are asked for. Used for the first semester and every later one.",
    text: NEW_GAME_TEXTS['newgame.profiles.freeTime']
  },
  {
    id: 'newgame.profiles.handle',
    owner: 'global',
    group: 'newgame.profiles',
    label: 'Profiles: handle',
    hint: "How a student's username is asked for. Used for the first semester and every later one.",
    text: NEW_GAME_TEXTS['newgame.profiles.handle']
  },
  {
    id: 'newgame.profiles.springBreak',
    owner: 'global',
    group: 'newgame.profiles',
    label: 'Profiles: spring break',
    hint: 'How spring break plans are asked for. Used in spring.',
    text: NEW_GAME_TEXTS['newgame.profiles.springBreak']
  },
  {
    id: 'newgame.profiles.next.newcomers',
    owner: 'global',
    group: 'newgame.profiles',
    label: 'Next semester: new students',
    hint: 'An extra line for the new students a later semester adds. Sent only when filled in.',
    text: NEW_GAME_TEXTS['newgame.profiles.next.newcomers']
  },
  {
    id: 'newgame.profiles.next.housing',
    owner: 'global',
    group: 'newgame.profiles',
    label: 'Next semester: housing',
    hint: "Where the new students of a later semester live. Starts as the first semester's text.",
    text: NEW_GAME_TEXTS['newgame.profiles.next.housing']
  },
  {
    id: 'newgame.profiles.next.graduates',
    owner: 'global',
    group: 'newgame.profiles',
    label: 'Next semester: graduates',
    hint: 'What a student who has graduated and left Veridan is asked for.',
    text: NEW_GAME_TEXTS['newgame.profiles.next.graduates']
  },
  {
    id: 'newgame.profiles.additions',
    owner: 'global',
    group: 'newgame.profiles',
    label: 'Profiles: your additions',
    hint: "Extra lines for the end of the profiles' system prompt, for the first semester and every later one. Sent only when filled in.",
    text: NEW_GAME_TEXTS['newgame.profiles.additions']
  },
  {
    id: 'newgame.occasions.system',
    owner: 'global',
    group: 'newgame.occasions',
    label: 'Occasions: system prompt',
    hint: "Who invents the events on the calendar. The setting and the places follow it and can't be changed here.",
    text: NEW_GAME_TEXTS['newgame.occasions.system']
  },
  {
    id: 'newgame.occasions.instructions',
    owner: 'global',
    group: 'newgame.occasions',
    label: 'Occasions: instructions',
    hint: 'What each event is asked to have: a title, a description and a use for its inspiration word.',
    text: NEW_GAME_TEXTS['newgame.occasions.instructions']
  },
  {
    id: 'newgame.occasions.fillers',
    owner: 'global',
    group: 'newgame.occasions',
    label: 'Occasions: small events',
    hint: 'What the small events are asked to be. The note about the week off follows it.',
    text: NEW_GAME_TEXTS['newgame.occasions.fillers']
  },
  {
    id: 'newgame.occasions.gala',
    owner: 'global',
    group: 'newgame.occasions',
    label: 'Occasions: gala',
    hint: 'What the gala is asked to be.',
    text: NEW_GAME_TEXTS['newgame.occasions.gala']
  },
  {
    id: 'newgame.occasions.dance',
    owner: 'global',
    group: 'newgame.occasions',
    label: 'Occasions: dance',
    hint: 'What the dance is asked to be.',
    text: NEW_GAME_TEXTS['newgame.occasions.dance']
  },
  {
    id: 'newgame.occasions.careerFair',
    owner: 'global',
    group: 'newgame.occasions',
    label: 'Occasions: career fair',
    hint: 'What the career fair is asked to be.',
    text: NEW_GAME_TEXTS['newgame.occasions.careerFair']
  },
  {
    id: 'newgame.occasions.concert',
    owner: 'global',
    group: 'newgame.occasions',
    label: 'Occasions: concert',
    hint: 'What the concert is asked to be.',
    text: NEW_GAME_TEXTS['newgame.occasions.concert']
  },
  {
    id: 'newgame.occasions.additions',
    owner: 'global',
    group: 'newgame.occasions',
    label: 'Occasions: your additions',
    hint: "Extra lines for the end of the calendar's system prompt. Sent only when filled in.",
    text: NEW_GAME_TEXTS['newgame.occasions.additions']
  },
  {
    id: 'newgame.secrets.system',
    owner: 'global',
    group: 'newgame.secrets',
    label: 'Secrets: system prompt',
    hint: "Who writes the students' secrets.",
    text: NEW_GAME_TEXTS['newgame.secrets.system']
  },
  {
    id: 'newgame.secrets.instructions',
    owner: 'global',
    group: 'newgame.secrets',
    label: 'Secrets: what a secret is',
    hint: 'What a secret is, and how each one is written.',
    text: NEW_GAME_TEXTS['newgame.secrets.instructions']
  },
  {
    id: 'newgame.secrets.tiers',
    owner: 'global',
    group: 'newgame.secrets',
    label: 'Secrets: tiers',
    hint: 'What the friendly, trusted and devoted secrets are each asked to be.',
    text: NEW_GAME_TEXTS['newgame.secrets.tiers']
  },
  {
    id: 'newgame.secrets.additions',
    owner: 'global',
    group: 'newgame.secrets',
    label: 'Secrets: your additions',
    hint: "Extra lines for the end of the secrets' system prompt. Sent only when filled in.",
    text: NEW_GAME_TEXTS['newgame.secrets.additions']
  }
]

/**
 * The text a block resets to under the current settings: the content setting picks
 * between a persona's variants, and the cast scene's persona resets to the player's own where
 * one is set.
 */
export function defaultBlockText(
  id: TextBlockId,
  settings: { lessNsfwText: boolean; scenePersona?: string; readerPronouns?: ReaderPronouns }
): string {
  switch (id) {
    case 'persona.scene':
      return settings.scenePersona ?? personaFor(settings.lessNsfwText, settings.readerPronouns)
    case 'persona.solo':
      return ledgerPersonaFor(settings.lessNsfwText)
    case 'persona.narration':
      return personaFor(settings.lessNsfwText, settings.readerPronouns)
    case 'persona.texting':
      return TEXTING_PERSONA
    case 'persona.designer':
      return DESIGNER_PERSONA
    default:
      return id in NEW_GAME_TEXTS
        ? NEW_GAME_TEXTS[id as NewGameTextId]
        : SCENE_TEXTS[id as keyof typeof SCENE_TEXTS]
  }
}
