import { listed } from '../minigameKit'

/**
 * Truth or Dare, as far as code can run it: whose turn it is and who asks, what each round asks
 * of the model and what stands in when the model cannot be had, the tally, and what the scene is
 * told once it is over. What is asked, answered and done is the model's and the reader's.
 */

export type Kind = 'truth' | 'dare'

/**
 * How a turn came out: a truth answered straight or dodged, a dare done or backed out of.
 * `skipped` is a girl's turn the model never played: nobody's doing, and no point either way.
 * `void` is a turn that went past what was agreed for the game: it does not count for anyone.
 */
export type Verdict = 'honest' | 'dodged' | 'done' | 'chickened' | 'skipped' | 'void'

/**
 * How far the questions and dares may go. 4 is only ever agreed where the player has the game's
 * NSFW text on: the game's option offers it nowhere else.
 */
export type Heat = 1 | 2 | 3 | 4

/** The reader's seat; the girls sit at 1 and up, in the order they were handed over. */
export const READER = 0

/** One turn, played out. */
export interface Turn {
  /** Whose turn it was, by seat. */
  player: number
  /** Who asked or set it, by seat. */
  asker: number
  kind: Kind
  /** The question or the dare, as it was put. */
  prompt: string
  /** What was said in answer: the reader's own typing, or her line; empty where he backed out. */
  reply: string
  /** What she was seen to do, for a dare of hers the model played. */
  deed: string
  verdict: Verdict
}

/**
 * The game's terms and who is in it. `names` are the girls', in seat order; `manner` is how each
 * plays this game, in a few words, where that was judged.
 */
export interface Terms {
  names: readonly string[]
  rounds: number
  heat: Heat
  manner?: readonly string[]
}

/** The most of what the reader typed that is taken for a question, a dare or an answer. */
export const TYPED_MAX = 240

/** The most of any one text the model writes that is kept. */
export const WRITTEN_MAX = 300

/** Text on one line: every run of spaces and line breaks is a single space. */
export function oneLine(words: string): string {
  return words.replace(/\s+/g, ' ').trim()
}

/** What the reader typed, as the game takes it: one line, and no longer than a turn has room for. */
export function typedOf(sent: string): string {
  return oneLine(sent).slice(0, TYPED_MAX).trim()
}

/** Text cut to `max`, at the end of a sentence where there is one far enough in, else at a word. */
export function clipped(words: string, max = WRITTEN_MAX): string {
  const line = oneLine(words)
  if (line.length <= max) return line
  const cut = line.slice(0, max)
  const ends = [...cut.matchAll(/[.!?…]["'”’)]*(?=\s|$)/g)]
  const end = ends.length > 0 ? ends[ends.length - 1] : undefined
  if (end && end.index + end[0].length >= max / 4) return cut.slice(0, end.index + end[0].length)
  const space = cut.lastIndexOf(' ')
  return `${(space > max / 2 ? cut.slice(0, space) : cut.slice(0, max - 1)).trimEnd()}…`
}

/** How a girl plays this game, from her skill at it and her way of playing: one short clause. */
export function mannerOf(skill: number, style: string): string {
  const nerve =
    skill >= 4
      ? 'bold and quick at this game: answers straight, takes dares, asks things that land'
      : skill <= 2
        ? 'cautious at this game: slower to answer, readier to back out, asks safe things'
        : 'middling at this game: game for most of it, with limits'
  const way = oneLine(style).replace(/[.]+$/, '')
  return way ? `${nerve}; ${way}` : nerve
}

export const HEAT_WORD: Record<Heat, string> = { 1: 'mild', 2: 'flirty', 3: 'bold', 4: 'wide open' }

const HEAT_MEANS: Record<Heat, string> = {
  1: 'mild: harmless fun between friends. Embarrassing stories, silly habits, goofy dares. Nothing romantic and no touching beyond a high five.',
  2: 'flirty: teasing is welcome. Crushes, first impressions, what they like in someone; dares with a little closeness, such as holding a hand, a compliment said with a straight face, a kiss on the cheek at most.',
  3: 'bold: frank about attraction, romance and each other; dares may be daring and close, a kiss at most. Nothing explicit.',
  4: 'anything goes: questions may be as explicit as they like, and dares may go as far as a scene could, undressing and touching included.'
}

/** What holds at every heat, said in every brief. */
const LIMIT =
  'Whatever the heat, everything asked, dared, said and done stays within what adults playing this at a party, in company, would really say and do: never sexually explicit in word or deed, no undressing, and nothing physical beyond a kiss.'

/**
 * What holds at heat 4 in place of the limit above: nothing is off the table but what she would
 * not do, and the game stays a game, played where they are.
 */
const OPEN_LIMIT =
  'At this heat nothing is ruled out by the game itself: what is asked, dared, said and done may be sexually explicit, and dares may include undressing and touching. Each girl still goes only as far as she really would with him, here and now, and anyone may back out of anything. A dare is still done right here and in a moment; anything that would take longer is for after the game.'

/** The line a game's briefs hold to: the open one at heat 4, the party one at every other. */
function limitOf(heat: Heat): string {
  return heat === 4 ? OPEN_LIMIT : LIMIT
}

const ADULTS = 'Everyone at the table is an adult.'

/** Said wherever the limit is: nothing staked on the game moves it. */
const NO_LIFT =
  'Whatever is riding on the game never lifts that limit or raises the heat: a stake is no reason to go further.'

/** What a round is told of the field that says whether the turn kept within what was agreed. */
function fairField(what: string): string {
  return `"fair" is "yes" where ${what} keeps within the heat and the limit above, and "over" where it goes past either. An "over" turn is void and scores for nobody; when in doubt between the two, it is "over" only where it is plainly past the line.`
}

const FAIR = ['yes', 'over'] as const

export function heatOf(value: number | undefined): Heat {
  return value === 1 || value === 3 || value === 4 ? value : 2
}

/** How many sit at the table, the reader included. */
export function seats(terms: Terms): number {
  return terms.names.length + 1
}

/** How many turns the whole game is. */
export function turnsIn(terms: Terms): number {
  return seats(terms) * terms.rounds
}

/** Whose turn the `turn`th is, counting from 0: round the table, the reader first. */
export function playerAt(terms: Terms, turn: number): number {
  return turn % seats(terms)
}

/** Who asks on the `turn`th turn: the player just before in the order, round the table. */
export function askerAt(terms: Terms, turn: number): number {
  const n = seats(terms)
  return (playerAt(terms, turn) + n - 1) % n
}

/** A seat's name as the table shows it. */
export function seatName(terms: Terms, seat: number): string {
  return seat === READER ? 'You' : terms.names[seat - 1]
}

/** A seat's name as the model is told it. */
function told(terms: Terms, seat: number): string {
  return seat === READER ? 'the reader' : terms.names[seat - 1]
}

export function scored(verdict: Verdict): boolean {
  return verdict === 'honest' || verdict === 'done'
}

/** The turn was ducked by whoever's it was: a dodge or a backing out, not a turn that was skipped. */
export function ducked(verdict: Verdict): boolean {
  return verdict === 'dodged' || verdict === 'chickened'
}

/** The verdicts a turn of this kind can end on: the one that scores, then the one that does not. */
export function verdictsFor(kind: Kind): readonly [Verdict, Verdict] {
  return kind === 'truth' ? ['honest', 'dodged'] : ['done', 'chickened']
}

/** Points by seat. */
export function tally(terms: Terms, log: readonly Turn[]): number[] {
  const points = Array.from({ length: seats(terms) }, () => 0)
  for (const turn of log) if (scored(turn.verdict)) points[turn.player]++
  return points
}

/** How it came out for the reader: alone on top he won, sharing it is a draw. */
export function outcomeOf(points: readonly number[]): 'won' | 'lost' | 'draw' {
  const best = Math.max(...points)
  if (points[READER] < best) return 'lost'
  return points.filter((p) => p === best).length > 1 ? 'draw' : 'won'
}

/* What stands in for the model. Tame on purpose, and each works whoever asks whom. */

/** The stand-ins go no further than bold: what goes past that is the model's and the reader's. */
type StockHeat = Exclude<Heat, 4>

const TRUTHS: Record<StockHeat, readonly string[]> = {
  1: [
    'What is the most embarrassing thing that has happened to you in a class?',
    'What is a food you pretend to like but secretly cannot stand?',
    'What is the silliest thing you were scared of as a kid?',
    'What is the worst gift you ever had to act happy about?',
    'What song do you only listen to when nobody is around?',
    'What is the last lie you told to get out of plans?'
  ],
  2: [
    'What was your honest first impression of me?',
    'What is the first thing you notice about someone you like?',
    'Who was your first crush, and what did you do about it?',
    'What is the most romantic thing anyone has done for you?',
    'What is something about me you have never said out loud?',
    'What would your perfect date be, start to finish?'
  ],
  3: [
    'Have you ever thought about kissing someone at this table?',
    'What is the boldest thing you have ever done to get someone to notice you?',
    'What is the thing you find most attractive about me?',
    'When did you last get jealous, and over whom?',
    'What is a secret you have never told anyone on campus?',
    'What do you think about right before you fall asleep these days?'
  ]
}

const DARES: Record<StockHeat, readonly string[]> = {
  1: [
    'Do your best impression of me.',
    'Say the alphabet backwards as far as you can get.',
    'Say one whole sentence in your poshest accent.',
    'Show the last photo you took.',
    'Sing the chorus of the last song you listened to.',
    'Balance something on your head for a count of ten.'
  ],
  2: [
    'Give me your best pick-up line with a straight face.',
    'Hold eye contact with me for ten seconds without laughing.',
    'Pay me three compliments, and mean them.',
    'Hold my hand for a count of ten.',
    'Describe me in three words, no thinking.',
    'Whisper something nice in my ear.'
  ],
  3: [
    'Kiss me on the cheek.',
    'Lean your shoulder against mine for a count of ten.',
    'Tell me, looking me in the eye, the moment you liked me most.',
    'Whisper something you have never dared tell me.',
    'Dance with me for ten seconds, right here.',
    'Say what you would do on a date with me if nothing could go wrong.'
  ]
}

/**
 * What has been put so far this game, so nothing is put twice. What a turn was called void for
 * is not said again: where a girl was put something over the line, that is what was put.
 */
export function askedSoFar(log: readonly Turn[]): string[] {
  return log
    .filter((turn) => !(turn.verdict === 'void' && turn.player !== READER))
    .map((turn) => turn.prompt)
    .filter((prompt) => prompt !== '')
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Stock truths or dares to offer or to fall back on: this heat's first, then the tamer ones,
 * none already put this game. `start` turns the list so each turn opens on different ones.
 */
export function stock(
  kind: Kind,
  heat: Heat,
  used: readonly string[],
  count: number,
  start = 0
): string[] {
  const lists = kind === 'truth' ? TRUTHS : DARES
  const heats = ([3, 2, 1] as const).filter((h) => h <= heat)
  const out: string[] = []
  for (const h of heats) {
    const list = lists[h]
    for (let i = 0; i < list.length; i++) {
      const pick = list[(i + start) % list.length]
      if (!used.some((u) => same(u, pick))) out.push(pick)
    }
  }
  // A long game at the mild heat can run the lists dry: then a repeat is better than nothing.
  return (out.length > 0 ? out : [...lists[heat === 4 ? 3 : heat]]).slice(0, count)
}

/** One round asked of the model: what it is told, and what it sends back. */
export interface RoundPlan {
  brief: string
  fields: Record<string, 'text' | readonly string[]>
}

/** What every brief opens with: the turn, who asks, how far it may go, and what has been put. */
function frame(terms: Terms, log: readonly Turn[]): string[] {
  const turn = log.length
  const player = playerAt(terms, turn)
  const asker = askerAt(terms, turn)
  const used = askedSoFar(log)
  const manners = terms.names
    .map((name, i) => (terms.manner?.[i] ? `${name} is ${terms.manner[i]}` : ''))
    .filter(Boolean)
  return [
    `Truth or Dare, turn ${turn + 1} of ${turnsIn(terms)}. It is ${told(terms, player)}'s turn to take a truth or a dare; ${told(terms, asker)} is the one who asks the question or sets the dare.`,
    `Heat is ${terms.heat} of ${terms.heat === 4 ? 4 : 3}, ${HEAT_MEANS[terms.heat]} That is the ceiling, not a target. ${limitOf(terms.heat)}`,
    `${ADULTS} ${NO_LIFT}`,
    'Write every girl in her own character and voice, as her sheet and the scene so far show her. How close she is to the reader is judged from the scene so far, by how she has been with him in it: she says and does only what she really would with him, here, now, and no more than that shows.',
    ...(manners.length > 0 ? [`How each plays this game: ${manners.join('. ')}.`] : []),
    used.length > 0
      ? `Already asked or dared this game, none of which may be repeated or reworded: ${used.map((p) => `"${p}"`).join(' ')}`
      : 'Nothing has been asked or dared yet this game.'
  ]
}

const HER_WORDS = 'her spoken words only, in her own voice: one or two sentences, no narration, no stage directions'

/** A girl's turn opens: does she take truth or dare? */
export function chooseRound(terms: Terms, log: readonly Turn[]): RoundPlan {
  const her = told(terms, playerAt(terms, log.length))
  const asker = told(terms, askerAt(terms, log.length))
  return {
    brief: [
      ...frame(terms, log),
      `${her} now picks truth or dare, in character: what she would really pick with ${asker} doing the asking, given her nerve, her mood and how the game has gone.`,
      `"choice" is her pick: "truth" or "dare".`,
      `"line" is what ${her} says as she picks, ${HER_WORDS}. It must make her pick plain.`
    ].join('\n'),
    fields: { choice: ['truth', 'dare'], line: 'text' }
  }
}

/** A girl puts the question or sets the dare for whoever's turn it is; here, the reader's. */
export function poseRound(terms: Terms, log: readonly Turn[], kind: Kind): RoundPlan {
  const her = told(terms, askerAt(terms, log.length))
  const player = told(terms, playerAt(terms, log.length))
  return {
    brief: [
      ...frame(terms, log),
      `${player} has picked ${kind}. ${her} now ${kind === 'truth' ? 'asks the question' : 'sets the dare'}.`,
      kind === 'truth'
        ? `"prompt" is the one question ${her} asks ${player}, ${HER_WORDS}. A real question with something at stake for him, about him, about her or about the two of them, answerable in a sentence or two.`
        : `"prompt" is the dare ${her} sets ${player}, ${HER_WORDS}. One thing he can do right here at the table in a moment and describe in a sentence: nothing that needs him to leave, and nothing that needs anyone outside the game.`
    ].join('\n'),
    fields: { prompt: 'text' }
  }
}

/** A girl answers the truth or does the dare that was put to her. */
export function answerRound(
  terms: Terms,
  log: readonly Turn[],
  kind: Kind,
  prompt: string
): RoundPlan {
  const her = told(terms, playerAt(terms, log.length))
  const asker = told(terms, askerAt(terms, log.length))
  const [yes, no] = verdictsFor(kind)
  const head = [...frame(terms, log), `${her} picked ${kind}. ${asker} put it to her, word for word: "${prompt}"`]
  if (kind === 'truth') {
    return {
      brief: [
        ...head,
        `${her} now answers, in character. She answers for real where she would; where the question goes further than she would go with ${asker}, or than the heat allows, she ducks it.`,
        `"line" is what ${her} says in answer, ${HER_WORDS}. The answer itself, not a remark about answering.`,
        `"outcome" is "${yes}" where her line truly answers the question, and "${no}" where she deflected, joked past it or refused.`,
        fairField('the question as it was put'),
        `Where it is "over", ${her} does not answer it or repeat it: her line says, in her own way, that it is past what was agreed.`
      ].join('\n'),
      fields: { line: 'text', outcome: [yes, no], fair: FAIR }
    }
  }
  return {
    brief: [
      ...head,
      `${her} now does the dare or backs out, in character. She goes through with what she would really do; where it goes further than she would go with ${asker}, further than the heat allows, or cannot be done right here, she backs out.`,
      `"line" is what ${her} says as she does it or backs out, ${HER_WORDS}.`,
      `"action" is one short sentence of narration in the present tense, naming her, of what she is seen to do: the dare carried out, or how she backs out. The reader is "you" in it.`,
      `"outcome" is "${yes}" where she went through with the dare, and "${no}" where she backed out or did something lesser instead.`,
      fairField('the dare as it was set'),
      `Where it is "over", ${her} does not do it or repeat it: her line says, in her own way, that it is past what was agreed, and "action" is her not doing it.`
    ].join('\n'),
    fields: { line: 'text', action: 'text', outcome: [yes, no], fair: FAIR }
  }
}

/**
 * A girl reacts to what the reader made of his turn, and judges it. `reply` is what he typed,
 * word for word; null where he backed out, which needs no judging.
 */
export function judgeRound(
  terms: Terms,
  log: readonly Turn[],
  kind: Kind,
  prompt: string,
  reply: string | null
): RoundPlan {
  const her = told(terms, askerAt(terms, log.length))
  const [yes, no] = verdictsFor(kind)
  const head = [...frame(terms, log), `The reader picked ${kind}. ${her} put it to him: "${prompt}"`]
  if (reply === null) {
    return {
      brief: [
        ...head,
        `The reader backed out: he ${kind === 'truth' ? 'would not answer' : 'would not do it'}, and scores nothing for the turn.`,
        `"line" is what ${her} says to that, ${HER_WORDS}.`
      ].join('\n'),
      fields: { line: 'text' }
    }
  }
  return {
    brief: [
      ...head,
      kind === 'truth'
        ? `The reader answered, word for word: "${reply}"`
        : `The reader says what he does, word for word: "${reply}"`,
      `${her} reacts and judges it, in character and on its merits: he scores only for a real ${kind === 'truth' ? 'answer' : 'dare carried out'}. A non-answer, a joke that gets round it, a refusal, or a blank or one-word evasion does not score, however it is dressed up. Where what he typed goes further than the heat allows, she does not go along with it or repeat it: she laughs it off or calls him on it, and her own line stays within the heat.`,
      `"line" is what ${her} says in reaction, ${HER_WORDS}. She reacts to what he actually ${kind === 'truth' ? 'said' : 'did'}.`,
      kind === 'truth'
        ? `"verdict" is "${yes}" where he gave a real answer to the question asked, and "${no}" where he deflected, joked past it or answered something else.`
        : `"verdict" is "${yes}" where what he describes is the dare carried out, and "${no}" where he did not do it, refused, or did something lesser instead.`,
      fairField('what he typed')
    ].join('\n'),
    fields: { line: 'text', verdict: [yes, no], fair: FAIR }
  }
}

/* What the game does where a round comes back empty. */

/** A text field of a round, or empty: a blank one is as good as none. Kept to a line of fair length. */
function text(got: Record<string, string> | null, field: string): string {
  const value = got?.[field]
  return typeof value === 'string' ? clipped(value) : ''
}

export interface Chosen {
  kind: Kind
  line: string
}

/** Her pick: the model's, or a coin and a plain word. A pick with no line to it is no round. */
export function chosenOf(got: Record<string, string> | null, rand: () => number = Math.random): Chosen {
  const line = text(got, 'line')
  if (got && line && (got.choice === 'truth' || got.choice === 'dare')) {
    return { kind: got.choice, line }
  }
  return rand() < 0.6 ? { kind: 'truth', line: 'Truth.' } : { kind: 'dare', line: 'Dare.' }
}

/**
 * What she puts to the reader: the model's, or the first stock one not yet used. A blank one, or
 * one already put this game, is no round.
 */
export function posedOf(
  got: Record<string, string> | null,
  kind: Kind,
  heat: Heat,
  log: readonly Turn[]
): string {
  const used = askedSoFar(log)
  const prompt = text(got, 'prompt')
  if (prompt && !used.some((u) => same(u, prompt))) return prompt
  return stock(kind, heat, used, 1, log.length)[0]
}

export interface Answered {
  line: string
  deed: string
  verdict: Verdict
}

/**
 * Her answer or her dare as the model played it, or null where the round is no use. What was put
 * to her past the line is void whatever else came back. Backing out is always taken as that; a
 * dare said to be done with nothing seen done is no round.
 */
export function answerHeard(got: Record<string, string> | null, kind: Kind): Answered | null {
  const [yes, no] = verdictsFor(kind)
  if (!got) return null
  const line = text(got, 'line')
  if (got.fair === 'over') return { line, deed: '', verdict: 'void' }
  const deed = kind === 'dare' ? text(got, 'action') : ''
  if (got.outcome === no && (line || deed)) return { line, deed, verdict: no }
  if (got.outcome !== yes || !line || (kind === 'dare' && !deed)) return null
  return { line, deed, verdict: yes }
}

/**
 * Her answer or her dare: the model's, or what stands in. No code can answer a question or do a
 * dare for her, and a failed call is not her ducking it: the turn is skipped, with no point
 * either way, nothing put in her mouth and nothing she is said to have done.
 */
export function answeredOf(got: Record<string, string> | null, kind: Kind): Answered {
  return answerHeard(got, kind) ?? { line: '', deed: '', verdict: 'skipped' }
}

/** What the table is told where a turn is void. */
export const VOID_LINE = "That one is past what you agreed; it doesn't count."

/** What the table is told where a girl's turn is skipped. */
export function skippedLine(name: string): string {
  return `${name}'s turn is passed over: no point either way.`
}

export interface Judged {
  line: string
  verdict: Verdict
}

/** What the reader typed says nothing: blank of words, or a word or two that only waves it off. */
export function evasive(reply: string): boolean {
  const words = oneLine(reply)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]/gu, ' ')
    .split(' ')
    .filter(Boolean)
  if (words.length === 0) return true
  if (words.length > 3) return false
  const DUCKS = ['no', 'nope', 'nah', 'pass', 'skip', 'next', 'never', 'idk', 'dunno', 'whatever', 'nothing', 'none', 'no comment', 'not telling', "won't say", 'no way', "i won't", "i don't know", 'i refuse', 'i pass']
  return DUCKS.includes(words.join(' '))
}

/**
 * Her verdict on the reader's turn: the model's, or, with no model, his word taken for it unless
 * what he typed says nothing. Backing out (`reply` null) is settled without her, and what he
 * typed past the line is void.
 */
export function judgedOf(got: Record<string, string> | null, kind: Kind, reply: string | null): Judged {
  const [yes, no] = verdictsFor(kind)
  const line = text(got, 'line')
  if (reply === null) return { line: line || 'Backing out? Noted.', verdict: no }
  if (got?.fair === 'over') return { line, verdict: 'void' }
  // Nothing typed is nothing done, whoever judged it.
  if (!/[\p{L}\p{N}]/u.test(reply)) return { line: line || 'That is not an answer.', verdict: no }
  if (got && line && (got.verdict === yes || got.verdict === no)) {
    return { line, verdict: got.verdict }
  }
  if (evasive(reply)) return { line: 'That is not an answer.', verdict: no }
  return { line: kind === 'truth' ? 'Okay. I will take that.' : 'All right, that counts.', verdict: yes }
}

/* The others at the table. */

/** How many times a game someone not in the turn says something, by how talkative the table is. */
export const REMARKS = { quiet: 0, some: 2, lots: 5 } as const

/**
 * The girl who may say something about the turn just played: one who neither asked nor answered,
 * the word going round by turn. Null with nobody spare, at the cap, or on the last turn, which
 * the scene's own reply answers. Short of talkative, only a turn somebody ducked is worth it.
 */
export function onlooker(
  terms: Terms,
  log: readonly Turn[],
  chattiness: keyof typeof REMARKS,
  made: number
): number | null {
  const last = log[log.length - 1]
  if (!last || log.length >= turnsIn(terms) || made >= REMARKS[chattiness]) return null
  // A skipped turn is nobody's doing: there is nothing in it to remark on.
  if (last.verdict === 'skipped') return null
  if (chattiness !== 'lots' && scored(last.verdict)) return null
  const spare = terms.names
    .map((_, i) => i + 1)
    .filter((seat) => seat !== last.player && seat !== last.asker)
  return spare.length > 0 ? spare[log.length % spare.length] : null
}

const VERDICT_TOLD: Record<Verdict, string> = {
  honest: 'answered straight',
  dodged: 'dodged it',
  done: 'did it',
  chickened: 'backed out',
  skipped: 'turn skipped',
  void: 'turn void'
}

/**
 * The turn just played, for whoever remarks on it, with how far her remark may go. A void turn
 * is told as that and no more: what it was void for is not passed on.
 */
export function remarkCue(terms: Terms, turn: Turn): string {
  const player = told(terms, turn.player)
  const asker = told(terms, turn.asker)
  const bounds = `Her remark keeps to the game's heat, ${HEAT_MEANS[terms.heat]} ${limitOf(terms.heat)} ${ADULTS} ${NO_LIFT}`
  if (turn.verdict === 'void') {
    return `${asker} put a ${turn.kind} to ${player}, and the turn was called void for going past what was agreed: no point to anyone. She was watching, not part of that turn; she does not guess at or repeat what it was. ${bounds}`
  }
  const put = turn.kind === 'truth' ? `asked ${player} "${turn.prompt}"` : `dared ${player}: "${turn.prompt}"`
  const said = turn.reply ? ` ${player} said: "${turn.reply}"` : ''
  return `${asker} ${put}.${said} ${player} ${VERDICT_TOLD[turn.verdict]}. She was watching, not part of that turn. ${bounds}`
}

/* What the framework is told. */

const points = (n: number): string => `${n} point${n === 1 ? '' : 's'}`

/** The tally in a row: "the reader 1, Ana 2". */
function tallyTold(terms: Terms, log: readonly Turn[]): string {
  return tally(terms, log)
    .map((p, seat) => `${told(terms, seat)} ${p}`)
    .join(', ')
}

/** How the game stands, for anything said at the table. `now` is what is happening this turn. */
export function situationOf(terms: Terms, log: readonly Turn[], now: string): string {
  const over = log.length >= turnsIn(terms)
  return [
    `The game is Truth or Dare, ${terms.rounds} turn${terms.rounds === 1 ? '' : 's'} each, played ${HEAT_WORD[terms.heat]}. A truth answered straight or a dare done is a point; a turn past what was agreed is void.`,
    `The tally is ${tallyTold(terms, log)}.`,
    over
      ? 'The last turn has just been played.'
      : `Turn ${log.length + 1} of ${turnsIn(terms)}: it is ${told(terms, playerAt(terms, log.length))}'s turn, and ${told(terms, askerAt(terms, log.length))} asks.`,
    ...(now ? [now] : [])
  ].join(' ')
}

/** The result as the scene narrates it. */
export function summaryOf(terms: Terms, log: readonly Turn[]): string {
  const score = tally(terms, log)
  const who = listed(terms.names)
  const outcome = outcomeOf(score)
  const best = Math.max(...score)
  const mine = points(score[READER])
  if (terms.names.length === 1) {
    const hers = score[1]
    return outcome === 'draw'
      ? `You play Truth or Dare with ${who} and it ends level, ${mine} each.`
      : `You play Truth or Dare with ${who} and ${outcome === 'won' ? 'win' : 'lose'}, ${score[READER]} to ${hers}.`
  }
  const top = terms.names.filter((_, i) => score[i + 1] === best)
  if (outcome === 'won') return `You play Truth or Dare with ${who} and come out on top with ${mine}.`
  if (outcome === 'draw') return `You play Truth or Dare with ${who} and share the top with ${listed(top)}, ${points(best)} each.`
  return `You play Truth or Dare with ${who}; ${listed(top)} ${top.length > 1 ? 'share the top' : 'comes out on top'} with ${points(best)}, and you finish on ${score[READER]}.`
}

/** One turn in a line: who put what to whom, what was said, how it was judged. */
function turnTold(terms: Terms, turn: Turn, at: number): string {
  const player = told(terms, turn.player)
  const asker = told(terms, turn.asker)
  const head =
    turn.kind === 'truth'
      ? `${at + 1}. Truth. ${asker} asked ${player}: "${turn.prompt}"`
      : `${at + 1}. Dare. ${asker} dared ${player}: "${turn.prompt}"`
  if (turn.verdict === 'skipped') {
    return `${head} No answer came and the turn was skipped: ${player} was not heard to answer or to refuse. (turn skipped, no point either way)`
  }
  if (turn.verdict === 'void') {
    const what =
      turn.player === READER
        ? `${asker} put a ${turn.kind} to ${player}, and what ${player} came back with`
        : `What ${asker} ${turn.kind === 'truth' ? 'asked' : 'dared'} ${player}`
    return `${at + 1}. ${turn.kind === 'truth' ? 'Truth' : 'Dare'}. ${what} went past what was agreed for the game, and the turn was called void. (turn void, no point to anyone)`
  }
  const backed = turn.player === READER && turn.reply === ''
  // His dare is his own account of what he did; hers is her line, and then what she was seen to do.
  const verb = turn.kind === 'truth' ? 'answered' : turn.player === READER ? 'said what he did' : 'said'
  const body = backed
    ? ` ${player} backed out without ${turn.kind === 'truth' ? 'answering' : 'doing it'}.`
    : `${turn.reply ? ` ${player} ${verb}: "${turn.reply}"` : ''}${turn.deed ? ` ${turn.deed}` : ''}`
  return `${head}${body} (${VERDICT_TOLD[turn.verdict]}${scored(turn.verdict) ? ', a point' : ', no point'})`
}

/**
 * The game for the scene's writer: the terms, every turn with what was asked and what was said
 * in answer, who ducked, and the tally. A game left before its last turn is told as far as it
 * got, with nobody the winner.
 */
export function accountOf(terms: Terms, log: readonly Turn[]): string[] {
  const score = tally(terms, log)
  const best = Math.max(...score)
  const top = score.map((p, seat) => (p === best ? told(terms, seat) : '')).filter(Boolean)
  const count = (seat: number, is: (verdict: Verdict) => boolean): number =>
    log.filter((turn) => turn.player === seat && is(turn.verdict)).length
  const times = (n: number): string => (n === 1 ? 'once' : `${n} times`)
  const all = Array.from({ length: seats(terms) }, (_, seat) => seat)
  const backed = all.filter((seat) => count(seat, ducked) > 0)
  const lost = all.filter((seat) => count(seat, (v) => v === 'skipped') > 0)
  const voided = log.filter((turn) => turn.verdict === 'void').length
  const whole = log.length >= turnsIn(terms)
  return [
    `Truth or Dare, ${terms.rounds} turn${terms.rounds === 1 ? '' : 's'} each, played ${HEAT_WORD[terms.heat]}. What was said below was really said at the table and everyone there heard it: it may be remembered, teased about or brought up again.`,
    ...log.map((turn, at) => turnTold(terms, turn, at)),
    backed.length > 0
      ? `Dodged or backed out: ${backed.map((seat) => `${told(terms, seat)} ${times(count(seat, ducked))}`).join(', ')}.`
      : 'Nobody dodged or backed out.',
    ...(lost.length > 0
      ? [
          `Turns skipped through nobody's fault, not held against her: ${lost.map((seat) => `${told(terms, seat)} ${times(count(seat, (v) => v === 'skipped'))}`).join(', ')}.`
        ]
      : []),
    ...(voided > 0 ? [`Turns called void for going past what was agreed: ${voided}.`] : []),
    whole
      ? `Final tally: ${tallyTold(terms, log)}. ${top.length > 1 ? `${listed(top).replace(/^t/, 'T')} share the top: a draw between them.` : `${top[0].replace(/^t/, 'T')} won.`}`
      : `The game stopped after ${log.length} of ${turnsIn(terms)} turns, unfinished. The tally as it stood: ${tallyTold(terms, log)}. Nobody won.`
  ]
}
