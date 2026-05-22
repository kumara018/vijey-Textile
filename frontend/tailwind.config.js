/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Vijey Textile — Rose Gold Blush luxury palette
        maroon: {
          50:  '#fff0f6',
          100: '#ffe4f0',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be185d',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #be185d 0%, #9f1239 100%)',
        'gold-gradient':  'linear-gradient(135deg, #f59e0b 0%, #fcd34d 100%)',
        'luxury-gradient': 'linear-gradient(135deg, #9f1239 0%, #be185d 50%, #e11d48 100%)',
      },
    },
  },
  plugins: [],
};
