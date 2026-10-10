import type { StructuredRequest } from '@shared/types'

type Schema = Record<string, unknown>

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
export function strictDmRequest(request: StructuredRequest): StructuredRequest {
  return withRules(request, [
    'One short message is normal. Send more when the moment calls for it: she is upset, excited, or has a lot to say. Keep her own texting voice.',
    'Where she is and what she is doing are background: bring them up only when they matter.',
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
