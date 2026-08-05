/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Vijey Textile — "Pearl & Ink" luxury palette
        maroon: {
          50:  '#faf7f2',
          100: '#f4ede1',
          200: '#ece0cd',
          300: '#ddcfb8',
          400: '#b8a68a',
          500: '#8f7a5f',
          600: '#6b5a44',
          700: '#4a3d2c',
          800: '#2e2419',
          900: '#1c1712',
          950: '#100d09',
        },
        silver: {
          50:  '#faf9f7',
          100: '#f1efe9',
          200: '#e3ded2',
          300: '#cdc4b0',
          400: '#a89c81',
          500: '#87795f',
          600: '#665c47',
          700: '#4a4234',
          800: '#302a20',
          900: '#1a1611',
        },
        gold: {
          50:  '#fbf3e7',
          100: '#f5e3c4',
          200: '#eccd97',
          300: '#dfb06a',
          400: '#c99a5f',
          500: '#a8763f',
          600: '#8f6333',
          700: '#6f4d28',
          800: '#503a1e',
          900: '#362813',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #a8763f 0%, #6f4d28 100%)',
        'gold-gradient':  'linear-gradient(135deg, #ddcfb8 0%, #f4ede1 50%, #ddcfb8 100%)',
        'luxury-gradient': 'linear-gradient(135deg, #1c1712 0%, #4a3d2c 55%, #a8763f 100%)',
      },
    },
  },
  plugins: [],
};
