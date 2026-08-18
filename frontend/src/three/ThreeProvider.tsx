'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { detectCapabilities } from './core/capabilities';
import { useSceneStore, sceneForPath } from '@/store/useSceneStore';
import { useDeliveryTier, isCaptureRender } from './core/useDeliveryTier';
import { webglAvailable, shaderCompileHealthy } from './core/contextRecovery';

/**
 * The canvas is client-only: R3F touches window/document at import time, and
 * SSR-ing it would both fail and ship the whole three.js bundle into the
 * server payload. ssr:false keeps it out of the critical path entirely.
 */
const CanvasHost = dynamic(() => import('./CanvasHost'), { ssr: false });

/** Scene graph is loaded separately so the canvas can mount before it. */
const SceneRouter = dynamic(() => import('./SceneRouter'), { ssr: false });

/**
 * Mounts once at the root layout and stays mounted for the life of the tab.
 *
 * Owns three things:
 *   1. capability detection (once, on mount)
 *   2. route → scene mapping, so navigation animates the existing scene
 *      instead of tearing the canvas down
 *   3. publishing scroll progress from native scroll (no smooth-scroll
 *      layer — see the note on that effect)
 */
export default function ThreeProvider() {
  const pathname = usePathname();
  const { profile } = useDeliveryTier();
  const setCapabilities = useSceneStore((s) => s.setCapabilities);
  const goToScene = useSceneStore((s) => s.goToScene);
  const capabilities = useSceneStore((s) => s.capabilities);

  // ── Capability detection, exactly once ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    /**
     * Two hard gates before any capability tiering happens.
     *
     * `webglAvailable` is distinct from tiering: tiering asks how much a
     * device can afford, this asks whether there is a renderer at all. A false
     * answer must route to the no-WebGL path, because even the lowest tier
     * still tries to create a context.
     *
     * `shaderCompileHealthy` catches drivers that accept a shader, report
     * success, and take seconds doing it — freezing the main thread. That is
     * worse than not rendering, because the page is unresponsive meanwhile and
     * the visitor cannot scroll or tap.
     */
    if (!webglAvailable() || !shaderCompileHealthy()) {
      setCapabilities({
        renderer: 'none', tier: 'off', reducedMotion: false,
        maxPixelRatio: 1, gpu: null, deviceMemoryGb: null, hardwareConcurrency: null,
      });
      return;
    }

    detectCapabilities().then((caps) => {
      if (!cancelled) setCapabilities(caps);
    });
    return () => { cancelled = true; };
  }, [setCapabilities]);

  // ── Route → scene ───────────────────────────────────────────────────
  useEffect(() => {
    goToScene(sceneForPath(pathname));
  }, [pathname, goToScene]);

  /**
   * Lenis smooth scroll — restored, with the actual bug fixed.
   *
   * Lenis was never the problem. TWO smoothers were: Lenis interpolating in
   * JavaScript AND `html { scroll-behavior: smooth }` interpolating in CSS,
   * both acting on the same scroll. Against a `position: sticky` hero whose
   * transform is driven by scroll offset, they disagreed every frame and the
   * result was judder. Removing Lenis removed the judder and the smoothness
   * together — the wrong half.
   *
   * So: Lenis stays, the CSS layer is gone (globals.css sets scroll-behavior
   * to auto, which Lenis requires), and everything scroll-driven now reads
   * ONE clock.
   *
   * `lerp: 0.1` rather than `duration: 1.05`. Duration-based easing keeps
   * animating for a fixed time after input stops, which is what made a drag
   * feel like it was catching up. Lerp converges proportionally — it tracks
   * the pointer closely and settles fast, which reads as smooth rather than
   * as lag.
   *
   * The scroll value is published to the store on Lenis's own event, so the
   * hero scrub, the scene fade and the sticky element are all driven by the
   * same number on the same frame. That single-clock rule is the whole fix.
   */
  useEffect(() => {
    if (!capabilities) return;
    // Honouring the OS preference beats any smooth-scroll nicety.
    if (capabilities.reducedMotion) return;

    let lenis: import('lenis').default | null = null;
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      lenis = new Lenis({
        lerp: 0.1,
        // Touch devices already scroll on the compositor; smoothing them adds
        // lag and fights momentum. Native touch, smoothed wheel.
        syncTouch: false,
      });

      lenis.on('scroll', ({ scroll, limit }: { scroll: number; limit: number }) => {
        ScrollTrigger.update();
        useSceneStore.getState().setScroll(limit > 0 ? scroll / limit : 0);
      });

      // One clock: Lenis is driven by GSAP's ticker rather than its own rAF.
      // Two independent loops drift by a frame and the scene judders against
      // the DOM — the same class of bug, one level down.
      const tick = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      cleanup = () => {
        gsap.ticker.remove(tick);
        lenis?.destroy();
        lenis = null;
      };
    })();

    return () => { cancelled = true; cleanup(); };
  }, [capabilities]);

  // Route changes reset scroll position. This mattered doubly under Lenis,
  // which held a virtual offset that survived navigation; on native scroll it
  // is still needed because a client-side transition does not reset it either.
  useEffect(() => {
    window.scrollTo(0, 0);
    useSceneStore.getState().setScroll(0);
  }, [pathname]);

  /**
   * The real-time canvas is a progressive enhancement layered over the
   * pre-rendered sequence, not the baseline.
   *
   * The sequence already carries the hero on every device. Mounting a WebGL
   * context on a rung that cannot afford it costs the frame budget twice —
   * once decoding frames, once rendering — for a layer that would immediately
   * be stripped by the governor anyway.
   */
  if (!profile.realtime) return null;

  /**
   * THE HOMEPAGE HERO IS THE SEQUENCE, AND ONLY THE SEQUENCE.
   *
   * Both surfaces stage the same garment: SequenceHero scrubs the
   * pre-rendered camera move, and the real-time scene stages the hero product
   * fed to it through useHeroStore. Below the `rich` rung only the sequence
   * runs, so the collision is invisible on most machines — but on a wide
   * viewport the tier resolves higher, the canvas mounts, and the page shows
   * the SAME photograph twice at once: the scaled sequence plate on top of a
   * full-bleed live copy behind it. Captured in a real GPU browser at
   * y=561 — the scaled plate and its border sitting over a larger duplicate.
   *
   * The sequence is the primary path by design: it was rendered offline with
   * the full postprocessing chain, at a quality the real-time path cannot
   * afford on a customer's integrated GPU. So on this one route the real-time
   * canvas has nothing to add and one clear way to hurt. Every other route
   * keeps its scene.
   */
  /**
   * THE HOMEPAGE RUNS THE LIVE SCENE. The sequence was the problem.
   *
   * The hero used to scrub a 120-frame image sequence against scroll, and that
   * is what the customer was seeing as "shaking". A scrubbed sequence advances
   * in DISCRETE STEPS: at 120 frames across the pinned section each frame owns
   * a slice of scroll, so the picture snaps from frame N to frame N+1 and every
   * snap is a visible jump of the camera. Two video frames a third of a second
   * apart showed the garment in noticeably different positions while the
   * headline sat still.
   *
   * That is a property of scrubbing, not of the artwork. It cannot be fixed by
   * re-rendering, by recolouring, or by changing the scale — I tried the first
   * two and they addressed the wrong layer entirely. The only real cures are
   * hundreds more frames (enormous, and still stepped), cross-fading every pair
   * (expensive per frame), or not stepping at all.
   *
   * A live WebGL scene does not step. It draws on every animation frame, so the
   * camera move is continuous by construction — which is exactly what the
   * reference sites do. It also means the palette is now a value in a file
   * rather than something baked into 540 images, so a colour change costs
   * seconds instead of ninety minutes.
   *
   * Devices that cannot afford it still get the poster: `profile.realtime` is
   * false below the `rich` rung and this returns null there, leaving
   * SequenceHero's poster as a still, which never shakes because it never moves.
   */
  return (
    <CanvasHost>
      <SceneRouter />
    </CanvasHost>
  );
}
