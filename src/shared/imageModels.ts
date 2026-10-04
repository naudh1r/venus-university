/**
 * The checkpoint and LoRA every ComfyUI job draws with, and the LoRA's trigger word: picked on
 * the setup screen, and written into each graph the moment it is sent, so no workflow file has to
 * name them. A field left unset is this branch's own pick, the Dasiwa checkpoint with the Niji
 * semi-realism LoRA.
 */

declare module './types' {
  interface Settings {
    /** File name under ComfyUI's `models/checkpoints`. Absent is {@link DEFAULT_IMAGE_MODELS}. */
    imageCheckpoint?: string
    /** File name under ComfyUI's `models/loras`. Absent is {@link DEFAULT_IMAGE_MODELS}. */
    imageLora?: string
    /** How hard the LoRA pulls, model and clip alike. Absent is 1. */
    imageLoraStrength?: number
    /** Leads every positive prompt; empty is none. Absent is the default LoRA's trigger. */
    imageTrigger?: string
  }
}

/** What a job draws with, every field settled. */
export interface ImageModels {
  checkpoint: string
  lora: string
  strength: number
  trigger: string
}

export const DEFAULT_IMAGE_MODELS: ImageModels = {
  checkpoint: 'DasiwaIllustriousAnime_epitaphecstasy.safetensors',
  lora: 'Niji_Semi_realism_F_N_R_epoch_10.safetensors',
  strength: 1,
  trigger: 'SemiRrealism'
}

/** The slider's range, which is also what a stored strength is held to. */
export const LORA_STRENGTH = { min: 0, max: 2, step: 0.05 }

/** The files ComfyUI's loaders can open, as the model folders are listed for the picker. */
export const MODEL_FILE = /\.(safetensors|ckpt)$/i

interface StoredImageModels {
  imageCheckpoint?: string
  imageLora?: string
  imageLoraStrength?: number
  imageTrigger?: string
}

/** The stored picks, with the defaults where nothing was picked. */
export function imageModelsOf(stored: StoredImageModels | null | undefined): ImageModels {
  const strength = stored?.imageLoraStrength
  return {
    checkpoint: stored?.imageCheckpoint?.trim() || DEFAULT_IMAGE_MODELS.checkpoint,
    lora: stored?.imageLora?.trim() || DEFAULT_IMAGE_MODELS.lora,
    strength:
      typeof strength === 'number' && Number.isFinite(strength)
        ? Math.min(LORA_STRENGTH.max, Math.max(LORA_STRENGTH.min, strength))
        : DEFAULT_IMAGE_MODELS.strength,
    trigger: (stored?.imageTrigger ?? DEFAULT_IMAGE_MODELS.trigger).trim()
  }
}

type Workflow = Record<string, { class_type: string; inputs: Record<string, unknown> }>

/** The ids every `positive` input in the graph points at: the prompt and what carries it. */
function positiveIds(workflow: Workflow): Set<string> {
  const ids = new Set<string>()
  for (const node of Object.values(workflow)) {
    const link = node.inputs.positive
    if (Array.isArray(link) && link.length > 0) ids.add(String(link[0]))
  }
  return ids
}

/**
 * A copy of `workflow` drawing with `models`: every checkpoint loader opens the checkpoint, every
 * LoRA loader the LoRA at the strength, and every text encoder feeding a `positive` input leads
 * with the trigger. A prompt that already leads with it is left alone, so a graph sent twice
 * never says it twice.
 */
export function withImageModels<T extends Workflow>(workflow: T, models: ImageModels): T {
  const out = structuredClone(workflow)
  const positive = positiveIds(out)
  for (const [id, node] of Object.entries(out)) {
    if (node.class_type === 'CheckpointLoaderSimple') {
      node.inputs.ckpt_name = models.checkpoint
    } else if (node.class_type === 'LoraLoader') {
      node.inputs.lora_name = models.lora
      node.inputs.strength_model = models.strength
      node.inputs.strength_clip = models.strength
    } else if (models.trigger && positive.has(id) && typeof node.inputs.text === 'string') {
      const text = node.inputs.text.trimStart()
      if (!text.startsWith(models.trigger)) node.inputs.text = `${models.trigger}, ${text}`
    }
  }
  return out
}

/** The model files ComfyUI's loaders can see, as the picker lists them. */
export interface ModelFiles {
  checkpoints: string[]
  loras: string[]
}

declare module '../preload/api' {
  interface VenusUniversityApi {
    /** Desktop only: the browser draws in the cloud and has no model folders. */
    imageModels?: {
      list: () => Promise<import('./types').Result<ModelFiles>>
    }
  }
}
