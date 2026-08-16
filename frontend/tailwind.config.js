/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /**
         * The approved system. Warm near-black ground, muted gold as the only
         * accent, real off-white for type.
         *
         * The previous pass drifted into maroon-on-maroon, which has no
         * contrast range and no metal in it — everything sat in the same
         * tonal band and the result read as murk rather than as premium. The
         * point of this palette is the distance between #1C1917 and #FAFAF9,
         * with gold appearing rarely enough to still register as gold.
         */
        ink: {
          DEFAULT: '#1C1917',   // warm near-black ground
          deep:    '#141210',   // recessed
          raised:  '#262220',   // lifted surfaces
          edge:    '#3A3431',   // hairlines
        },
        /**
         * The approved accent, named `brass` rather than `gold` because a
         * legacy `gold` scale already exists further down this same object.
         * Two keys of the same name do not merge — the later one silently
         * replaces the earlier, so `text-gold-bright` was resolving to nothing
         * at all and `border-gold` to the old blush tan.
         */
        brass: {
          DEFAULT: '#A16207',   // the only accent
          bright:  '#C4841A',   // hover / specular
          dim:     '#6B420A',   // rules, dividers
        },
        paper: {
          DEFAULT: '#FAFAF9',   // type
          muted:   '#D6D3D1',   // secondary type
          faint:   '#A8A29E',   // tertiary
        },
        night: {
          DEFAULT: '#1C1917',
          deep:    '#141210',
          raised:  '#262220',
          edge:    '#3A3431',
        },
        // Vijey Textile — "Wine & Steel" palette, matched to the logo's own color
        maroon: {
          50:  '#fcfbfb',
          100: '#f6f1f3',
          200: '#eee0e4',
          300: '#e3bfcb',
          400: '#db4d7b',
          500: '#b42251',
          600: '#871c3f',
          700: '#631730',
          800: '#431423',
          900: '#2b0f18',
          950: '#190a0f',
        },
        silver: {
          50:  '#fafafa',
          100: '#f2f2f3',
          200: '#e2e3e4',
          300: '#caccce',
          400: '#a9aeb1',
          500: '#8f9499',
          600: '#6f767b',
          700: '#52575b',
          800: '#35383b',
          900: '#1d1f20',
        },
        gold: {
          50:  '#fcf6f3',
          100: '#f8eae3',
          200: '#efd6c8',
          300: '#e2b9a2',
          400: '#d49c7d',
          500: '#c58059',
          600: '#ab663f',
          700: '#845033',
          800: '#5e3b26',
          900: '#3c271b',
        },
      },
      fontFamily: {
        sans:    ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
      },
      /**
       * Display scale for The Trousseau.
       *
       * Every step is a clamp, so the hierarchy holds from a 360px phone to a
       * 4K monitor without a single breakpoint. The top of the scale is
       * genuinely enormous — the opening line is the composition, not a label
       * above one — and the line-heights tighten as the size grows, which is
       * what stops a huge serif from reading as loose.
       */
      fontSize: {
        /**
         * The hero line, sized on the SMALLER of the two viewport axes.
         *
         * `9.4vw` alone is how the headline drove itself through the fixed
         * header: on a short wide laptop (1920×845) it resolved to ~154px, the
         * sentence wrapped to four lines at line-height 0.9 ≈ 553px, and with
         * the eyebrow and the call to action it wanted ~640px of the ~567px
         * that exists between the header and the fold. A `justify-end` column
         * overflows UPWARD, so the surplus landed on the logo — the first line
         * of the brand sentence rendered behind the wordmark.
         *
         * Width-only hero type will always do this eventually, because it has
         * no way to know the screen is short. `min(9.4vw, 12.2vh)` gives it
         * one: the line takes whichever axis is scarcer. On 1920×1080 it is
         * 132px, on 1920×845 it is 103px, on a phone the floor takes over.
         * The sentence stays whole and stays clear of the header at every size
         * rather than being nudged back by a padding value that only suits the
         * screen it was tuned on.
         */
        'plate':   ['clamp(2.6rem, min(9.4vw, 12.2vh), 9.6rem)', { lineHeight: '0.92', letterSpacing: '-0.03em' }],
        'chapter': ['clamp(2.4rem, 7.5vw, 6.5rem)', { lineHeight: '0.94', letterSpacing: '-0.025em' }],
        'band':    ['clamp(1.9rem, 4.6vw, 3.9rem)', { lineHeight: '1.02', letterSpacing: '-0.02em' }],
        'lede':    ['clamp(1.02rem, 1.5vw, 1.3rem)', { lineHeight: '1.62', letterSpacing: '0' }],
        'caption': ['0.78rem', { lineHeight: '1.45', letterSpacing: '0.14em' }],
        'rule':    ['0.68rem', { lineHeight: '1.3',  letterSpacing: '0.26em' }],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #c58059 0%, #845033 100%)',
        'gold-gradient':  'linear-gradient(135deg, #e3bfcb 0%, #f6f1f3 50%, #e3bfcb 100%)',
        'luxury-gradient': 'linear-gradient(135deg, #2b0f18 0%, #631730 55%, #c58059 100%)',
      },
    },
  },
  plugins: [],
};
