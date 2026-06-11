/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#fff8e7',
        surface: '#ffffff',
        border: '#161616',
        text: '#161616',
        muted: '#665f73',
        green: '#31d17c',
        blue: '#7657ff',
        red: '#ff5b6e',
        amber: '#ffcf3f',
        pink: '#ff8fcb',
        cyan: '#65d9ff',
      },
      fontFamily: {
        sans: ['"Arial Rounded MT Bold"', '"Trebuchet MS"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
