import { hookNameKind } from './manifest'

/** A library's identity and the names its manifest exports. */
export interface LibraryExports {
  readonly name: string
  readonly version: string
  readonly exports?: readonly string[]
}

export interface LibraryExportProblem {
  readonly library: string
  readonly hook: string
  readonly message: string
}

/** The first declared library export missing from a library whose manifest is available. */
export function libraryExportProblem(
  hooks: readonly string[],
  libraryOf: (id: string) => LibraryExports | undefined
): LibraryExportProblem | null {
  for (const hook of hooks) {
    const kind = hookNameKind(hook)
    if (kind.kind !== 'export') continue
    const library = libraryOf(kind.library)
    if (!library || library.exports?.includes(kind.name)) continue
    return {
      library: kind.library,
      hook,
      message: `needs \`${hook}\`, which ${library.name} ${library.version} no longer has`
    }
  }
  return null
}
