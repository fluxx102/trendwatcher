import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter Variable'", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["'Source Serif 4 Variable'", "Georgia", "serif"],
      },
      colors: {
        ink: { DEFAULT: "#16181d", 2: "#3b3f48", 3: "#6b707c", 4: "#9a9ea8" },
        line: { DEFAULT: "#e6e4df", 2: "#d9d6cf" },
        paper: { DEFAULT: "#fbfaf7", 2: "#f4f2ed" },
        accent: { DEFAULT: "#0f766e", soft: "#e6f2f0", ink: "#0b5953" },
        cobalt: { DEFAULT: "#2c4fd6", soft: "#eaeefc" },
        amber: { DEFAULT: "#b45309", soft: "#fbf1e4" },
        rose: { DEFAULT: "#b4233c", soft: "#fbeaec" },
      },
      boxShadow: {
        card: "0 1px 0 rgba(22,24,29,0.04), 0 1px 3px rgba(22,24,29,0.04)",
        pop: "0 8px 30px rgba(22,24,29,0.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;
