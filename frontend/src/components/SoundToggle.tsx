'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * Ambient audio bed with a persistent unmute control.
 *
 * Three rules, all non-negotiable:
 *
 *   1. Nothing is created until the visitor asks for it. Tone.js is not even
 *      imported until the first unmute — no AudioContext exists before then,
 *      so there is nothing for a browser to block and nothing running in the
 *      background of a silent page.
 *   2. The control is always visible, never a hidden gesture. Sound that a
 *      visitor cannot immediately find the off switch for is hostile, and on a
 *      shopping site it is actively costly.
 *   3. The choice persists. Being re-asked on every route change would be
 *      worse than not offering it.
 *
 * Browsers require a user gesture before an AudioContext may start, which
 * happens to align exactly with what is correct here anyway.
 */

const STORAGE_KEY = 'vijey:sound';   // scoped so the two sites do not share state

/** Routes with an ambient bed. Transactional pages stay silent regardless. */
const AMBIENT_ROUTES = new Set(['/', '/products']);

interface Audio {
  dispose: () => void;
  setActive: (on: boolean) => void;
}

async function buildAudio(): Promise<Audio> {
  const Tone = await import('tone');
  await Tone.start();

  // Deliberately not a music loop. A loop has a length, and a visitor who
  // stays long enough to hear it repeat notices the repeat and nothing else.
  // This is a drone: two detuned oscillators a fifth apart through a slow
  // filter sweep, so it never resolves and never repeats.
  const out = new Tone.Gain(0).toDestination();

  const filter = new Tone.Filter({ type: 'lowpass', frequency: 320, Q: 0.6 }).connect(out);
  const reverb = new Tone.Reverb({ decay: 9, wet: 0.85 }).connect(filter);

  const a = new Tone.Oscillator({ frequency: 55, type: 'sine', volume: -26 }).connect(reverb);
  const b = new Tone.Oscillator({ frequency: 82.5, type: 'triangle', volume: -32 }).connect(reverb);
  // A couple of cents off, so the two beat slowly against each other.
  const c = new Tone.Oscillator({ frequency: 55.4, type: 'sine', volume: -30 }).connect(reverb);

  const sweep = new Tone.LFO({ frequency: 0.021, min: 220, max: 520 }).connect(filter.frequency);

  a.start(); b.start(); c.start(); sweep.start();

  return {
    setActive: (on: boolean) => {
      // Long ramps. A bed that cuts in or out draws attention to itself, which
      // is the opposite of what an ambient bed is for.
      out.gain.rampTo(on ? 0.5 : 0, on ? 2.5 : 1.2);
    },
    dispose: () => {
      sweep.dispose(); a.dispose(); b.dispose(); c.dispose();
      reverb.dispose(); filter.dispose(); out.dispose();
    },
  };
}

export default function SoundToggle() {
  const pathname = usePathname();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const audio = useRef<Audio | null>(null);

  // Restore the previous choice, but never act on it until a gesture — a
  // stored "on" cannot legally start an AudioContext by itself.
  useEffect(() => {
    try { if (localStorage.getItem(STORAGE_KEY) === 'on') setOn(true); } catch {}
  }, []);

  useEffect(() => () => { audio.current?.dispose(); audio.current = null; }, []);

  const inAmbientRoute = AMBIENT_ROUTES.has(pathname);

  // Fade out when leaving a hero route rather than tearing the graph down, so
  // coming back does not re-pay the AudioContext setup.
  useEffect(() => {
    audio.current?.setActive(on && inAmbientRoute);
  }, [on, inAmbientRoute]);

  const toggle = useCallback(async () => {
    if (busy) return;
    const next = !on;
    setOn(next);
    try { localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off'); } catch {}

    if (!next) { audio.current?.setActive(false); return; }

    if (!audio.current) {
      setBusy(true);
      try {
        audio.current = await buildAudio();
      } catch {
        // An AudioContext can still be refused. Fail silently and reset the
        // control — a broken speaker icon is worse than no sound.
        setOn(false);
        try { localStorage.setItem(STORAGE_KEY, 'off'); } catch {}
        return;
      } finally {
        setBusy(false);
      }
    }
    audio.current.setActive(inAmbientRoute);
  }, [on, busy, inAmbientRoute]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Mute ambient sound' : 'Play ambient sound'}
      title={on ? 'Mute ambient sound' : 'Play ambient sound'}
      className="fixed bottom-5 left-5 z-30 flex h-11 w-11 items-center justify-center rounded-full
                 border border-ink-edge bg-black/55 text-paper backdrop-blur-sm
                 transition-colors hover:bg-black/75 hover:text-paper
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-white/70"
    >
      {on ? <Volume2 size={18} /> : <VolumeX size={18} />}
      {/* The state has to be reachable by a screen reader, not just visible. */}
      <span className="sr-only">{on ? 'Sound on' : 'Sound off'}</span>
    </button>
  );
}
