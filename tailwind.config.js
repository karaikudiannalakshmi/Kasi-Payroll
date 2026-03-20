/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        saffron: { 50: '#fff8ed', 100: '#ffefd4', 200: '#ffd99e', 500: '#f97316', 600: '#ea6c0a', 700: '#c45507' },
        maroon: { 600: '#7f1d1d', 700: '#6b1414', 800: '#591010' },
      },
    },
  },
  plugins: [],
};
