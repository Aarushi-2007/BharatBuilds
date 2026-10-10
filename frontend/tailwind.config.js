/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        brand: { 25: "#f2f7ff", 50: "#ecf3ff", 100: "#dde9ff", 200: "#c2d6ff", 300: "#9cb9ff",
                 400: "#7592ff", 500: "#465fff", 600: "#3641f5", 700: "#2a31d8", 800: "#252dae", 900: "#262e89" },
        ink: { DEFAULT: "#101828", soft: "#344054", muted: "#667085", faint: "#98a2b3" },
        night: { 900: "#0c111d", 800: "#101828", 700: "#1d2939", 600: "#344054" },
      },
      boxShadow: { card: "0 1px 2px 0 rgba(16,24,40,0.05)" },
    },
  },
  plugins: [],
};
