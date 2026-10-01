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
          deep: "#0F3D91",
          light: "#E8F0FE",
          soft: "#F2F7FE",
        },
        accent: {
          DEFAULT: "#7C3AED",
          light: "#EDE9FE",
        },
        gold: {
          DEFAULT: "#F59E0B",
          light: "#FEF3C7",
        },
        success: "#059669",
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
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.05), 0 12px 32px -16px rgba(15, 23, 42, 0.12)",
        pop: "0 8px 30px -6px rgba(26, 115, 232, 0.35)",
        glow: "0 0 0 4px rgba(26, 115, 232, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
