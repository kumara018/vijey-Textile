'use client';

import { create } from 'zustand';

/**
 * The bridge between the DOM and the canvas for hero staging.
 *
 * The homepage knows which product photograph is the hero — it comes from the
 * products query. The 3D scene needs that image to stage it. Passing it through
 * React props would mean threading it down through ThreeProvider, CanvasHost
 * and SceneRouter, all of which are mounted outside the page and must never
 * re-render on a data change.
 *
 * A store keeps that coupling to one line at each end, and lets the canvas
 * read the value without the page and the scene sharing a render path.
 */
interface HeroState {
  /** Absolute URL of the hero photograph, or null to stage the material only. */
  heroImage: string | null;
  setHeroImage: (url: string | null) => void;
}

export const useHeroStore = create<HeroState>((set) => ({
  heroImage: null,
  setHeroImage: (url) => set((s) => (s.heroImage === url ? s : { heroImage: url })),
}));
