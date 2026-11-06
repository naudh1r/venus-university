import { recordField } from '@vx/modkit/renderer'
import { normalizePhoto, type ChatPhoto } from '../../shared/photoTypes'

const spec = { empty: null, legacy: ['photo'], normalize: normalizePhoto }
export const messagePhoto = recordField<ChatPhoto | null>('photo-feature', spec)
export const postPhoto = recordField<ChatPhoto | null>('photo-feature', spec)
