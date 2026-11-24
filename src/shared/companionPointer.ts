export interface CompanionPoint { x: number; y: number }
export interface PointerRect { x: number; y: number; width: number; height: number }
export function companionPoint(value: unknown): CompanionPoint | null {
  if (!value || typeof value !== 'object') return null
  const p = value as CompanionPoint
  return typeof p.x === 'number' && Number.isFinite(p.x) && p.x >= 0 && p.x <= 1 &&
    typeof p.y === 'number' && Number.isFinite(p.y) && p.y >= 0 && p.y <= 1 ? { x: p.x, y: p.y } : null
}
export function pointInRect(point: CompanionPoint, rect: PointerRect): CompanionPoint {
  return { x: Math.round(rect.x + point.x * Math.max(0, rect.width - 1)), y: Math.round(rect.y + point.y * Math.max(0, rect.height - 1)) }
}
/** Do not point at a stale image after a window moves, resizes, or changes monitors. */
export function samePointerRect(a: PointerRect, b: PointerRect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}
