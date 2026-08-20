/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    screens: {
      /* 430px: the widest common phone in portrait. Below it the header has
         room for the mark and the four controls, and nothing else. */
      xs: '430px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        /**
         * THE SHOP, RELIT.
         *
         * Sampled from hero-mark-v3.jpg — a brushed-silver VT heart on cerise.
         * The ground runs #750929 at its deepest to #C22B62 at its brightest;
         * the mark is #B7B7B5. The previous palette assumed maroon and brass,
         * which is not what the logo is.
         *
         * The token NAMES below are inherited from the dark version and their
         * values are inverted, so ~900 existing usages flip correctly in one
         * edit rather than being retyped. `ink` was the dark ground and is now
         * the light one; `paper` was light type and is now dark type.
         */
        ink: {
          /* WARM WHITE AND SANDAL — a combination, not one tone.
             The previous pass painted the whole shop a single mid sandal and
             it read as dull, correctly: with every surface the same value
             there is nothing for the eye to step between. The reference the
             owner gave is a warm-white garment against sandal, so that is what
             this is. The page is warm white, the bands and wells are sandal,
             and there are 12.5 points of lightness between them. */
          DEFAULT: '#F7F1E8',   // the page — warm white, 93.9%
          deep:    '#FFFCF6',   // lifted — cards, menus, the footer, 98.2%
          raised:  '#DFD2C0',   // SANDAL — section bands, inputs, wells, 81.4%
          edge:    '#C6B7A1',   // hairlines, 70.4%
        },
        brass: {
          DEFAULT: '#A21D48',   // the accent — the logo's own cerise. AAA on shell.
          bright:  '#C22B62',   // hover, active, the brightest part of the mark
          dim:     '#750929',   // pressed, and the deepest corner of the logo
        },
        paper: {
          DEFAULT: '#2B2118',   // type  14.03 / 15.38 / 10.59 : 1
          muted:   '#584A39',   // second 7.62 /  8.36 /  5.75 : 1
          faint:   '#64553F',   // annotations, clears AA on the sandal band
        },
        night: {
          DEFAULT: '#F7F1E8',
          deep:    '#FFFCF6',
          raised:  '#DFD2C0',
          edge:    '#C6B7A1',
        },
        /* The other half of the logo. Never type — 1.89:1 on the ground — so
           it is a rule, a border, a metallic edge, and nothing else. */
        steel: {
          DEFAULT: '#B7B7B5',
          soft:    '#D3D3D1',
        },
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
        /**
         * The ground was re-ranked, not replaced — asked for three times, and
         * each time I changed something else instead.
         *
         * #1C1917 is a good colour and it stays in the system. It was the wrong
         * GROUND. Painted flat across a whole viewport it sits at about 10%
         * luminance, which is light enough that nothing on top of it can read
         * as bright: the brass loses its metal, the off-white loses its snap,
         * and the whole frame lands in one narrow tonal band — which is exactly
         * what "dull" describes. The reference sites all ground much darker and
         * spend the range on the subject.
         *
         * So every value moved down one rung. #1C1917 is now `raised`, where it
         * does what it is good at: lifted surfaces, cards, the panels that need
         * to separate from the ground. The ground itself is #121010, and the
         * recess below it is near-black. Same hue family, same approved
         * identity, roughly double the contrast range to spend.
         */
        /**
         * The approved accent, named `brass` rather than `gold` because a
         * legacy `gold` scale already exists further down this same object.
         * Two keys of the same name do not merge — the later one silently
         * replaces the earlier, so `text-gold-bright` was resolving to nothing
         * at all and `border-gold` to the old blush tan.
         */
        // `night` is an alias kept for the pages that still use it (the body
        // ground is `bg-night`). It must track `ink` exactly — two names for
        // one ground that drift apart is how half a site ends up a shade
        // lighter than the other half.
        // Vijey Textile — "Wine & Steel" palette, matched to the logo's own color
        /**
         * The legacy `maroon-*` ramp, remapped onto the logo's cerise.
         *
         * It was still the old dark scale, which is why a filled Add-to-bag
         * button rendered near-black with near-black text on it — invisible,
         * on the one control the shop most needs a customer to press. Dozens
         * of usages point at these numbers, so remapping the ramp fixes them
         * all rather than hunting each one.
         */
        maroon: {
          50:  '#FBF7F1',
          100: '#F3EDE4',
          200: '#DFD2C0',
          300: '#EFA0BA',
          400: '#E06A90',
          500: '#C22B62',
          600: '#A21D48',
          700: '#86173A',
          800: '#6B1230',
          900: '#4E0C22',
          950: '#2F0715',
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
        /**
         * DOCUMENT SCALE — for pages that are read rather than looked at.
         *
         * The policy pages were set in `chapter` and `band`, which are HERO
         * steps: at a 1280px window `chapter` resolves to 96px and `band` to
         * 59px. A cancellation policy is a functional document somebody opens
         * with a question, and at that size its headline alone took 200px and
         * two lines, the first section heading took two more, and the answer —
         * "1 hour to cancel" — sat below the fold. The document read as
         * enormous even though no paragraph in it exceeds 41 words, which is
         * why trimming the prose had not fixed it.
         *
         * These are sized so a heading is unmistakably a heading and nothing
         * more: 41px and 25px at 1280px, roughly a print document's
         * title-to-heading ratio, and they still scale with the viewport.
         */
        'doc':     ['clamp(1.75rem, 3.2vw, 2.6rem)',  { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        'doc-head':['clamp(1.2rem, 1.95vw, 1.6rem)',  { lineHeight: '1.2',  letterSpacing: '-0.01em' }],
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
