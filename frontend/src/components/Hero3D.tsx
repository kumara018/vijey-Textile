'use client';

/**
 * CSS 3D "heirloom locket" moment — a slow-turning brass ring frames three
 * layered, woven-texture cards with an embossed monogram and a light sweep
 * across the front face. No WebGL — avoids a deep react-reconciler/Turbopack
 * incompatibility hit with @react-three/fiber v8 on Next.js 16.
 */
export default function Hero3D() {
  return (
    <div className="relative w-full h-full" style={{ perspective: '1800px' }}>
      {/* Ground glow */}
      <div
        className="absolute left-1/2 bottom-[2%] -translate-x-1/2 w-[62%] h-[9%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(168,118,63,0.55), transparent 72%)',
          filter: 'blur(10px)',
          animation: 'heroPoolPulse 5s ease-in-out infinite',
        }}
      />

      {/* Orbiting brass rings — pure ornament, sits behind the card stack */}
      <div
        className="absolute inset-0 m-auto rounded-full"
        style={{
          width: '92%', height: '92%',
          border: '1px solid rgba(168,118,63,0.35)',
          transform: 'rotateX(72deg)',
          animation: 'heroRingSpin 26s linear infinite',
        }}
      />
      <div
        className="absolute inset-0 m-auto rounded-full"
        style={{
          width: '78%', height: '78%',
          border: '1px dashed rgba(201,154,95,0.4)',
          transform: 'rotateX(72deg)',
          animation: 'heroRingSpin 40s linear infinite reverse',
        }}
      />

      {/* Card stack */}
      <div
        className="absolute inset-0 m-auto"
        style={{
          width: '58%', height: '68%', transformStyle: 'preserve-3d',
          animation: 'heroFloat 7s ease-in-out infinite, heroSpin 22s linear infinite',
        }}
      >
        {/* Back card */}
        <div
          className="absolute inset-0 rounded-md"
          style={{
            transform: 'translateZ(-34px) translateX(-22px) translateY(14px) rotateZ(-8deg) scale(0.88)', opacity: 0.5,
            background: 'linear-gradient(165deg, #c99a5f 0%, #ece0cd 75%)',
            backgroundImage: 'linear-gradient(165deg, #c99a5f 0%, #ece0cd 75%), repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, transparent 1px, transparent 7px)',
            border: '1px solid rgba(168,118,63,0.6)',
            boxShadow: '0 60px 100px -36px rgba(0,0,0,0.4)',
          }}
        />
        {/* Middle card */}
        <div
          className="absolute inset-0 rounded-md"
          style={{
            transform: 'translateZ(0px) translateX(13px) translateY(-9px) rotateZ(5deg) scale(0.95)', opacity: 0.78,
            background: 'linear-gradient(165deg, #c99a5f 0%, #ece0cd 75%)',
            backgroundImage: 'linear-gradient(165deg, #c99a5f 0%, #ece0cd 75%), repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, transparent 1px, transparent 7px)',
            border: '1px solid rgba(168,118,63,0.6)',
            boxShadow: '0 60px 100px -36px rgba(0,0,0,0.5)',
          }}
        />
        {/* Front card — monogram, corner frame, light sweep */}
        <div
          className="absolute inset-0 rounded-md overflow-hidden"
          style={{
            transform: 'translateZ(34px) rotateZ(-1.5deg)',
            background: 'linear-gradient(165deg, #a8763f 0%, #ece0cd 75%)',
            backgroundImage: 'linear-gradient(165deg, #a8763f 0%, #ece0cd 75%), repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 7px)',
            border: '1px solid rgba(168,118,63,0.7)',
            boxShadow: '0 60px 100px -36px rgba(0,0,0,0.6)',
          }}
        >
          {/* Monogram */}
          <span
            className="absolute inset-0 flex items-center justify-center font-display font-black select-none"
            style={{
              fontSize: 'clamp(3rem, 9vw, 5.5rem)', color: 'rgba(255,255,255,0.4)',
              textShadow: '0 2px 0 rgba(255,255,255,0.25), 0 -1px 1px rgba(90,58,20,0.35)',
            }}
          >
            V
          </span>

          {/* Corner brackets — heirloom frame detail */}
          {[
            { top: '9%', left: '9%',  bt: true,  bl: true  },
            { top: '9%', right: '9%', bt: true,  br: true  },
            { bottom: '9%', left: '9%',  bb: true, bl: true },
            { bottom: '9%', right: '9%', bb: true, br: true },
          ].map((c, i) => (
            <span
              key={i}
              className="absolute w-[16%] h-[16%]"
              style={{
                top: c.top as any, left: c.left as any, right: c.right as any, bottom: c.bottom as any,
                borderTop:    c.bt ? '1.5px solid rgba(255,255,255,0.75)' : undefined,
                borderBottom: c.bb ? '1.5px solid rgba(255,255,255,0.75)' : undefined,
                borderLeft:   c.bl ? '1.5px solid rgba(255,255,255,0.75)' : undefined,
                borderRight:  c.br ? '1.5px solid rgba(255,255,255,0.75)' : undefined,
              }}
            />
          ))}

          {/* Light sweep */}
          <span
            className="absolute inset-y-0 w-1/3"
            style={{
              background: 'linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
              animation: 'heroShine 4.5s ease-in-out infinite',
              animationDelay: '1s',
            }}
          />
        </div>
      </div>

      {[
        { top: '14%', left: '14%', delay: '0s' },
        { top: '50%', left: '86%', delay: '2s' },
        { top: '80%', left: '24%', delay: '4s' },
        { top: '30%', left: '76%', delay: '1.4s' },
        { top: '68%', left: '10%', delay: '3.2s' },
        { top: '12%', left: '62%', delay: '2.6s' },
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
        @keyframes heroRingSpin { from { transform: rotateX(72deg) rotateZ(0deg); } to { transform: rotateX(72deg) rotateZ(360deg); } }
        @keyframes heroPoolPulse { 0%,100% { opacity: 0.7; transform: translateX(-50%) scale(1); } 50% { opacity: 1; transform: translateX(-50%) scale(1.08); } }
        @keyframes heroDrift { 0%,100% { transform: translateY(0) translateX(0); opacity: 0.3; } 50% { transform: translateY(-46px) translateX(10px); opacity: 0.9; } }
        @keyframes heroShine { 0% { transform: translateX(-220%) skewX(-12deg); } 35%,100% { transform: translateX(420%) skewX(-12deg); } }
        @media (prefers-reduced-motion: reduce) {
          div, span { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
