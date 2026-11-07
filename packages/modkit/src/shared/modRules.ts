/** Shared code asks the lookup its side bound, without importing that side's stores. */
let isOn: (modId: string) => boolean = () => false

/**
 * Bind once at boot. The renderer's lookup reads the current switches and playthrough; main's
 * reads the switches it last read or wrote, and knows no playthrough.
 */
export function setSharedModRules(lookup: (modId: string) => boolean): void {
  isOn = lookup
}

/** Whether a mod is on, by its side's lookup. Before a side binds one, every mod reads as off. */
export function sharedModOn(modId: string): boolean {
  return isOn(modId)
}
