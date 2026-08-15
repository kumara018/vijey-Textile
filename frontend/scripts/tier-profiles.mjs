/**
 * The tier ladder, in a form the Node encoder can import.
 *
 * Mirrors TIER_PROFILES in src/three/core/deliveryTier.ts. It is duplicated
 * rather than imported because the encoder is plain Node and the source is TS
 * inside the Next build graph — but the two must not drift, so the runtime
 * asserts against the generated manifests and fails loudly if they disagree.
 */
export const TIER_PROFILES_JSON = [
  { tier: 'minimal',  frames: 1,   width: 960,  quality: 58 },
  { tier: 'light',    frames: 24,  width: 1280, quality: 60 },
  { tier: 'standard', frames: 48,  width: 1600, quality: 66 },
  { tier: 'rich',     frames: 72,  width: 2048, quality: 72 },
  { tier: 'maximum',  frames: 120, width: 3840, quality: 82 },
];
