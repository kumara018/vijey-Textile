/**
 * Renderer + device capability detection.
 *
 * Runs once, in the browser, before any scene mounts. Everything downstream
 * (mesh density, postprocessing stack, physics, pixel ratio) reads the tier
 * this produces rather than sniffing the device again.
 *
 * Deliberately conservative: this ships to a live store whose traffic is
 * mostly mid-range Android. When a signal is ambiguous we tier *down*.
 */

export type QualityTier = 'off' | 'low' | 'medium' | 'high';
export type RendererKind = 'webgpu' | 'webgl2' | 'webgl' | 'none';

export interface Capabilities {
  renderer: RendererKind;
  tier: QualityTier;
  /** User asked the OS for less motion — honoured everywhere, never overridden. */
  reducedMotion: boolean;
  maxPixelRatio: number;
  /** Unmasked GPU string when the driver exposes it; diagnostics only. */
  gpu: string | null;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
}

/** WebGPU is async to detect — an adapter request can genuinely fail. */
async function detectWebGPU(): Promise<boolean> {
  const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } };
  if (!nav.gpu) return false;
  try {
    const adapter = await nav.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

function detectWebGL(): { kind: RendererKind; gpu: string | null } {
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    gl = gl2 || canvas.getContext('webgl');
    if (!gl) return { kind: 'none', gpu: null };

    let gpu: string | null = null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const raw = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      if (typeof raw === 'string') gpu = raw;
    }
    return { kind: gl2 ? 'webgl2' : 'webgl', gpu };
  } catch {
    return { kind: 'none', gpu: null };
  } finally {
    // Hand the probe context back immediately rather than waiting for GC to
    // collect the detached canvas. Browsers allow only a handful of live WebGL
    // contexts (~8-16) and force-lose the oldest once that cap is reached —
    // which would be the real scene's context. Holding one hostage for the
    // life of the page to answer a question we answered in a millisecond is
    // not a trade worth making.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/**
 * Known-weak GPU families. Matching here forces the low tier regardless of
 * what the other signals say — these parts report plausible core counts and
 * still cannot hold 60fps with postprocessing on.
 */
const WEAK_GPU = /(Mali-[GT]?[0-5]\d{2}|Adreno \(TM\) [123]\d{2}|PowerVR|Videocore|SwiftShader|llvmpipe|Software)/i;

function scoreTier(opts: {
  renderer: RendererKind;
  gpu: string | null;
  memory: number | null;
  cores: number | null;
  smallViewport: boolean;
  reducedMotion: boolean;
}): QualityTier {
  const { renderer, gpu, memory, cores, smallViewport, reducedMotion } = opts;

  if (renderer === 'none') return 'off';
  // Reduced motion still renders — it just renders a calm, static scene, so it
  // stays on the cheapest path rather than dropping 3D entirely.
  if (reducedMotion) return 'low';
  if (gpu && WEAK_GPU.test(gpu)) return 'low';
  // Software rasterisation reports as WebGL but runs on the CPU.
  if (renderer === 'webgl') return 'low';

  if (memory !== null && memory <= 2) return 'low';
  if (cores !== null && cores <= 2) return 'low';

  if (smallViewport) return memory !== null && memory >= 6 ? 'medium' : 'low';
  if (memory !== null && memory <= 4) return 'medium';
  if (cores !== null && cores <= 4) return 'medium';

  return 'high';
}

export async function detectCapabilities(): Promise<Capabilities> {
  if (typeof window === 'undefined') {
    return {
      renderer: 'none', tier: 'off', reducedMotion: false,
      maxPixelRatio: 1, gpu: null, deviceMemoryGb: null, hardwareConcurrency: null,
    };
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smallViewport = window.matchMedia('(max-width: 768px)').matches;

  const nav = navigator as Navigator & { deviceMemory?: number };
  const deviceMemoryGb = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
  const hardwareConcurrency =
    typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null;

  const { kind: glKind, gpu } = detectWebGL();

  // WebGPU is only worth claiming if WebGL also works — if the GL probe failed
  // outright the device is in no state to run a scene either way.
  let renderer: RendererKind = glKind;
  if (glKind !== 'none' && (await detectWebGPU())) renderer = 'webgpu';

  const tier = scoreTier({
    renderer, gpu, memory: deviceMemoryGb, cores: hardwareConcurrency,
    smallViewport, reducedMotion,
  });

  // Retina at full DPR doubles fragment cost for no perceived gain on a
  // backdrop scene; cap harder the weaker the tier.
  const maxPixelRatio = tier === 'high' ? 2 : tier === 'medium' ? 1.5 : 1;

  return {
    renderer, tier, reducedMotion, maxPixelRatio,
    gpu, deviceMemoryGb, hardwareConcurrency,
  };
}

/** Per-tier budget. Scenes read this instead of branching on tier inline. */
export interface TierBudget {
  postprocessing: boolean;
  bloom: boolean;
  depthOfField: boolean;
  ssao: boolean;
  chromaticAberration: boolean;
  /** Volumetric shafts. Hero scenes only — it is the most expensive pass here. */
  godRays: boolean;
  /** Film-print grade. Cheap (one 3D texture lookup) so it survives low tier. */
  lut: boolean;
  /** Film grain. Cheap, and the single biggest cue against a sterile render. */
  grain: boolean;
  physics: boolean;
  shadows: boolean;
  /** Multiplier applied to segment counts / instance counts. */
  geometryScale: number;
  particles: number;
}

/**
 * Note the deliberate asymmetry: `lut` and `grain` stay on at low tier while
 * bloom, DoF, SSAO and god rays are off.
 *
 * Those two are effectively free — a 17³ texture lookup and a hash per pixel,
 * with no extra render target between them — and they carry most of what makes
 * the image read as film rather than as a browser rendering triangles. Dropping
 * them first would cost the entire look to save almost nothing. The expensive
 * passes are the ones that allocate and resample full-screen buffers.
 */
export const TIER_BUDGETS: Record<QualityTier, TierBudget> = {
  off:    { postprocessing: false, bloom: false, depthOfField: false, ssao: false, chromaticAberration: false, godRays: false, lut: false, grain: false, physics: false, shadows: false, geometryScale: 0,    particles: 0 },
  low:    { postprocessing: true,  bloom: false, depthOfField: false, ssao: false, chromaticAberration: false, godRays: false, lut: true,  grain: true,  physics: false, shadows: false, geometryScale: 0.4,  particles: 0 },
  medium: { postprocessing: true,  bloom: true,  depthOfField: true,  ssao: false, chromaticAberration: false, godRays: false, lut: true,  grain: true,  physics: false, shadows: true,  geometryScale: 0.7,  particles: 120 },
  high:   { postprocessing: true,  bloom: true,  depthOfField: true,  ssao: true,  chromaticAberration: true,  godRays: true,  lut: true,  grain: true,  physics: true,  shadows: true,  geometryScale: 1,    particles: 400 },
};

/**
 * Strips every postprocessing pass while leaving geometry untouched.
 *
 * This is the governor's *first* downgrade step. The full-screen passes are
 * where the cost is — they scale with pixel count, which is exactly what hurts
 * on the high-DPI displays this pass targets — so surrendering the grade buys
 * far more frame time than thinning meshes, and it is much less visible than
 * watching the scene itself lose detail.
 */
export function withoutEffects(budget: TierBudget): TierBudget {
  return {
    ...budget,
    postprocessing: false,
    bloom: false,
    depthOfField: false,
    ssao: false,
    chromaticAberration: false,
    godRays: false,
    lut: false,
    grain: false,
  };
}

/**
 * Reduced motion strips the passes that move or shimmer independently of the
 * scene — grain crawls every frame and chromatic aberration swims at the edges.
 * The grade and a static vignette stay: they are still images, and removing
 * them would make the reduced-motion path look broken rather than calm.
 */
export function forReducedMotion(budget: TierBudget): TierBudget {
  return {
    ...budget,
    grain: false,
    chromaticAberration: false,
    godRays: false,
  };
}
