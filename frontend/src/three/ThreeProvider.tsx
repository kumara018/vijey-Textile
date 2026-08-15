'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { detectCapabilities } from './core/capabilities';
import { useSceneStore, sceneForPath } from '@/store/useSceneStore';
import { useDeliveryTier } from './core/useDeliveryTier';
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
 *   3. Lenis smooth scroll, driven on the same clock as GSAP
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

  // ── Lenis + GSAP on one clock ───────────────────────────────────────
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

      lenis = new Lenis({ duration: 1.05, smoothWheel: true });

      // ScrollTrigger must be told about Lenis's virtual scroll position, and
      // Lenis must be driven by GSAP's ticker rather than its own rAF — two
      // independent loops drift by a frame and the scene visibly judders
      // against the DOM.
      lenis.on('scroll', ScrollTrigger.update);

      const tick = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      // Publish scroll progress for scenes to read.
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        useSceneStore.getState().setScroll(max > 0 ? window.scrollY / max : 0);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();

      cleanup = () => {
        window.removeEventListener('scroll', onScroll);
        gsap.ticker.remove(tick);
        lenis?.destroy();
        lenis = null;
      };
    })();

    return () => { cancelled = true; cleanup(); };
  }, [capabilities]);

  // Route changes must reset scroll position — Lenis holds its own virtual
  // offset that survives navigation otherwise, landing users mid-page.
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

  return (
    <CanvasHost>
      <SceneRouter />
    </CanvasHost>
  );
}
