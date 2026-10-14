import type { StructuredRequest } from '@shared/types'
import { globalSlotOf } from '@shared/jobs'
import type { RequestSpots } from '../hooks'
import { hasActiveHooks } from '../hooks'
import { invitationCoolingDown } from './hangoutPolicy'

type Schema = Record<string, unknown>

const CONVERSATION_RULE = 'Follow the reader\'s current subject in her own voice; continue active discussions and follow subject changes naturally. Memories shape her tone without repeatedly reopening old grievances or paraphrasing earlier dialogue. Respect established resolutions without inventing forgiveness. Repeat a detail only when asked or newly relevant; do not invent people or shared history.'

const PLAN_RULES = [
  'Calendar "plans" are only agreed in-person activities involving the reader and at least one other person, at an established physical location and a specific future day/night slot from SLOTS. A room, cafe, or landmark counts; do not invent a destination or agreement to complete a vague suggestion.',
  'Exclude promises to text, message, call, video-call, send a photo, or chat online, even with a specific future time. Existing duplicate, cancelled, refused, timetable-only, and past/current-slot plans remain excluded. Use "plans": [] when nothing qualifies.',
  'Write each "title" as a concise action the reader will take: the game submits this title as the reader\'s action. Preserve who hosts and who travels. Guests coming to the reader: "Host April and Livvie in your room". Reader going to her: "Visit April in her room". Meeting elsewhere: "Meet April and Livvie at the cafe". These are format examples, not new people or plans.',
  'The one-sentence "description" preserves all agreed attendees, the physical destination and its owner, the activity, and the agreed time. Never reverse who visits whom. "chars" lists every agreed attendee except the reader using supplied keys; "slot" is the matching supplied future slot. Do not turn an already agreed plan into a fresh invitation.'
] as const

/** Keep ledger memories as event clauses and preserve the base ledger's thinking floor. */
export function strictLedgerRequest(request: StructuredRequest): StructuredRequest {
  return withRules(request, [
    'Memory "desc" is one concise past-tense event clause completing "<Name> <type> that ...". Omit the supplied name/reaction prefix, a leading "that", and "remembers that" introductions. Use "the reader" and "the reader\'s", never second-person or he/his pronouns for the reader.',
    'Correct desc: "the reader interrupted her explanation". Incorrect: "Gwen remembers that you interrupted her explanation".',
    'Ground each event and reaction type in the supplied scene or messages; omit memories without a meaningful supported reaction. Add a short reason if needed, without retelling the scene or inventing resentment or affection. Preserve the other ledger instructions for stats and events.',
    ...(object(object(request.schema.schema.properties)?.plans) ? PLAN_RULES : [])
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
      'Return only one JSON object matching the supplied schema, preserving other features\' fields and instructions. No markdown, comments, or outside prose.',
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

/** Describe CG transitions using only the actions already offered by the base request. */
function sceneCgRules(fields: Schema): string[] {
  const items = object(object(fields.actions)?.items)
  if (!Array.isArray(items?.enum)) return []
  const offered = strings(items.enum).filter(action => action.startsWith('cg:'))
  if (offered.length === 0) return ['No CG actions are offered in this request. Do not invent a CG action or name.']
  const act = offered.find(action => !action.endsWith('_after'))
  const after = act && offered.includes(`${act}_after`) ? `${act}_after` : undefined
  return [
    'CG staging: when an act is actually happening on screen and matches an offered CG, put its exact "cg:<name>" action in the line where the act begins or changes. Prose alone does not switch the image. Mentioning, remembering, or proposing an act does not trigger a CG. Follow the base act descriptions and custom CG instructions; use only names in the actions enum, without adding a character key.',
    'A CG belongs to the one character currently shown and needs her available assets. Never hide companions merely to make a CG possible. When more than one character is on screen, keep normal staging; showing another character ends the CG.',
    'Keep an active CG through dialogue and expression changes: use [] when nothing changes, not "sprite:". On climax use that act\'s offered "_after" CG; a new act uses its matching offered CG. Do not invent an unavailable aftermath. Restore an allowed sprite for her current clothing only when the act is over. If entrance actions and a CG share a line, order them show, sprite, then CG; a sprite after CG would overwrite it.',
    ...(act ? [after
      ? `Action-format example only, when those events occur: act begins with ${JSON.stringify([act])}; unchanged image uses []; climax uses ${JSON.stringify([after])}. Never trigger the example act merely because it is listed.`
      : `Action-format example only, when its matching act occurs: ${JSON.stringify([act])}. Keep the image with [] on unchanged lines; never trigger the example act merely because it is listed.`] : [])
  ]
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
    'Each line has "speaker", "bg", and nonempty "text". Separate narration (speaker "") from dialogue (an exact allowed character key).',
    'Set line "bg" to an allowed background at the opening or an actual location change; otherwise use "unchanged". Mentioning a place is not moving there. Never put "bg" beside "lines".',
    'Start from NOW, use STORY SO FAR as background, and continue after SCENE SO FAR without replaying it.',
    'For scheduled visits, preserve the agreed host, destination, and who travels. If guests are coming to the reader\'s room and he is already there, he stays there to receive them; do not narrate him visiting his own room or travelling to theirs. A planned attendee\'s class or shift can be before or after this meeting as the supplied commitment notes allow; it does not itself cancel the agreement.',
    CONVERSATION_RULE
  ]
  rules.push(
    'Write only the current scene. TEXTING HISTORY is established context, not a live chat to replay. New DMs and phone conversations belong to the separate phone flow; stop at the reader\'s decision to use it. Do not choose his messages or accept invitations or future plans for him.',
    'Follow the base summary coverage rules, using only established events; do not invent off-screen conversations or agreements.'
  )
  if (hasActions && fields) rules.push(
    'Each line has an "actions" array in application order; use [] for no change. Entrances need "show:<charKey>" plus an allowed "sprite:<charKey>,<sprite>" in the same array. Departures need "hide:<charKey>", including when the reader leaves her behind; companions stay shown.',
    'Use sprite actions for expression changes outside an active CG, retaining the outfit suffix until clothes change and following the existing CG rules. Prose alone never updates the stage; a character stays visible until hidden.',
    'Stop after the final character departs; do not add a journey home, the rest of a shift, sleep, or another conversation. A cast handoff within the current scene may hide one character then show another on a later line; that temporary empty stage is not an ending.',
    ...sceneCgRules(fields)
  )
  if (hasEnd && hasSummary) rules.push(
    'Continuation replies require top-level "end_scene": false while continuing, true when ending or the final character leaves. Give parting a reason and leave the full goodbye to the closing request; never put "end_scene" inside a line.'
  )
  else if (hasEnd) rules.push('This is the scene opening. Do not end it yet; omit "end_scene" or set it to false.')
  else rules.push('This schema has no "end_scene" field. Do not add one.')

  return withRules({ ...request, schema: { ...request.schema, schema } }, rules)
}

/** Leave the thread, summaries, photo instructions, and schema assembled by other mods intact. */
export function strictDmRequest(request: StructuredRequest, ctx?: RequestSpots['dm']): StructuredRequest {
  const cooldown = ctx && invitationCoolingDown(ctx.conversation, globalSlotOf(ctx.state.date, ctx.state.time))
  const fields = object(request.schema.schema.properties)
  const photo = hasActiveHooks('photo-feature') && ['sendPhoto', 'photoPrompt', 'photoTier'].every(key => fields && Object.hasOwn(fields, key))
  return withRules(request, [
    'Normally reply in 1–3 bubbles of about 10–25 words each, aiming for at most 60 words total; acknowledgements may be shorter. Expand when an explanation is requested or needed.',
    ctx?.incomingDirection === undefined
      ? 'Focus on the latest message without echoing it, adding unrelated updates, or filling space.'
      : 'Initiate the texts as directed by WRITING DIRECTION; it is not a message from the reader or an event to remember. Earlier conversation is background, not a new message to answer.',
    CONVERSATION_RULE,
    'Treat whereabouts, companions, and activities as background; do not reannounce unchanged details already given. Small current details are fine. Her knowledge of the reader\'s work and timetable comes from shared classes or what he told her, not every supplied schedule entry.',
    'Ask or invite once, then wait. Respect refusals and deferrals without pressure or assuming acceptance. Plans to come over are not arrivals.',
    ...(cooldown ? ['Invitation cooldown is active: do not initiate another hangout. If the reader changes his mind and proposes meeting, respond normally.'] : []),
    'Write "messages" as an array of strings, one per bubble: no narration, stage actions, or nested objects. Preserve supplied photo instructions and fields.',
    ...(photo ? ['Photo fields: use a boolean "sendPhoto", a string "photoPrompt", and an allowed "photoTier". Without an attachment use false, "", and "none". Attach only when the supplied photo instructions allow it; then use true, a nonempty one-sentence picture brief, and a permitted tier. The text bubbles must fit the attachment without narrating its contents.'] : [])
  ])
}

/** Posts share a request with slot narration, invitations, and breakups. */
export function strictFeedRequest(request: StructuredRequest, ctx?: RequestSpots['slot-intro']): StructuredRequest {
  const original = request.schema.schema
  const properties = object(original.properties)
  const posts = object(properties?.posts)
  const items = object(posts?.items)
  const fields = object(items?.properties)
  const char = object(fields?.char)
  const comments = object(fields?.comments)
  const commentItem = object(comments?.items)
  const commentFields = object(commentItem?.properties)
  const namedComments = commentItem?.type === 'object' && Boolean(commentFields?.from && commentFields?.text)
  const keys = ctx ? [...new Set(ctx.input.posters.map(poster => poster.charKey))] : undefined
  const photo = hasActiveHooks('photo-feature') && fields && Object.hasOwn(fields, 'image') && Object.hasOwn(fields, 'comments')
  let schema = original
  if (properties && posts && items && fields && (keys || photo)) {
    schema = {
      ...original,
      ...(keys?.length ? { required: [...new Set([...strings(original.required), 'posts'])] } : {}),
      properties: {
        ...properties,
        posts: {
          ...posts,
          ...(keys ? { minItems: keys.length, maxItems: keys.length } : {}),
          items: {
            ...items,
            properties: {
              ...fields,
              ...(keys?.length && char ? { char: { ...char, enum: keys } } : {}),
              ...(photo && comments?.type === 'array' ? { comments: {
                ...comments, maxItems: Math.min(typeof comments.maxItems === 'number' ? comments.maxItems : 5, 5)
              } } : {})
            }
          }
        }
      }
    }
  }
  return withRules(schema === original ? request : { ...request, schema: { ...request.schema, schema } }, [
    'Write "posts" in each author\'s voice with an exact supplied poster key and status text in "text". Preserve image and comment instructions; keep posts separate from narration, invitations, and breakups.',
    'Ground people, past events, and relationships in supplied context; do not invent shared history.',
    ...(keys?.length ? [`Produce exactly one post per selected key, with no duplicates: ${JSON.stringify(keys)}.`] : []),
    ...(photo ? [
      'Each post has "image" as a string and "comments" as an array of at most five items in the supplied schema. "image" is only a visual description, never a filename, URL, JSON object, or image-generation tags. The engine adds character appearance and renders it. For text-only posts or disabled photos use "image": ""; for no comments use "comments": [].',
      ...(namedComments ? ['Each comment is an object with "from" and "text", following the supplied author rules. Do not substitute strings for comment objects.']
        : commentItem?.type === 'string' ? ['Each comment is a string; do not substitute comment objects.'] : []),
      'When a photo is permitted, describe one coherent shot in one complete sentence: generic setting, clothes, pose or activity, and framing. Follow Photo Feature\'s public-photo and solo-person rules. Keep the post text and comments consistent with that specific post and picture; do not add usernames or handles.',
      ...(keys?.length ? [
        'Format example for a permitted photo (illustrative only; do not copy its content): ' + JSON.stringify({
          char: keys[0], text: 'finally taking a break',
          image: 'A young woman wearing a cream sweater sits alone beside a cafe window, holding a coffee cup in a waist-up shot.',
          comments: namedComments ? [{ from: '', text: 'that coffee looks good' }]
            : commentItem?.type === 'string' ? ['that coffee looks good'] : []
        })
      ] : [])
    ] : [])
  ])
}

/** Tighten the existing paper schema without changing selected facts or other mod fields. */
export function strictQuizRequest(request: StructuredRequest, ctx: RequestSpots['quiz']): StructuredRequest {
  const original = request.schema.schema
  const properties = object(original.properties)
  const questions = object(properties?.questions)
  const items = object(questions?.items)
  const fields = object(items?.properties)
  let schema = original
  if (properties && questions && items && fields) {
    const strengthened = { ...fields }
    for (const key of ['question', 'a', 'b', 'c', 'd']) {
      const field = object(fields[key])
      if (field?.type === 'string') strengthened[key] = {
        ...field, minLength: Math.max(typeof field.minLength === 'number' ? field.minLength : 1, 1)
      }
    }
    schema = {
      ...original,
      required: [...new Set([...strings(original.required), 'questions'])],
      properties: { ...properties, questions: {
        ...questions, minItems: ctx.facts.length, maxItems: ctx.facts.length,
        items: { ...items,
          required: [...new Set([...strings(items.required), ...['question', 'a', 'b', 'c', 'd', 'correct'].filter(key => Object.hasOwn(fields, key))])],
          properties: strengthened
        }
      } }
    }
  }
  return withRules(schema === original ? request : { ...request, schema: { ...request.schema, schema } }, [
    `Return exactly ${ctx.facts.length} questions, one per supplied fact in FACTS order. Test only that fact, without adding unsupported claims or facts from other questions.`,
    'Each question has nonempty string fields "question", "a", "b", "c", "d", and "correct". Make the four answer texts distinct; exactly one is supported by the fact. Distractors must be plausible but clearly wrong for that question. Avoid ambiguous questions, overlapping answers, and "all/none of the above".',
    '"correct" is exactly "A", "B", "C", or "D" and points to the supported option before the engine shuffles it. Check the answer against the supplied fact. Return no explanation, answer commentary, letter prefixes inside options, or additional questions.'
  ])
}
