import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1A73E8",
          dark: "#1557B0",
          light: "#E8F0FE",
        },
        success: "#16A34A",
        warning: "#D97706",
        danger: "#DC2626",
        surface: "#FFFFFF",
        bg: "#F8FAFC",
      },
      fontFamily: {
        sans: ["Cairo", "Tajawal", "Segoe UI", "Tahoma", "sans-serif"],
      },
      fontSize: {
        // scale 1.25 من الأساس
        "display": ["2.5rem", { lineHeight: "1.2", fontWeight: "800" }],
        "h1": ["1.875rem", { lineHeight: "1.3", fontWeight: "700" }],
        "h2": ["1.5rem", { lineHeight: "1.35", fontWeight: "700" }],
        "body": ["1rem", { lineHeight: "1.75" }],
        "small": ["0.875rem", { lineHeight: "1.6" }],
      },
      borderRadius: {
        xl: "1rem",
      },
    },
  },
  plugins: [],
};
export default config;
