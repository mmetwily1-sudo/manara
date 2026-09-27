/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { light: "#d1fae5", DEFAULT: "#047857", dark: "#065f46" },
        surface: "#ffffff",
        bg: "#f8fafc",
        success: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
      },
      fontSize: {
        display: ["2.5rem", { fontWeight: "800" }],
        h1: ["1.5rem", { fontWeight: "800" }],
        h2: ["1.25rem", { fontWeight: "700" }],
        body: ["1rem", { lineHeight: "1.75" }],
        small: ["0.875rem", { lineHeight: "1.6" }],
      },
    },
  },
  plugins: [],
};
