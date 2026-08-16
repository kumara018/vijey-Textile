'use client';

import { useMemo, useRef, type MutableRefObject } from 'react';
import { Physics, RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * Physics layer for the chamber — high tier only.
 *
 * A handful of spools resting on the inspection floor. They settle, they knock
 * into each other, and they respond to the pointer as if nudged across a
 * surface. Weight is what separates a garment from a decal, and settling is
 * the one thing scripted easing genuinely cannot fake: an eased object always
 * arrives on a curve someone chose, while a settling object arrives where the
 * collision put it.
 *
 * Gated behind budget.physics because it costs a WASM simulation step every
 * frame, on top of everything else this scene is already doing.
 */

const SPOOLS = [
  { p: [-1.9, 1.4, 0.4] as const, s: 0.34, c: '#A16207' },
  { p: [-0.7, 2.1, -0.3] as const, s: 0.26, c: '#C4841A' },
  { p: [ 0.9, 1.7, 0.5] as const, s: 0.3,  c: '#6B420A' },
  { p: [ 2.0, 2.4, -0.2] as const, s: 0.22, c: '#A8A29E' },
  { p: [ 0.1, 2.8, 0.2] as const, s: 0.28, c: '#631730' },
];

function Spools({ weightRef }: { weightRef: MutableRefObject<number> }) {
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const materials = useMemo(
    () =>
      SPOOLS.map((s) =>
        new THREE.MeshStandardMaterial({
          color: s.c,
          roughness: 0.55,
          metalness: 0.15,
          transparent: true,
          opacity: 0,
        }),
      ),
    [],
  );
  const geometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 0.7, 20), []);

  useFrame(() => {
    const { pointer } = useSceneStore.getState();
    const w = weightRef.current;
    for (const m of materials) m.opacity = 0.85 * w;

    // A gentle lateral impulse follows the pointer, so the pile drifts with
    // the cursor rather than sitting inert once it has settled. Applied as a
    // force, not a position write — teleporting a rigid body past its
    // colliders is how physics scenes end up with objects inside each other.
    for (const b of bodies.current) {
      if (!b) continue;
      b.applyImpulse({ x: pointer.x * 0.0012, y: 0, z: -pointer.y * 0.0008 }, true);
    }
  });

  return (
    <>
      {SPOOLS.map((s, i) => (
        <RigidBody
          key={i}
          ref={(r) => { bodies.current[i] = r; }}
          position={[s.p[0], s.p[1], s.p[2]]}
          colliders="hull"
          restitution={0.18}
          friction={0.9}
          linearDamping={0.6}
          angularDamping={0.7}
        >
          <mesh geometry={geometry} material={materials[i]} scale={[s.s, s.s, s.s]} />
        </RigidBody>
      ))}
    </>
  );
}

export default function ChamberPhysics({ weightRef }: { weightRef: MutableRefObject<number> }) {
  return (
    <Physics
      gravity={[0, -5.2, 0]}
      // Below the display refresh rate on purpose: this is decorative
      // settling, not gameplay, and a lower step frees frame budget for the
      // satin shader, which is what the customer is actually looking at.
      timeStep={1 / 45}
    >
      <Spools weightRef={weightRef} />

      {/* Floor and side walls, so spools settle in view instead of falling out
          of frame forever. Invisible colliders — the "floor" is implied. */}
      <CuboidCollider position={[0, -2.6, 0]} args={[6, 0.2, 3]} />
      <CuboidCollider position={[-4.2, 0, 0]} args={[0.2, 5, 3]} />
      <CuboidCollider position={[ 4.2, 0, 0]} args={[0.2, 5, 3]} />
      <CuboidCollider position={[0, 0, -2.2]} args={[6, 5, 0.2]} />
      <CuboidCollider position={[0, 0,  2.2]} args={[6, 5, 0.2]} />
    </Physics>
  );
}
