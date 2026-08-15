'use client';

import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Preload } from '@react-three/drei';
import { useSceneStore } from '@/store/useSceneStore';

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
  const { gl } = useThree();

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // A lost context is recoverable, but only if we stop the default handling
  // that permanently kills the canvas.
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      console.warn('[3D] WebGL context lost — pausing scene until restored');
    };
    canvas.addEventListener('webglcontextlost', onLost);
    return () => canvas.removeEventListener('webglcontextlost', onLost);
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

  // Detection hasn't finished, or this device can't render at all. The site
  // is fully usable either way — the canvas is decoration, never content.
  if (!capabilities || capabilities.renderer === 'none' || capabilities.tier === 'off') {
    return null;
  }

  const { maxPixelRatio, reducedMotion } = capabilities;

  return (
    <div
      aria-hidden="true"
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
