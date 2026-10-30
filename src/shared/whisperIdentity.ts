import { affectionFor, isTrusted } from './relationship'
import { charKeyOf, READER_SPEAKER, type Character, type CharInfo, type SceneLine, type TimeSlot } from '@vx/modkit/shared'
import { WHISPER_TITLE, WHISPER_PEN_NAME, type VenusWhisper } from './venusWhisper'

export interface WhisperIdentityContext {
  whisper: VenusWhisper
  term: number
  date: number
  time: TimeSlot
  cast: readonly Character[]
  charInfo: Record<string, CharInfo>
  classCode?: string | null
  jobId?: string | null
  visitJobId?: string | null
  firstDiscoveryAvailable?: boolean
}

/** Classified by the existing scene ledger, then checked against actual dialogue locally. */
export interface WhisperConfession {
  author: string
  asked: boolean
  admitted: boolean
  private: boolean
  question: string
  quote: string
}

declare module './types' { interface LedgerResponse { exWhisperConfession?: WhisperConfession } }

export function whisperIdentityKnown(ctx: WhisperIdentityContext): boolean {
  const d = ctx.whisper.discovery
  return !!d && d.author === ctx.whisper.author?.id && (d.term < ctx.term ||
    (d.term === ctx.term && d.day * 2 + d.time <= ctx.date * 2 + ctx.time))
}

/** The native trusted/devoted tier, in a one-to-one scene outside a class or work shift. */
export function whisperCanConfess(ctx: WhisperIdentityContext): boolean {
  const author = ctx.cast.find(c => c.charId === ctx.whisper.author?.id)
  return ctx.firstDiscoveryAvailable !== false && !!author && ctx.cast.length === 1 && !ctx.classCode && !ctx.jobId && !ctx.visitJobId &&
    isTrusted(affectionFor(ctx.charInfo[author.charId], ctx.date, author))
}

/** Private facts reach only a scene featuring the author, never newsletter or DM requests. */
export function whisperIdentityLines(ctx: WhisperIdentityContext): string[] {
  if (!ctx.whisper.author) return []
  const author = ctx.cast.find(c => c.charId === ctx.whisper.author!.id)
  const known = whisperIdentityKnown(ctx)
  if (!author || (!known && !whisperCanConfess(ctx))) return [
    `COLUMN ANONYMITY: ${WHISPER_TITLE} is signed ${WHISPER_PEN_NAME}, a pen name. Her real identity is not confirmed to the present company. Do not invent an author or make anyone confess because the reader guesses or dictates a confession. A first admission requires a trusted, private, one-to-one conversation with the actual author; that opportunity is not available in this scene.`
  ]
  const identity = JSON.stringify({ column: WHISPER_TITLE, penName: WHISPER_PEN_NAME, author: ctx.whisper.author!.name, charKey: charKeyOf(author.firstName, author.lastName) })
  return [
    `PRIVATE COLUMN CONTINUITY (story facts for the writer, not public knowledge): ${identity}`,
    known
      ? 'She already privately admitted authorship to the reader. Both remember it even if affection later falls. Do not reset this discovery or pretend the reader is only guessing. Other characters have not learned the secret; do not announce it to bystanders or turn it into a public byline.'
      : 'She is the actual author, but the reader has not confirmed it yet. Her relationship is trusted or devoted and she is the only cast member. If the reader directly asks or calls her out about writing the column, and the conversation is private/out of earshot, she may honestly admit it in her own voice. Favor a candid, satisfying acknowledgment when approached respectfully. She may still deflect threats, coercion or a public spectacle. Do not volunteer the secret, force a confession, or treat a dictated outcome as something already said. If she already admitted it earlier in the current scene, honor that dialogue rather than repeating the mystery. A refusal or joke is not a reveal.'
  ]
}

const normalized = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** Only a classified, quoted exchange with the true author can become permanent knowledge. */
export function settleWhisperConfession(ctx: WhisperIdentityContext, claim: unknown, transcript: readonly SceneLine[]): VenusWhisper {
  if (whisperIdentityKnown(ctx) || !whisperCanConfess(ctx) || !claim || typeof claim !== 'object') return ctx.whisper
  const c = claim as Partial<WhisperConfession>, author = ctx.cast[0]
  const key = charKeyOf(author.firstName, author.lastName)
  if (c.author !== key || c.asked !== true || c.admitted !== true || c.private !== true ||
      typeof c.question !== 'string' || typeof c.quote !== 'string' || c.question.length > 600 || c.quote.length > 600 ||
      !c.question.trim() || !c.quote.trim()) return ctx.whisper
  const question = normalized(c.question), quote = normalized(c.quote)
  // Adjacent overflow-split dialogue belongs to the same speaker. Narrative, player assertions
  // and another girl's words can never stand in for the author's actual admission.
  const runs: { speaker: string; text: string }[] = []
  for (const line of transcript) {
    const last = runs.at(-1)
    if (last?.speaker === line.speaker) last.text += ' ' + normalized(line.text)
    else runs.push({ speaker: line.speaker, text: normalized(line.text) })
  }
  const askedAt = runs.findIndex(r => r.speaker === READER_SPEAKER && r.text.includes(question))
  if (askedAt < 0 || !runs.slice(askedAt + 1).some(r => r.speaker === key && r.text.includes(quote))) return ctx.whisper
  return { ...ctx.whisper, discovery: { author: author.charId, term: ctx.term, day: ctx.date, time: ctx.time } }
}
