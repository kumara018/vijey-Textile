'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Hero3D from './Hero3D';

const Hero3DReal = dynamic(() => import('./Hero3DReal'), { ssr: false });

/**
 * Picks the real WebGL 3D mark when the browser can actually render it,
 * falling back to the CSS-transform version (Hero3D) otherwise — old
 * mobile GPUs, WebGL disabled, or the three.js chunk failing to load.
 */
export default function HeroScene(props: { accent?: string; accentDark?: string }) {
  const [mode, setMode] = useState<'checking' | 'webgl' | 'css'>('checking');

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      setMode(gl ? 'webgl' : 'css');
    } catch {
      setMode('css');
    }
  }, []);

  if (mode === 'checking') return <Hero3D />;
  if (mode === 'css') return <Hero3D />;
  return <Hero3DReal {...props} onFail={() => setMode('css')} />;
}
