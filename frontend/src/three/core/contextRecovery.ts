/**
 * WebGL context loss recovery.
 *
 * Context loss is not an edge case. A browser will drop the context when the
 * GPU driver resets, when the tab is backgrounded on a memory-pressured phone,
 * when another tab claims too many contexts, or when the OS switches graphics
 * adapters on a laptop unplugging from power. On a persistent canvas that
 * outlives every route change, the odds of hitting one during a session are
 * high — and the default browser behaviour is to leave the canvas permanently
 * blank.
 *
 * Two rules make it survivable:
 *
 *   1. `preventDefault()` on `webglcontextlost` is what makes restoration
 *      possible at all. Without it the browser will never fire
 *      `webglcontextrestored` and the canvas is dead for the session.
 *   2. Every GPU resource has to be re-created. The JS objects survive; the
 *      GPU-side buffers, textures and compiled programs do not. three.js
 *      handles most of this via its own restore path, but anything cached
 *      outside the renderer must be told to rebuild.
 *
 * Meanwhile the site keeps working, because the canvas is decoration: the
 * poster image behind it and every piece of DOM above it are untouched by a
 * lost context.
 */

export interface RecoveryHandlers {
  onLost?: () => void;
  onRestored?: () => void;
  /** Called when restoration has failed repeatedly and we stop trying. */
  onFatal?: () => void;
}

/**
 * Repeated loss usually means the GPU genuinely cannot sustain the scene.
 * Endlessly restoring into another crash burns battery and hangs the tab; after
 * this many we stay down and let the static layers carry the page.
 */
const MAX_RECOVERIES = 3;

export function attachContextRecovery(
  canvas: HTMLCanvasElement,
  handlers: RecoveryHandlers = {},
): () => void {
  let recoveries = 0;

  const onLost = (e: Event) => {
    // Without this the browser never offers restoration.
    e.preventDefault();
    recoveries++;
    console.warn(`[3D] WebGL context lost (${recoveries}/${MAX_RECOVERIES})`);
    handlers.onLost?.();

    if (recoveries > MAX_RECOVERIES) {
      console.warn('[3D] context lost repeatedly — staying on the static layer');
      handlers.onFatal?.();
    }
  };

  const onRestored = () => {
    if (recoveries > MAX_RECOVERIES) return;
    console.warn('[3D] WebGL context restored — rebuilding scene resources');
    handlers.onRestored?.();
  };

  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  return () => {
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
  };
}

/**
 * Is WebGL usable at all?
 *
 * Distinct from the capability tiering, which asks "how much can this device
 * afford". This asks "is there a renderer here", and a false answer must route
 * to the no-WebGL path rather than to a low tier — a low tier still tries to
 * create a context.
 *
 * The probe context is released immediately: browsers cap live contexts at
 * roughly 8-16 and force-lose the oldest at the cap, which would be the real
 * scene's.
 */
export function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    const c = document.createElement('canvas');
    gl = c.getContext('webgl2') || c.getContext('webgl');
    return !!gl;
  } catch {
    return false;
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/**
 * Does this device compile a non-trivial shader in reasonable time?
 *
 * Some drivers — older Android, some virtualised desktops — accept a shader,
 * report success, and take several seconds doing it, freezing the main thread.
 * That is worse than not rendering: the page is unresponsive during the stall
 * and the visitor cannot scroll or tap.
 *
 * Compiling one representative shader and timing it catches that before the
 * real scene is built.
 */
export function shaderCompileHealthy(budgetMs = 220): boolean {
  if (typeof document === 'undefined') return false;
  let gl: WebGLRenderingContext | null = null;
  try {
    const c = document.createElement('canvas');
    gl = c.getContext('webgl');
    if (!gl) return false;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vs || !fs) return false;

    // Deliberately not trivial: a loop and a few transcendentals, so a driver
    // that is slow on real work is slow here too.
    gl.shaderSource(vs, 'attribute vec3 p;void main(){gl_Position=vec4(p,1.0);}');
    gl.shaderSource(fs, `
      precision highp float;
      void main(){
        float a = 0.0;
        for (int i = 0; i < 24; i++) { a += sin(float(i) * 1.7) * cos(float(i) * 0.3); }
        gl_FragColor = vec4(vec3(a * 0.02 + 0.5), 1.0);
      }
    `);

    const started = performance.now();
    gl.compileShader(vs);
    gl.compileShader(fs);

    const program = gl.createProgram();
    if (!program) return false;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    // getProgramParameter forces the driver to finish — without a query, many
    // drivers compile lazily and the timing measures nothing at all.
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    const elapsed = performance.now() - started;

    if (!linked) return false;
    if (elapsed > budgetMs) {
      console.warn(`[3D] shader compile took ${elapsed.toFixed(0)}ms — skipping the 3D layer`);
      return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
