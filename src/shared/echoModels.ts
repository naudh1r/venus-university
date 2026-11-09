import { PINNED_MODELS } from './setupManifest'

/** Download originals from their hosts; third-party weights are not relicensed as game source. */
export const ECHO_LOCAL_MODELS = [
  { label: 'Megaten Style by emerjk', destDir: 'loras', destFile: 'Megaten_Style.safetensors',
    url: 'https://civitai.com/api/download/models/1999790', bytes: 228517012,
    sha256: '9A4CB1ECCEABAA8A23767018D6DF59685D7E1E54CB01D411C3142F8652B9E097' },
  PINNED_MODELS.find(model => model.id === 'checkpoint')!
] as const
export const ECHO_LORA_PAGE = 'https://civitai.com/models/1767059/megaten-style-kazuma-kaneko'
