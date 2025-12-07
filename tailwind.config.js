/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Custom premium palette can be defined here if needed, 
        // but we will mostly use slate/zinc/neutral from default theme.
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
