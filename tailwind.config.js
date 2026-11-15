/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mars: {
          900: '#140806',
          800: '#230f0a',
          700: '#38160e',
          600: '#522013',
          500: '#85321d',
          400: '#b84424',
          300: '#d96338',
          200: '#e8916e',
          100: '#f8d2c2',
        },
        hud: {
          cyan: '#00f0ff',
          amber: '#ffb000',
          emerald: '#00ff88',
          red: '#ff3344',
          purple: '#d946ef',
          blue: '#38bdf8',
          dark: '#080c10',
          panel: 'rgba(12, 19, 28, 0.88)',
          card: 'rgba(15, 23, 36, 0.95)',
          border: 'rgba(0, 240, 255, 0.25)',
          glow: 'rgba(0, 240, 255, 0.15)',
        }
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['"Orbitron"', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        'hud-cyan': '0 0 15px rgba(0, 240, 255, 0.25)',
        'hud-amber': '0 0 15px rgba(255, 176, 0, 0.25)',
        'hud-red': '0 0 20px rgba(255, 51, 68, 0.35)',
        'hud-emerald': '0 0 15px rgba(0, 255, 136, 0.25)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      }
    },
  },
  plugins: [],
}
