import type { ModOption } from '../bridge/shared'

/** Refuses malformed same-mod requirements before any options are used. */
export function optionDependencyError(options: readonly ModOption[]): string | undefined {
  for (const option of options) {
    if (option.requires === undefined) continue
    if (typeof option.requires !== 'string') return `option ${option.id} has a "requires" that is not a string`
    const required = options.find((entry) => entry.id === option.requires)
    if (!required) return `option ${option.id} requires option ${option.requires}, which "options" does not have`
    if (required.id === option.id) return `option ${option.id} requires itself`
    if (option.group !== undefined) return `option ${option.id} belongs to a group and cannot require an option`
    if (required.group !== undefined) return `option ${option.id} requires grouped option ${required.id}`
  }
  for (const option of options) {
    const seen = new Set<string>()
    let next: ModOption | undefined = option
    while (next) {
      if (seen.has(next.id)) return `option ${option.id} has a requirement cycle`
      seen.add(next.id)
      next = options.find((entry) => entry.id === next?.requires)
    }
  }
  return undefined
}
