/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: '#07111f',
        surface: '#0d1b2f',
        panel: '#13233d',
        border: '#223553',
        accent: '#38bdf8',
        success: '#22c55e',
        danger: '#ef4444',
        warning: '#f59e0b',
        muted: '#93a4bf',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 20px 45px rgba(8, 15, 30, 0.45)',
      },
      backgroundImage: {
        grid:
          'linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}
