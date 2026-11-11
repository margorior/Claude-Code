/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
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
        // Onglet Tâches : noir et jaune
        ink: {
          50: '#F4F4F2',
          100: '#E4E4E1',
          300: '#A9A9AE',
          400: '#8C8C92',
          600: '#3A3A40',
          650: '#34343A',
          700: '#2E2E33',
          750: '#252528',
          800: '#1F1F22',
          850: '#1A1A1C',
          900: '#111112',
          950: '#0A0A0A',
        },
        sun: {
          DEFAULT: '#FFD60A',
          300: '#FFE566',
        },
        late: '#FF9F45',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1)',
        pop: '0 8px 30px rgba(16,24,40,.16)',
        lift: '0 18px 40px rgba(0,0,0,.55)',
      },
    },
  },
  plugins: [],
};
