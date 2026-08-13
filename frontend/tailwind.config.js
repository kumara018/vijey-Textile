/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
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
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
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
