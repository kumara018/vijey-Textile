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
   * Scroll progress, published from NATIVE scroll.
   *
   * Lenis used to drive this — a 1.05s eased virtual scroll layered over the
   * browser's own. It was removed, and removing it IS the fix for the hero
   * feeling sticky while dragging.
   *
   * Smooth-scroll libraries take scrolling off the compositor and run it in
   * JavaScript, one frame behind the input. Against a `position: sticky` hero
   * whose transform is driven by scroll position, that is two systems
   * disagreeing about where the page is on every frame: the sticky element is
   * placed by the browser at the real offset while the animation reads the
   * interpolated one. The result is exactly the judder that was reported —
   * and it gets worse the heavier the frame is, which is why it showed up
   * here and not on a plain page.
   *
   * The studios this hero is modelled on do not hijack scroll either. They
   * drive animation FROM native scroll and let the compositor own the motion.
   * That is what this does now: a passive listener, one rAF, no interpolation
   * layer, nothing for the sticky frame to disagree with.
   */
  useEffect(() => {
    if (!capabilities) return;

    let pending = false;
    const publish = () => {
      pending = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      useSceneStore.getState().setScroll(max > 0 ? window.scrollY / max : 0);
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(publish);
    };

    publish();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
  if (pathname === '/') return null;

  return (
    <CanvasHost>
      <SceneRouter />
    </CanvasHost>
  );
}
