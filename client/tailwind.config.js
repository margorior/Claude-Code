/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dae6ff',
          200: '#bdd2ff',
          300: '#90b4ff',
          400: '#5b8bfc',
          500: '#3663f5',
          600: '#2347ea',
          700: '#1b35d7',
          800: '#1d2eae',
          900: '#1d2c89',
          950: '#161d53',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1)',
        pop: '0 8px 30px rgba(16,24,40,.16)',
      },
    },
  },
  plugins: [],
};
