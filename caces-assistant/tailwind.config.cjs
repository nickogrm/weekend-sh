/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./renderer/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#00f5ff',
          blue: '#0080ff',
          purple: '#8b5cf6',
          green: '#00ff88',
          red: '#ff4466',
          amber: '#ffaa00',
        },
        dark: {
          base: '#0a0a0f',
          surface: '#0f0f1a',
          panel: '#141428',
          card: '#1a1a2e',
          input: '#0d0d1f',
          border: '#1e2040',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      animation: {
        'waveform': 'waveform 1.2s ease-in-out infinite',
        'pulse-neon': 'pulseNeon 2s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.4s ease-out forwards',
        'blink': 'blink 1s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        waveform: {
          '0%, 100%': { transform: 'scaleY(0.2)', opacity: '0.4' },
          '50%': { transform: 'scaleY(1)', opacity: '1' },
        },
        pulseNeon: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0,245,255,0.4)' },
          '50%': { boxShadow: '0 0 30px rgba(0,245,255,0.8), 0 0 60px rgba(0,245,255,0.3)' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
