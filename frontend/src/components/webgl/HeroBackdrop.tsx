'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const SilkBackdrop = dynamic(() => import('./SilkBackdrop'), { ssr: false });

/**
 * Vijey Textile — "Wine & Steel", pitched light.
 *
 * These are deliberately the *pale* end of the wine scale, not wine-500/700.
 * The hero's headline is maroon-900 (near-black) over this panel, so the silk
 * has to stay a light ground or the type stops reading. Saturated wine lives
 * in the fold shadows via the shader's height ramp instead.
 */
const VIJEY_SILK = {
  deep:  '#d99bb2',  // dusty wine — deepest fold shadows
  mid:   '#f1cdd9',  // blush — the body of the cloth
  light: '#fdf6f8',  // near-white crests catching the light
  sheen: '#ffe3cc',  // warm blush-gold specular, from the gold accent scale
};

/**
 * The hero's background layer: flowing WebGL silk when the device can render
 * it, otherwise the original CSS diagonal gradient — byte-identical to what
 * shipped before, so no device gets a *worse* hero than it had.
 */
export default function HeroBackdrop() {
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

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Always painted: the original gradient. It's the fallback on its own,
          and underneath the silk it guarantees the section never flashes
          transparent while the WebGL chunk is still loading. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(100deg, #f6f1f3 0%, #f6f1f3 46%, rgba(197,128,89,0.18) 46.4%, #fcfbfb 100%)',
        }}
      />
      {mode === 'webgl' && (
        <SilkBackdrop palette={VIJEY_SILK} opacity={0.92} onFail={() => setMode('css')} />
      )}
    </div>
  );
}
