'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createSatinMaterial } from '../materials/satin';
import ChamberPhysics from './ChamberPhysics';
import type { TierBudget } from '../core/capabilities';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * Chamber — the product detail page.
 *
 * The one scene built to carry a subject rather than a mood. A single large
 * satin drape turns slowly at centre, lit as an examination piece, with the
 * inspection ring around it. This is where a customer decides whether the
 * fabric looks like something they want, so it gets the highest fidelity in the
 * app and the tightest camera dock.
 *
 * Physics mounts on top at high tier, so the drape settles with weight instead
 * of easing. It is additive — the page works without it.
 *
 * Spline content for this route lives in <SplineSurface sceneKey="chamber" />
 * at the DOM layer, not here: @splinetool/loader (the in-scene route) imports
 * constants removed from three in r152 and cannot be used on 0.185. See
 * three/spline/SplineSurface.tsx for the full reasoning.
 */

export default function ChamberScene({
  budget,
  weightRef,
}: {
  budget: TierBudget;
  weightRef: MutableRefObject<number>;
}) {
  // The drape is the subject here, so it gets a far higher segment floor than
  // the background scenes — faceting is obvious on a piece you are inspecting.
  const seg = Math.max(20, Math.round(48 * budget.geometryScale));

  const geometry = useMemo(() => new THREE.PlaneGeometry(4.4, 5.6, seg, seg), [seg]);
  const material = useMemo(
    () =>
      createSatinMaterial({
        color: '#262220',
        sheenColor: '#C4841A',
        roughness: 0.26,
        sheenStrength: 1.15,
        waveAmp: 0.42,
        waveFreq: 1.15,
        opacity: 0,
      }),
    [],
  );

  const ringGeo = useMemo(() => new THREE.TorusGeometry(3.5, 0.012, 8, 128), []);
  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#78716C',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );

  const drape = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useEffect(() => () => { ringGeo.dispose(); ringMat.dispose(); }, [ringGeo, ringMat]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { pointer } = useSceneStore.getState();
    const w = weightRef.current;

    material.uniforms.uTime.value = t * 0.5;
    material.uniforms.uOpacity.value = 0.9 * w;
    material.transparent = true;

    // The light direction tracks the pointer. On an anisotropic material this
    // is the interaction that matters — moving the highlight band across the
    // weave is how you read a fabric's sheen in a physical shop, and it is
    // almost the only way to read it on a screen.
    const lx = 0.45 + pointer.x * 0.5;
    const ly = 0.75 + pointer.y * 0.3;
    material.uniforms.uLightDir.value.set(lx, ly, 0.55).normalize();

    if (drape.current) {
      // A slow turn, not a spin. Fast rotation makes a garment unreadable and
      // is the most common failure of 3D product viewers.
      drape.current.rotation.y = Math.sin(t * 0.16) * 0.42 + pointer.x * 0.22;
      drape.current.rotation.x = pointer.y * 0.08;
    }

    ringMat.opacity = 0.4 * w;
    if (ring.current) ring.current.rotation.z = t * 0.05;
  });

  return (
    <group position={[0, 0, -1.2]}>
      <mesh ref={drape} geometry={geometry} material={material} />

      {/* Inspection ring — reads as instrumentation, and gives the turning
          drape a fixed reference so the rotation is legible. */}
      <mesh ref={ring} geometry={ringGeo} material={ringMat} rotation={[Math.PI / 2, 0, 0]} />

      {budget.physics ? <ChamberPhysics weightRef={weightRef} /> : null}

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[3, 4, 5]}
        intensity={1.35}
        color="#FFF3DE"
        castShadow={budget.shadows}
      />
      <pointLight position={[-4, -1, 3]} intensity={0.5} color="#A16207" />
    </group>
  );
}
