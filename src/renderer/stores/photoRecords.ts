import { recordField } from '@vx/modkit/renderer'
import { normalizePhoto, type ChatPhoto } from '../../shared/photoTypes'
import { PHOTO_FEATURE_ID } from '../../shared/photoSwitches'

const spec = { empty: null, legacy: ['photo'], normalize: normalizePhoto }
export const messagePhoto = recordField<ChatPhoto | null>(PHOTO_FEATURE_ID, spec)
export const postPhoto = recordField<ChatPhoto | null>(PHOTO_FEATURE_ID, spec)
