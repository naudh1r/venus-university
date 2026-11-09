/** A trusted mod's auxiliary page can use only its prescribed channel namespace. */
export const SURFACE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export function desktopChannel(owner: string, method: string): string {
  if (!SURFACE_NAME.test(owner) || !SURFACE_NAME.test(method)) throw Error('Invalid desktop surface channel')
  return `surface:${owner}:${method}`
}

/** Available as window.modSurface only in a host-created auxiliary window. */
export interface DesktopSurfaceBridge {
  invoke<T>(method: string, ...args: unknown[]): Promise<T>
  on<T extends unknown[]>(method: string, listener: (...values: T) => void): () => void
}
