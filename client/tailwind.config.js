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
        // Couleur principale de l'appli : noir et jaune (clairs = jaunes, foncés = noirs)
        brand: {
          50: '#FFFBE0',
          100: '#FFF3B0',
          200: '#FFE566',
          300: '#FFD60A',
          400: '#FFD60A',
          500: '#FFD60A',
          600: '#111112',
          700: '#000000',
          800: '#1A1A1C',
          900: '#111112',
          950: '#0A0A0A',
        },
        // Gris de l'onglet Tâches et du menu : les valeurs sont dans index.css
        // (sombres pour le menu, claires pour les pages)
        ink: {
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          100: 'rgb(var(--ink-100) / <alpha-value>)',
          300: 'rgb(var(--ink-300) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          650: 'rgb(var(--ink-650) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          750: 'rgb(var(--ink-750) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          850: 'rgb(var(--ink-850) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          950: 'rgb(var(--ink-950) / <alpha-value>)',
        },
        sun: {
          DEFAULT: '#FFD60A',
          300: '#FFE566',
        },
        // Texte d'accent (jaune sur fond noir, doré foncé sur fond clair)
        accent: 'rgb(var(--accent) / <alpha-value>)',
        late: 'rgb(var(--late) / <alpha-value>)',
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
