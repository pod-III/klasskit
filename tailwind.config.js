/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './*.html',
    './admin/**/*.{html,js}',
    './api/**/*.html',
    './components/**/*.js',
    './js/**/*.js',
    './apps/**/*.{html,js}',
  ],
  safelist: [
    {
      pattern: /^(bg|text|border)-(pink|orange|green|blue|purple|yellow|red|slate)(\/10)?$/,
    },
  ],
  theme: {
    extend: {
      colors: {
        pink: '#ff4785',
        orange: '#ff7e33',
        green: '#00d063',
        blue: '#1ea7fd',
        dark: '#1e293b',
        chalk: '#f8fafc',
        brand: {
          pink: '#ff4785',
          orange: '#ff7e33',
          green: '#00d063',
          blue: '#1ea7fd',
          purple: '#a855f7',
          yellow: '#facc15',
          red: '#ef4444',
          slate: '#64748b',
          dark: '#1e293b',
          chalk: '#f8fafc',
        },
      },
      fontFamily: {
        heading: ['Fredoka', 'sans-serif'],
        body: ['Nunito', 'sans-serif'],
        sans: ['Nunito', 'sans-serif'],
        fredoka: ['Fredoka', 'sans-serif'],
        nunito: ['Nunito', 'sans-serif'],
      },
      boxShadow: {
        'hard-sm': '2px 2px 0px 0px rgba(30, 41, 59, 1)',
        'hard': '4px 4px 0px 0px rgba(30, 41, 59, 1)',
        'hard-md': '6px 6px 0px 0px rgba(30, 41, 59, 1)',
        'hard-lg': '8px 8px 0px 0px rgba(30, 41, 59, 1)',
        'hard-xl': '12px 12px 0px 0px rgba(30, 41, 59, 1)',
        'neon-sm': '2px 2px 0px 0px rgba(0, 0, 0, 0.5)',
        'neon': '4px 4px 0px 0px rgba(0, 0, 0, 0.5)',
        'neo-sm': 'var(--shadow-hard-sm)',
        'neo': 'var(--shadow-hard-md)',
        'neo-lg': 'var(--shadow-lg)',
      },
      borderWidth: {
        '3': '3px',
        '4': '4px',
      },
      animation: {
        'pop-in': 'pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'slide-down': 'slide-down 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
      keyframes: {
        'bounce-slight': {
          '0%, 100%': { transform: 'translateY(-3%)' },
          '50%': { transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
