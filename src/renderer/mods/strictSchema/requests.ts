import type { StructuredRequest } from '@shared/types'
import { globalSlotOf } from '@shared/jobs'
import type { RequestSpots } from '../hooks'
import { invitationCoolingDown } from './hangoutPolicy'

type Schema = Record<string, unknown>

const CONVERSATION_RULES = [
  'Use the latest reader message or action to guide the current exchange. If the reader changes subject, respond to that subject in her own voice instead of steering every reply back to an earlier complaint, apology, reassurance, or relationship discussion.',
  'Read the recent conversation before replying. Rephrasing a fact, complaint, question, or demand already expressed is still repetition; do not repeat it unless the reader asks about it or something new makes it relevant.',
  'Memories and relationship notes are background, not a checklist of topics to mention. An unresolved feeling may affect her tone without making her repeat the same grievance in every reply. Respect established resolutions without inventing forgiveness or forgetting what happened.',
  'Keep developing a subject while the reader is actively discussing it; do not force a topic change on every turn. Otherwise let the conversation move naturally with a relevant reaction or small detail grounded in the supplied context. A brief ordinary reply is better than recycling old dialogue or inventing shared history.'
]

/** Keep ledger memories as event clauses and leave effort to the player's settings. */
export function strictLedgerRequest(request: StructuredRequest): StructuredRequest {
  const result = { ...request }
  delete result.minThinking
  return withRules(result, [
    'Every memory "desc" is only the event clause that completes "<Name> <type> that ...". The game supplies the character name, reaction, and "that"; do not repeat that introduction.',
    'Write the event in the past tense. When the reader is the subject, begin with "the reader" and use "the reader" or "the reader\'s" throughout, never "you", "your", "he", or "his" for the reader.',
    'Do not begin a memory with "<Name> remembers that", "she remembers that", "I remember", "<Name> liked that", "<Name> hated that", or another memory/reporting preface. Do not add a leading "that".',
    'Correct desc: "the reader interrupted her explanation". Incorrect desc: "Gwen remembers that you interrupted her explanation" or "Gwen hated that the reader interrupted her explanation".',
    'Keep each desc to one concise event clause, with a short reason only when needed to explain her reaction. Do not retell the whole scene.',
    'Choose the memory type from the character\'s reaction established in the supplied transcript. An ordinary answer, conversation, or walk is not automatically something she hated. Do not invent resentment or affection to justify a type; omit a memory when no meaningful reaction is supported.',
    'These rules apply only to memory descriptions. Keep every other ledger field and instruction, including stats, events, and plans, intact.'
  ])
}

function object(value: unknown): Schema | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Schema
    : null
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function withRules(request: StructuredRequest, rules: readonly string[]): StructuredRequest {
  return {
    ...request,
    system: [request.system, '', 'STRICT OUTPUT RULES',
      'Return one JSON object matching the supplied schema. No markdown fences, comments, or prose outside the object.',
      'Preserve every field requested by the schema, including fields added by other features.',
      ...rules].join('\n')
  }
}

/** Strengthens the line object in place in the schema tree, preserving other mods' fields. */
function sceneFormat(schema: Schema): Schema {
  const properties = object(schema.properties)
  const lines = object(properties?.lines)
  const items = object(lines?.items)
  const fields = object(items?.properties)
  const bg = object(fields?.bg)
  if (!properties || !lines || !items || !fields || !bg) return schema

  const required = [...new Set([
    ...strings(items.required),
    ...['speaker', 'bg', 'actions', 'text'].filter((field) => Object.hasOwn(fields, field))
  ])]
  return {
    ...schema,
    properties: {
      ...properties,
      lines: {
        ...lines,
        items: {
          ...items,
          required,
          properties: {
            ...fields,
            bg: { ...bg, enum: [...new Set([...strings(bg.enum), 'unchanged'])] }
          }
        }
      }
    }
  }
}

/** The same hook receives openings, continuations, closings, and solo scenes. */
export function strictSceneRequest(request: StructuredRequest): StructuredRequest {
  let schema = sceneFormat(request.schema.schema)
  const properties = object(schema.properties)
  const fields = object(object(object(properties?.lines)?.items)?.properties)
  const hasActions = Boolean(fields && Object.hasOwn(fields, 'actions'))
  const hasEnd = Boolean(properties && Object.hasOwn(properties, 'end_scene'))
  const hasSummary = Boolean(properties && Object.hasOwn(properties, 'summary'))
  if (hasEnd && hasSummary) schema = {
    ...schema,
    required: [...new Set([...strings(schema.required), 'end_scene'])]
  }
  const rules = [
    'Every line carries "speaker", "bg", and "text". Use an empty speaker ("") for narration; otherwise copy an allowed character key exactly.',
    'Keep narration and dialogue on separate lines, and never leave "text" empty.',
    'Every line carries "bg". Set it to an allowed background where the scene begins or the reader arrives at a new location; use "unchanged" on other lines.',
    'A place mentioned in conversation is not a location change. Never put "bg" beside "lines".',
    'Use STORY SO FAR for earlier context and SCENE SO FAR for the recent sequence of events. Continue after the last line; do not replay events already shown.',
    'Use NOW as the starting state of the background and any visible characters.'
  ]
  rules.push(
    ...CONVERSATION_RULES,
    'This request writes the current in-person scene. Bunnyboard DMs are generated by a separate phone flow.',
    'TEXTING HISTORY and memories are established background, not new messages to perform. Characters may refer to them in person; do not replay them as a live chat.',
    'Do not invent incoming or outgoing DMs, phone conversations, message bubbles, or a "Her:"/"You:" text exchange inside scene narration.',
    'If the reader wants to use the phone, stop at that decision. Do not choose messages, send them, or invent replies on the reader\'s behalf.',
    'Stop this interaction when its final character departs. Do not continue through the reader\'s journey home, the rest of a shift, sleep, or a later conversation.',
    'A future invitation is a choice for the reader, not an accepted plan. Do not invent the reader accepting a date or making an appointment.',
    'Keep summaries grounded in the supplied transcript and the lines you actually write; do not add off-screen conversations or agreements.'
  )
  if (hasActions) rules.push(
    'Every line carries "actions": an array of allowed stage directions in application order. Use [] when nothing changes.',
    'Use "show:<charKey>" when a character enters, paired with an allowed "sprite:<charKey>,<sprite>" in the same array.',
    'Use "hide:<charKey>" on the line a character leaves, including when the reader walks away from her. Characters accompanying the reader stay shown.',
    'Whoever is not hidden stays on screen until hidden. Saying someone left in the text does not remove her sprite.',
    'Change a visible character\'s sprite when her feelings change. Preserve her outfit suffix until her clothes change, and keep the existing CG rules.',
    'Describing an entrance, exit, expression, or location change in text alone does not update the screen.'
  )
  if (hasEnd && hasSummary) rules.push(
    'Every continuation reply carries the top-level boolean "end_scene": false while the scene continues, true when it ends.',
    'If the scene is drawing to a close, give the characters a reason to part ways and set the top-level "end_scene" field to true.',
    'If the last character present leaves, set "end_scene" to true on that reply. Leave the full goodbye for the separate closing request.',
    'Never write end_scene as the text of a line or put it inside a line.'
  )
  else if (hasEnd) rules.push('This is the scene opening. Do not end it yet; omit "end_scene" or set it to false.')
  else rules.push('This schema has no "end_scene" field. Do not add one.')

  return withRules({ ...request, schema: { ...request.schema, schema } }, rules)
}

/** Leave the thread, summaries, photo instructions, and schema assembled by other mods intact. */
export function strictDmRequest(request: StructuredRequest, ctx?: RequestSpots['dm']): StructuredRequest {
  const cooldown = ctx && invitationCoolingDown(ctx.conversation, globalSlotOf(ctx.state.date, ctx.state.time))
  return withRules(request, [
    'Normally send 1 to 3 text bubbles, about 10 to 25 words each, aiming for at most 60 words total. A short acknowledgement can be much shorter. Keep her own texting voice.',
    'Respond to the latest reader message and focus on one topic. Do not add unrelated updates, repeat yourself, or fill space just because she is upset or excited.',
    ...CONVERSATION_RULES,
    'Ask a question or offer an invitation only once, then stop and let the reader respond.',
    'A longer reply is appropriate only when the reader asks for an explanation or the current topic genuinely needs one. Do not turn an ordinary text into a monologue.',
    'Respect a refusal or deferral in the latest reader message. Acknowledge it without asking again, pressuring him, or treating it as acceptance.',
    ...(cooldown ? ['The reader recently declined a hangout and her invitation cooldown is active. Do not initiate another invitation. He may change his mind and propose meeting himself; respond to that new proposal normally.'] : []),
    'Where she is, who is with her, and what she is doing are background. Once she has told the reader, do not announce the same whereabouts or activity again unless he asks, it changes, or it directly matters to his latest message.',
    'Do not repeat the reader\'s message back to him.',
    'Friends, places, and past events come from the supplied context. Do not invent people or shared history. Opinions, moods, and small details of the moment are fine.',
    'Saying she will come over is a plan, not an arrival.',
    'Her knowledge of the reader\'s timetable and job comes from their shared classes or what he has told her; do not treat every supplied schedule entry as something she personally knows.',
    'Write "messages" as an array of strings, one per text bubble. Do not put narration, stage actions, or JSON objects inside a bubble.',
    'Keep photo and other feature instructions whenever their fields are present in the supplied schema.'
  ])
}

/** Posts share a request with slot narration, invitations, and breakups. */
export function strictFeedRequest(request: StructuredRequest): StructuredRequest {
  return withRules(request, [
    'For "posts", write each status update in its author\'s voice and copy the author\'s character key exactly from the supplied poster list.',
    'Keep status text inside the post\'s "text" field. Follow the supplied image and comment instructions when those fields are present.',
    'Do not put feed posts inside narration "lines", or replace invitations and breakups with posts.',
    'Use only the supplied context for people, past events, and relationships; do not invent shared history.'
  ])
}
