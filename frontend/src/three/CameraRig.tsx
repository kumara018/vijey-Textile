'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneId } from '@/store/useSceneStore';
import { useSceneStore } from '@/store/useSceneStore';
import { easeScroll, approach } from './core/easing';

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
  /**
   * Scroll-driven move for this scene, applied on top of the dock.
   *
   * dolly  — along the view axis, toward or away from the subject
   * crane  — vertical, the camera rising or dropping on its column
   * pan    — lateral drift across the subject
   *
   * Hero scenes are never locked off: there is always a slow move running so
   * the shot breathes even when the visitor is still.
   */
  dolly: number;
  crane: number;
  pan: number;
}

const dock = (
  px: number, py: number, pz: number,
  tx: number, ty: number, tz: number,
  parallax: number, ease: number,
  dolly = 0, crane = 0, pan = 0,
): Dock => ({
  position: new THREE.Vector3(px, py, pz),
  target: new THREE.Vector3(tx, ty, tz),
  parallax,
  ease,
  dolly, crane, pan,
});

/**
 * Docks are laid out as a real floor plan, not arbitrary numbers: the gallery
 * sits to the right of the entrance, the chamber is deeper in and closer to its
 * subject, the vault is below, and the transactional docks are pulled back and
 * squared up so nothing drifts in the corner of the eye while someone is typing
 * a card number.
 */
const DOCKS: Record<SceneId, Dock> = {
  //                                                    parallax ease  dolly crane  pan
  entrance: dock(0,    0,    8,     0,  0,   0,          0.55, 0.020,  2.6,  1.1,  0.7),
  gallery:  dock(3.2,  0.4,  7.2,   0.6, 0,  -0.5,       0.42, 0.022,  1.4,  0.5,  0.0),
  chamber:  dock(0,   -0.2,  4.6,   0, -0.1, -1.2,       0.30, 0.026,  1.1,  0.7,  0.4),
  vault:    dock(-2.6, -1.1, 6.6,  -0.4,-0.5,-0.8,       0.34, 0.024,  0.9,  0.3,  0.0),
  // Transactional docks get no scroll-driven move at all. A camera drifting
  // behind a card-number field is the definition of the treatment getting in
  // the way of the thing it is supposed to be selling.
  terminal: dock(0,    0,    9.5,   0,  0,   -1,         0.10, 0.045,  0,    0,    0),
  records:  dock(1.1,  0.6,  9.8,   0,  0,   -1,         0.10, 0.045,  0,    0,    0),
  gate:     dock(-1.0, 0.3,  9.0,   0,  0,   -1,         0.14, 0.040,  0,    0,    0),
  plain:    dock(0,    0,   11.0,   0,  0,   -1,         0.00, 0.060,  0,    0,    0),
};

export default function CameraRig() {
  const scene = useSceneStore((s) => s.scene);

  const currentTarget = useRef(new THREE.Vector3(0, 0, 0));
  const parallax = useRef(new THREE.Vector2(0, 0));
  const tmp = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const d = DOCKS[scene] ?? DOCKS.plain;
    const { pointer, scroll, capabilities } = useSceneStore.getState();

    // Reduced motion gets the destination, not the journey — and no camera
    // move, no parallax, no drift. The composition still reads as staged; it
    // simply holds.
    const still = capabilities?.reducedMotion ?? false;

    const k = approach(0, 1, d.ease, delta);   // frame-rate normalised progress
    const amount = still ? 1 : k;

    if (!still) {
      parallax.current.x += (pointer.x * d.parallax - parallax.current.x) * k;
      parallax.current.y += (pointer.y * d.parallax * 0.6 - parallax.current.y) * k;
    }

    /**
     * Scroll-driven move, shaped by a cubic bezier rather than used raw.
     *
     * Linear scroll mapping is the giveaway of a scroll-jacked site: the
     * camera tracks the wheel exactly, so it feels attached to the input
     * rather than to the world. Running progress through an eased curve gives
     * the move a lead-in and a long tail — it starts before you notice and
     * arrives after you stop.
     */
    const p = still ? 0 : easeScroll(Math.min(1, Math.max(0, scroll)));

    // A slow idle breath so hero shots are never locked off, even at rest.
    // Well under a cycle per ten seconds — felt rather than seen.
    const breath = still ? 0 : Math.sin(state.clock.elapsedTime * 0.16);

    tmp.current.set(
      d.position.x + parallax.current.x + p * d.pan + breath * d.pan * 0.12,
      d.position.y + parallax.current.y + p * d.crane + breath * d.crane * 0.10,
      d.position.z - p * d.dolly,
    );
    state.camera.position.lerp(tmp.current, amount);

    // Ease the look-at target too. Snapping it while the position eases makes
    // the camera appear to swing around a pivot it never actually reaches.
    currentTarget.current.lerp(d.target, amount);
    state.camera.lookAt(currentTarget.current);
  });

  return null;
}
