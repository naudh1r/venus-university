import profile from './webpProfile.json'

/**
 * How every picture the app keeps is encoded: WebP at the quality the release transcodes the
 * shipped cast at (0–100), its alpha plane kept exact, at a middling encoder effort (0–6). The
 * JSON beside this file is the one definition, which the release's transcode reads as well.
 */
export const WEBP_PROFILE: { quality: number; alphaQuality: number; effort: number } = profile
