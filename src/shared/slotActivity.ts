import type { StatKey } from './playerStats'

/** A mod-owned activity chosen on the landing, before the scene is cast. */
export interface SlotActivityOffer {
  owner: string
  id: string
  label: string
  location: string
  stat: StatKey
}

/** Saved with the scene; only the slot boundary applies its reward. */
export interface SlotActivity extends SlotActivityOffer {
  status: 'pending' | 'completed' | 'abandoned'
  result?: string
}

/** Whether a scene ends now: one committed to an activity ends once it is settled, and not before. */
export function activityEnding(activity: SlotActivity | null | undefined, ordinary: boolean): boolean {
  return activity ? activity.status !== 'pending' : ordinary
}
