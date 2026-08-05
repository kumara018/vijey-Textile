'use client';

/**
 * CSS 3D "floating heirloom" moment — three layered panels with real
 * perspective/rotateX/rotateY depth, no WebGL. Matches the approved
 * mockup exactly; avoids a deep react-reconciler/Turbopack incompatibility
 * hit with @react-three/fiber v8 on Next.js 16.
 */
export default function Hero3D() {
  return (
    <div className="relative w-full h-full" style={{ perspective: '1600px' }}>
      <div
        className="absolute left-1/2 bottom-[6%] -translate-x-1/2 w-[220px] h-[46px] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(168,118,63,0.55), transparent 72%)',
          filter: 'blur(8px)',
          animation: 'heroPoolPulse 5s ease-in-out infinite',
        }}
      />
      <div
        className="absolute inset-0 m-auto"
        style={{
          width: '74%', height: '78%', transformStyle: 'preserve-3d',
          animation: 'heroFloat 7s ease-in-out infinite, heroSpin 22s linear infinite',
        }}
      >
        <div
          className="absolute inset-0 rounded-sm"
          style={{
            transform: 'translateZ(-26px) translateX(-16px) translateY(10px) rotateZ(-7deg) scale(0.9)', opacity: 0.55,
            background: 'linear-gradient(165deg, #c99a5f 0%, #ece0cd 75%)',
            border: '1px solid rgba(168,118,63,0.6)',
            boxShadow: '0 50px 90px -34px rgba(0,0,0,0.4)',
          }}
        />
        <div
          className="absolute inset-0 rounded-sm"
          style={{
            transform: 'translateZ(0px) translateX(9px) translateY(-6px) rotateZ(5deg) scale(0.95)', opacity: 0.8,
            background: 'linear-gradient(165deg, #c99a5f 0%, #ece0cd 75%)',
            border: '1px solid rgba(168,118,63,0.6)',
            boxShadow: '0 50px 90px -34px rgba(0,0,0,0.5)',
          }}
        />
        <div
          className="absolute inset-0 rounded-sm"
          style={{
            transform: 'translateZ(26px) rotateZ(-1.5deg)',
            background: 'linear-gradient(165deg, #a8763f 0%, #ece0cd 75%)',
            border: '1px solid rgba(168,118,63,0.7)',
            boxShadow: '0 50px 90px -34px rgba(0,0,0,0.6)',
          }}
        />
      </div>

      {[
        { top: '20%', left: '18%', delay: '0s' },
        { top: '55%', left: '80%', delay: '2s' },
        { top: '75%', left: '30%', delay: '4s' },
        { top: '35%', left: '70%', delay: '1.4s' },
      ].map((m, i) => (
        <div
          key={i}
          className="absolute w-[3px] h-[3px] rounded-full"
          style={{
            top: m.top, left: m.left, background: '#c99a5f', opacity: 0.8,
            animation: `heroDrift 9s ease-in-out infinite`, animationDelay: m.delay,
          }}
        />
      ))}

      <style jsx>{`
        @keyframes heroFloat { 0%,100% { transform: translateY(0) rotateX(6deg); } 50% { transform: translateY(-14px) rotateX(6deg); } }
        @keyframes heroSpin { 0% { transform: rotateY(-16deg); } 50% { transform: rotateY(16deg); } 100% { transform: rotateY(-16deg); } }
        @keyframes heroPoolPulse { 0%,100% { opacity: 0.7; transform: translateX(-50%) scale(1); } 50% { opacity: 1; transform: translateX(-50%) scale(1.08); } }
        @keyframes heroDrift { 0%,100% { transform: translateY(0) translateX(0); opacity: 0.3; } 50% { transform: translateY(-46px) translateX(10px); opacity: 0.9; } }
        @media (prefers-reduced-motion: reduce) {
          div { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
