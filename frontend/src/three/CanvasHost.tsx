'use client';

import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { attachContextRecovery } from './core/contextRecovery';
import { Preload } from '@react-three/drei';
import { useSceneStore } from '@/store/useSceneStore';
import { isCaptureRender } from './core/useDeliveryTier';

/**
 * Drives per-frame store values that scenes read.
 *
 * Lives inside the Canvas because useFrame requires it, and does its work by
 * reading/writing the Zustand store directly — never via React state, which
 * would re-render the whole tree 60 times a second.
 */
function FrameDriver() {
  const target = useRef({ x: 0, y: 0 });
  const eased = useRef({ x: 0, y: 0 });
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  /**
   * Context loss recovery.
   *
   * Not an edge case on a canvas that survives every route change: a driver
   * reset, a backgrounded tab on a memory-pressured phone, another tab claiming
   * contexts, or a laptop switching graphics adapters will all drop it. The
   * default browser behaviour leaves the canvas permanently blank.
   *
   * The page itself is unaffected — the hero poster and every piece of DOM sit
   * outside the canvas — so recovery is about restoring decoration, never about
   * restoring function.
   */
  useEffect(() => {
    const canvas = gl.domElement;
    return attachContextRecovery(canvas, {
      onLost: () => {
        // Stop driving the render loop while there is no context to render to.
        useSceneStore.getState().suspendEffects();
      },
      onRestored: () => {
        // three.js rebuilds its own GPU-side resources on restore; forcing a
        // fresh frame is what makes that happen immediately rather than on the
        // next scroll.
        invalidate();
      },
      onFatal: () => {
        // Repeated loss means this GPU cannot sustain the scene. Drop to the
        // static layers permanently rather than restoring into another crash.
        useSceneStore.getState().setTier('off');
      },
    });
  }, [gl, invalidate]);

  /**
   * Measurement hook, opt-in via `?measure=1`.
   *
   * The final audit has to state draw calls and frame cost PER ROUTE, and
   * there is no way to read `renderer.info` from outside the React tree. This
   * publishes the live renderer on `window` only when the URL asks for it, so
   * a customer's page never carries the handle. Read-only by intent: the
   * measuring script looks at `.info`, it does not drive anything.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('measure') !== '1') return;
    (window as unknown as { __three?: unknown }).__three = gl;
    return () => { delete (window as unknown as { __three?: unknown }).__three; };
  }, [gl]);

  useFrame(() => {
    const t = target.current;
    const e = eased.current;
    e.x += (t.x - e.x) * 0.06;
    e.y += (t.y - e.y) * 0.06;
    // Only publish once the change is meaningful — avoids a store write, and
    // therefore a subscriber notification, on every idle frame.
    const prev = useSceneStore.getState().pointer;
    if (Math.abs(prev.x - e.x) > 0.001 || Math.abs(prev.y - e.y) > 0.001) {
      useSceneStore.getState().setPointer(e.x, e.y);
    }
  });

  return null;
}

/**
 * The single persistent <Canvas> for the whole application.
 *
 * Mounted once in the root layout and never unmounted: routes change, the
 * scene graph inside animates, but the WebGL/WebGPU context and every
 * compiled shader, uploaded texture and warmed pipeline survives. Remounting
 * per route would re-pay all of that on every navigation, which is exactly
 * what makes most "3D sites" feel broken when you click around.
 *
 * Fixed behind the DOM at z-0 and pointer-events:none, so all real UI stays
 * ordinary accessible HTML on top — forms, tables and nav are never meshes.
 */
export default function CanvasHost({ children }: { children?: React.ReactNode }) {
  const capabilities = useSceneStore((s) => s.capabilities);
  const shellRef = useRef<HTMLDivElement>(null);

  /**
   * The scene is an OPENING, and it fades as the page becomes editorial.
   *
   * This fixes a real duplication, not just a mood: the canvas is
   * `position: fixed`, so it kept staging the hero garment behind every
   * section below the hero. On the homepage that put the same photograph on
   * screen twice at once — once inside the pinned hero, once bleeding behind
   * "The occasion" underneath it. Two renderers, one subject.
   *
   * Fading it out across the first stretch of scroll resolves that and states
   * the intent: the scene belongs to the opening of a page, and everything
   * past it is type and photography. Driven on rAF from a passive listener,
   * writing only `opacity` — a compositor-only property, so it never costs a
   * layout or a repaint of the scene itself.
   */
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    /**
     * The fade must not run while the sequence is being MADE.
     *
     * This fade exists so the fixed canvas stops duplicating the hero behind
     * the sections below it. The offline renderer, though, drives the page
     * through a scroll range to capture the camera move — and that range runs
     * past the point where this fade has already hidden the scene. The result
     * was a sequence whose tail was empty: measured at 11 frames per tier with
     * a luminance range of 1, i.e. flat ground, including the final six.
     *
     * `check:frames` did not catch it because it samples three frames per tier
     * and happened to miss them. The dead frames are why the hero looked blank
     * at rest.
     */
    if (isCaptureRender()) {
      el.style.opacity = '1';
      el.style.visibility = 'visible';
      return;
    }

    let pending = false;
    const apply = () => {
      pending = false;
      const node = shellRef.current;
      if (!node) return;
      // Fully present for the first viewport, gone by the end of the second.
      const vh = window.innerHeight || 1;
      const t = Math.min(1, Math.max(0, (window.scrollY - vh * 0.9) / (vh * 1.1)));
      node.style.opacity = String(1 - t);
      // Stop compositing it entirely once invisible.
      node.style.visibility = t >= 1 ? 'hidden' : 'visible';
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [capabilities]);


  // Detection hasn't finished, or this device can't render at all. The site
  // is fully usable either way — the canvas is decoration, never content.
  if (!capabilities || capabilities.renderer === 'none' || capabilities.tier === 'off') {
    return null;
  }

  const { maxPixelRatio, reducedMotion } = capabilities;

  return (
    <div
      ref={shellRef}
      aria-hidden="true"
      /**
       * The one subtree capture mode keeps. Marked explicitly rather than
       * detected by "contains a canvas" — the sequence hero owns a canvas too,
       * and detecting on that spared the whole page.
       */
      data-capture-keep=""
      className="fixed inset-0 z-0 pointer-events-none"
    >
      <Canvas
        dpr={[1, maxPixelRatio]}
        // Never render on a clock we don't control. Scenes opt into
        // continuous rendering via invalidate(); on the reduced-motion path
        // that means a handful of frames, not a permanent loop.
        frameloop={reducedMotion ? 'demand' : 'always'}
        gl={{
          antialias: capabilities.tier === 'high',
          alpha: true,
          powerPreference: capabilities.tier === 'high' ? 'high-performance' : 'low-power',
          // The scene is composited over the page, so we never need to read
          // it back — letting the driver discard it after compositing is
          // measurably cheaper.
          preserveDrawingBuffer: false,
        }}
        camera={{ fov: 38, near: 0.1, far: 200, position: [0, 0, 8] }}
        // R3F puts this on its own container, which it otherwise ships with
        // `pointer-events: auto` — that would sit over the entire page and
        // swallow every click, on a live store. The outer div's
        // pointer-events-none does not survive that override, so it has to be
        // set here too.
        style={{ pointerEvents: 'none' }}
      >
        <FrameDriver />
        {children}
        {/* Compiles materials before first display rather than mid-transition. */}
        <Preload all />
      </Canvas>
    </div>
  );
}
