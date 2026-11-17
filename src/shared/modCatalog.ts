/** Plain catalogue values crossing the mods IPC boundary. */
export interface CatalogRelease {
  version: string
  url: string
  sha256: string
  kit: string
  game?: string
  main: boolean
  reviewed: boolean
  released: string
  changes: string[]
  incompatible: string | null
}
export interface CatalogMod {
  id: string
  name: string
  author: string
  blurb: string
  source: string
  cover?: string
  coverData?: string
  /** In-game screenshots, in the catalogue's order, each with an optional caption. */
  screenshots?: { url: string; caption?: string }[]
  /** The screenshots main could fetch, as data URLs; one that failed is left out. */
  screenshotData?: { src: string; caption?: string }[]
  changelog: { version: string; changes: string[] }[]
  releases: CatalogRelease[]
  installedVersion: string | null
}
