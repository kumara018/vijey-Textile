/**
 * CommonJS mirror of the tier ladder, for the build-time asset guard.
 *
 * The encoder is an ES module and the guard is CJS (it runs inside npm scripts
 * alongside the Tailwind check). Both mirror TIER_PROFILES in
 * src/three/core/deliveryTier.ts.
 */
exports.TIER_PROFILES_JSON = [
  { tier: 'minimal',  frames: 1,   width: 960,  quality: 58 },
  { tier: 'light',    frames: 24,  width: 1280, quality: 60 },
  { tier: 'standard', frames: 48,  width: 1600, quality: 66 },
  { tier: 'rich',     frames: 72,  width: 2048, quality: 72 },
  { tier: 'maximum',  frames: 120, width: 3840, quality: 82 },
];
