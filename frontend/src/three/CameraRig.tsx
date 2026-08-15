'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneId } from '@/store/useSceneStore';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * Rail-and-dock camera.
 *
 * Every scene owns a dock: a camera position and a look-at target. Route
 * changes do not cut, and they do not fade to black — the camera travels along
 * the rail from the dock it is at to the dock it is going to. That single
 * decision is what makes the site read as one continuous space rather than a
 * series of separate 3D pages, and it is only possible because the canvas is
 * persistent. A per-page canvas has nowhere to travel from.
 *
 * The whole rig runs on refs inside useFrame. Camera position through React
 * state would re-render the tree every frame.
 */

interface Dock {
  position: THREE.Vector3;
  target: THREE.Vector3;
  /** How much the pointer is allowed to shift the camera, in world units. */
  parallax: number;
  /** Travel rate. Transactional docks arrive faster — less time in motion. */
  ease: number;
}

const dock = (
  px: number, py: number, pz: number,
  tx: number, ty: number, tz: number,
  parallax: number, ease: number,
): Dock => ({
  position: new THREE.Vector3(px, py, pz),
  target: new THREE.Vector3(tx, ty, tz),
  parallax,
  ease,
});

/**
 * Docks are laid out as a real floor plan, not arbitrary numbers: the gallery
 * sits to the right of the entrance, the chamber is deeper in and closer to its
 * subject, the vault is below, and the transactional docks are pulled back and
 * squared up so nothing drifts in the corner of the eye while someone is typing
 * a card number.
 */
const DOCKS: Record<SceneId, Dock> = {
  entrance: dock(0,    0,    8,     0,  0,   0,    0.55, 0.020),
  gallery:  dock(3.2,  0.4,  7.2,   0.6, 0,  -0.5, 0.42, 0.022),
  chamber:  dock(0,   -0.2,  4.6,   0, -0.1, -1.2, 0.30, 0.026),
  vault:    dock(-2.6, -1.1, 6.6,  -0.4,-0.5,-0.8, 0.34, 0.024),
  terminal: dock(0,    0,    9.5,   0,  0,   -1,   0.10, 0.045),
  records:  dock(1.1,  0.6,  9.8,   0,  0,   -1,   0.10, 0.045),
  gate:     dock(-1.0, 0.3,  9.0,   0,  0,   -1,   0.14, 0.040),
  plain:    dock(0,    0,   11.0,   0,  0,   -1,   0.00, 0.060),
};

export default function CameraRig() {
  const scene = useSceneStore((s) => s.scene);

  const currentTarget = useRef(new THREE.Vector3(0, 0, 0));
  const parallax = useRef(new THREE.Vector2(0, 0));
  const tmp = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const d = DOCKS[scene] ?? DOCKS.plain;
    const { pointer, scroll, capabilities } = useSceneStore.getState();

    // Frame-rate independence. At a fixed lerp factor the camera arrives twice
    // as fast at 120Hz as at 60Hz, so the same navigation feels different on
    // different hardware. Normalising against a 60Hz step fixes the rate
    // without giving up the exponential ease.
    const k = 1 - Math.pow(1 - d.ease, Math.min(delta, 0.1) * 60);

    // Reduced motion gets the destination, not the journey.
    const still = capabilities?.reducedMotion ?? false;
    const amount = still ? 1 : k;

    // Scroll pushes the camera gently into the scene, so the depth of the
    // space tracks the reading position rather than sitting static.
    const scrollPush = still ? 0 : scroll * 1.1;

    if (!still) {
      parallax.current.x += (pointer.x * d.parallax - parallax.current.x) * k;
      parallax.current.y += (pointer.y * d.parallax * 0.6 - parallax.current.y) * k;
    }

    tmp.current.set(
      d.position.x + parallax.current.x,
      d.position.y + parallax.current.y,
      d.position.z - scrollPush,
    );
    state.camera.position.lerp(tmp.current, amount);

    // Ease the look-at target too. Snapping it while the position eases makes
    // the camera appear to swing around a pivot it never actually reaches.
    currentTarget.current.lerp(d.target, amount);
    state.camera.lookAt(currentTarget.current);
  });

  return null;
}
