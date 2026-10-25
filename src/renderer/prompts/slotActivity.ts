import type { StructuredRequest } from '@shared/types'
import type { SlotActivity } from '@shared/slotActivity'

/** Tells the writer what a committed training activity allows: its arrival before play, its aftermath after. */
export function withSlotActivityPrompt(request: StructuredRequest, activity: SlotActivity | null): StructuredRequest {
  if (!activity || activity.closed) return request
  const instructions = activity.status === 'pending'
    ? `The reader committed this slot to: ${activity.label}. This is an interactive activity played on screen. Stage only the arrival and preparation at ${activity.location}. Do not play it out, invent moves or results, award stats, leave the location or close the slot. Stop before play begins. Other people present may talk or agree to join, but their consent is required. Set end_scene to false if that field is present.`
    : `The committed interactive activity is now settled: ${activity.result}. Write only a brief aftermath at the same location and close the scene. Do not replay the last move, restart the activity or invent another result. Stat rewards are handled by the engine; do not award any yourself. Set end_scene to true if that field is present.`
  return { ...request, system: `${request.system}\n\nCOMMITTED SLOT ACTIVITY\n${instructions}` }
}
