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
  /** Set once the reply to its closing turn has landed: from then on the scene runs as any other. */
  closed?: true
}

/**
 * Whether a scene ends now: one committed to an activity is held open until it is settled and
 * ends on the reply to its closing turn. Once closed, as when the reader talks over that ending,
 * the reply decides as it would in any scene.
 */
export function activityEnding(activity: SlotActivity | null | undefined, ordinary: boolean): boolean {
  return activity && !activity.closed ? activity.status !== 'pending' : ordinary
}
