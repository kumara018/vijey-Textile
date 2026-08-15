'use client';

import { useEffect, useRef } from 'react';
import { SILK_VERTEX, SILK_FRAGMENT } from './silkShader';

export type SilkPalette = {
  deep: string;
  mid: string;
  light: string;
  sheen: string;
};

/**
 * Flowing-silk WebGL backdrop — a displaced, lit cloth surface driven by the
 * GLSL in ./silkShader.ts. Fills its container and sits *behind* page content.
 *
 * Vanilla three.js on purpose: @react-three/fiber's custom react-reconciler
 * has a blocking incompatibility with Turbopack on Next.js 16 in this project
 * (hit and confirmed earlier — that's why the CSS heroes exist). Nothing here
 * needs R3F's declarative layer anyway; the scene is static apart from uniforms.
 *
 * Performance guards, since this ships to a live store on mostly mid-range
 * Indian Android:
 *   - mesh density and pixel ratio both scale down on small screens
 *   - rendering stops entirely when the hero scrolls out of view
 *   - prefers-reduced-motion renders one static frame and stops the loop
 *   - any WebGL/context failure calls onFail() so the caller can fall back
 */
export default function SilkBackdrop({
  palette,
  opacity = 1,
  /** Which side the page's body copy sits on — the cloth thins out over it. */
  copySide = 'right',
  onFail,
}: {
  palette: SilkPalette;
  opacity?: number;
  copySide?: 'left' | 'right';
  onFail?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      let THREE: typeof import('three');
      try {
        THREE = await import('three');
      } catch {
        if (!cancelled) onFail?.();
        return;
      }
      if (cancelled || !container) return;

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isSmall = window.matchMedia('(max-width: 768px)').matches;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: !isSmall,
          alpha: true,
          powerPreference: 'high-performance',
        });
      } catch {
        onFail?.();
        return;
      }
      renderer.setClearAlpha(0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 0, 5);

      // Plane sized to always overfill the viewport, so no matter the aspect
      // ratio the silk reaches every edge (the shader's own vignette does the
      // soft fade, not the geometry running out).
      const SEG = isSmall ? 72 : 180;
      const geo = new THREE.PlaneGeometry(20, 20, SEG, SEG);

      const uniforms = {
        uTime:          { value: 0 },
        uAmp:           { value: 1 },
        uMouse:         { value: new THREE.Vector2(0, 0) },
        uMouseStrength: { value: 0 },
        uColorDeep:     { value: new THREE.Color(palette.deep) },
        uColorMid:      { value: new THREE.Color(palette.mid) },
        uColorLight:    { value: new THREE.Color(palette.light) },
        uSheen:         { value: new THREE.Color(palette.sheen) },
        uOpacity:       { value: opacity },
        // Desktop splits mark-left / copy-right, so the cloth thins toward the
        // copy. Mobile stacks vertically with the copy below the canvas, so
        // there's no column to protect — keep it full strength edge to edge.
        uFadeStart:     { value: isSmall ? 2.0 : 0.20 },
        uFadeEnd:       { value: isSmall ? 3.0 : 0.50 },
        uFadeFloor:     { value: isSmall ? 1.0 : 0.012 },
        uFadeFlip:      { value: copySide === 'left' ? 1 : 0 },
      };

      const mat = new THREE.ShaderMaterial({
        vertexShader: SILK_VERTEX,
        fragmentShader: SILK_FRAGMENT,
        uniforms,
        transparent: true,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geo, mat);
      // Tilted so the fabric recedes into the distance instead of facing the
      // camera flat-on — this is what sells it as a draped surface in space.
      mesh.rotation.x = -0.62;
      mesh.rotation.z = 0.22;
      mesh.position.y = -0.6;
      scene.add(mesh);

      const resize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      renderer.domElement.style.cssText =
        'width:100%;height:100%;display:block;pointer-events:none;';
      container.appendChild(renderer.domElement);

      const ro = new ResizeObserver(resize);
      ro.observe(container);

      // ── Pointer: track in normalised plane space, easing toward the target so
      // the bulge trails the cursor like real cloth instead of snapping to it.
      const targetMouse = new THREE.Vector2(0, 0);
      let targetStrength = 0;
      const onPointerMove = (e: PointerEvent) => {
        const r = container.getBoundingClientRect();
        targetMouse.set(
          ((e.clientX - r.left) / r.width - 0.5) * 12,
          -((e.clientY - r.top) / r.height - 0.5) * 12,
        );
        targetStrength = 1;
      };
      const onPointerLeave = () => { targetStrength = 0; };
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      container.addEventListener('pointerleave', onPointerLeave);

      // ── Only render while the hero is actually on screen.
      let onScreen = true;
      const io = new IntersectionObserver(
        ([entry]) => { onScreen = entry.isIntersecting; },
        { threshold: 0 },
      );
      io.observe(container);

      const clock = new THREE.Clock();
      let raf = 0;

      const renderFrame = () => {
        uniforms.uMouse.value.lerp(targetMouse, 0.055);
        uniforms.uMouseStrength.value +=
          (targetStrength - uniforms.uMouseStrength.value) * 0.06;
        renderer.render(scene, camera);
      };

      if (reduceMotion) {
        renderFrame();
      } else {
        const tick = () => {
          raf = requestAnimationFrame(tick);
          if (!onScreen) return;
          uniforms.uTime.value = clock.getElapsedTime();
          renderFrame();
        };
        tick();
      }

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        container.removeEventListener('pointerleave', onPointerLeave);
        geo.dispose();
        mat.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette.deep, palette.mid, palette.light, palette.sheen, opacity, copySide]);

  return <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />;
}
