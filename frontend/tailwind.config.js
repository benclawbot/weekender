/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#fafaf8',
        surface: '#f2f1ee',
        border: '#e4e3de',
        text: '#1a1a18',
        muted: '#7a7971',
        green: '#3b6d11',
        blue: '#185fa5',
        red: '#a32d2d',
        amber: '#8b5a00',
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
}