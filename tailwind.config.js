/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './admin/src/**/*.{ts,tsx}',
    './admin/index.html',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(239, 238, 231)',
        paper: 'rgb(225, 218, 205)',
        ink: 'rgb(20, 20, 19)',
        muted: 'rgb(108, 107, 104)',
      },
      boxShadow: {
        soft: '0 18px 40px rgba(20, 20, 19, 0.08)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      keyframes: {
        'dropdown-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'dropdown-out': {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
      },
      animation: {
        'dropdown-in': 'dropdown-in 120ms ease-out',
        'dropdown-out': 'dropdown-out 100ms ease-in forwards',
      },
    },
  },
  plugins: [],
};
