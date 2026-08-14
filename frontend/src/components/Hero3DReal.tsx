'use client';

import { useEffect, useRef } from 'react';

/**
 * Real WebGL 3D hero — a genuine heart+T mark modeled and lit in Three.js,
 * drag-to-rotate and scroll-to-zoom (OrbitControls), not a CSS transform.
 *
 * Deliberately vanilla `three`, not @react-three/fiber: R3F's custom
 * react-reconciler hit a real, blocking incompatibility with Turbopack on
 * Next.js 16 when tried earlier for this project. Vanilla three.js has no
 * React-specific bundling surface, so it isn't affected — this component
 * just owns a canvas ref and drives the scene imperatively in useEffect.
 */
export default function Hero3DReal({
  accent = '#b42251',
  accentDark = '#431423',
  onFail,
}: {
  accent?: string;
  accentDark?: string;
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
      let OrbitControls: typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;
      let RoomEnvironment: typeof import('three/examples/jsm/environments/RoomEnvironment.js').RoomEnvironment;
      try {
        [THREE, { OrbitControls }, { RoomEnvironment }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/controls/OrbitControls.js'),
          import('three/examples/jsm/environments/RoomEnvironment.js'),
        ]);
      } catch {
        if (!cancelled) onFail?.();
        return;
      }
      if (cancelled || !container) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      } catch {
        onFail?.();
        return;
      }

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 0.15, 6.2);

      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

      // ── Heart shape (classic Three.js heart-curve profile, centered) ──
      const heart = new THREE.Shape();
      heart.moveTo(0.25, 0.25);
      heart.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
      heart.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
      heart.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
      heart.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
      heart.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
      heart.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);

      const heartGeo = new THREE.ExtrudeGeometry(heart, {
        depth: 0.16, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 4, curveSegments: 24,
      });
      heartGeo.center();
      heartGeo.rotateZ(Math.PI);
      heartGeo.rotateY(Math.PI);
      heartGeo.scale(1.55, 1.55, 1);

      const chrome = new THREE.MeshPhysicalMaterial({
        color: 0xf3f3f3, metalness: 1, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.25,
      });
      const heartMesh = new THREE.Mesh(heartGeo, chrome);

      // ── "T" bar sitting in front of the heart's notch ──
      const tGroup = new THREE.Group();
      const barGeo = new THREE.BoxGeometry(0.62, 0.16, 0.2);
      const stemGeo = new THREE.BoxGeometry(0.16, 0.62, 0.2);
      const bar = new THREE.Mesh(barGeo, chrome);
      const stem = new THREE.Mesh(stemGeo, chrome);
      bar.position.set(0, 0.28, 0.16);
      stem.position.set(0, -0.05, 0.16);
      tGroup.add(bar, stem);

      const rig = new THREE.Group();
      rig.add(heartMesh, tGroup);
      scene.add(rig);

      // ── Backdrop: a soft gradient-lit plane behind the mark, matching the brand accent ──
      const backdropGeo = new THREE.PlaneGeometry(14, 14);
      const backdropMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: 0.14 });
      const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
      backdrop.position.z = -2.4;
      scene.add(backdrop);

      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(3, 4, 5);
      const rim = new THREE.DirectionalLight(new THREE.Color(accent), 1.6);
      rim.position.set(-4, -2, -3);
      const fill = new THREE.AmbientLight(new THREE.Color(accentDark), 0.5);
      scene.add(key, rim, fill);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.minDistance = 3.5;
      controls.maxDistance = 9;
      controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      controls.autoRotateSpeed = 2.4;
      controls.target.set(0, 0.15, 0);

      const resize = () => {
        const { clientWidth: w, clientHeight: h } = container;
        if (!w || !h) return;
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab;';
      container.appendChild(renderer.domElement);

      const ro = new ResizeObserver(resize);
      ro.observe(container);

      let raf = 0;
      const tick = () => {
        controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        controls.dispose();
        pmrem.dispose();
        heartGeo.dispose();
        barGeo.dispose();
        stemGeo.dispose();
        backdropGeo.dispose();
        chrome.dispose();
        backdropMat.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, accentDark]);

  return <div ref={containerRef} className="w-full h-full" aria-label="Rotatable 3D Vijey Textile mark — drag to turn, scroll to zoom" role="img" />;
}
