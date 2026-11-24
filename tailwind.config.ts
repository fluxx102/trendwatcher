import type { Config } from "tailwindcss";

/** Design tokens live as CSS variables in app/globals.css; Tailwind only maps names to them. */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter Variable'", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["'Source Serif 4 Variable'", "Georgia", "serif"],
      },
      // Type scale: 11 / 12 / 13 / 14 / 15 / 17 / 20 / 24 / 32 / 44
      fontSize: {
        micro: ["11px", { lineHeight: "16px", letterSpacing: "0.01em" }],
        xs: ["12px", { lineHeight: "18px" }],
        sm: ["13px", { lineHeight: "20px" }],
        base: ["14px", { lineHeight: "22px" }],
        md: ["15px", { lineHeight: "24px" }],
        lg: ["17px", { lineHeight: "26px" }],
        xl: ["20px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        "2xl": ["24px", { lineHeight: "30px", letterSpacing: "-0.015em" }],
        "3xl": ["32px", { lineHeight: "38px", letterSpacing: "-0.02em" }],
        "4xl": ["44px", { lineHeight: "48px", letterSpacing: "-0.025em" }],
      },
      colors: {
        ink: { DEFAULT: v("ink"), 2: v("ink-2"), 3: v("ink-3"), 4: v("ink-4") },
        line: { DEFAULT: v("line"), 2: v("line-2") },
        paper: { DEFAULT: v("paper"), 2: v("paper-2") },
        surface: v("surface"),
        accent: { DEFAULT: v("accent"), soft: v("accent-soft"), ink: v("accent-ink") },
        cobalt: { DEFAULT: v("cobalt"), soft: v("cobalt-soft") },
        amber: { DEFAULT: v("amber"), soft: v("amber-soft") },
        rose: { DEFAULT: v("rose"), soft: v("rose-soft") },
        prio: { 1: v("prio-1"), 2: v("prio-2"), 3: v("prio-3"), 4: v("prio-4") },
      },
      borderRadius: { sm: "6px", md: "8px", lg: "10px", xl: "14px" },
      boxShadow: {
        card: "0 1px 0 rgb(22 24 29 / 0.04), 0 1px 3px rgb(22 24 29 / 0.04)",
        pop: "0 10px 30px -8px rgb(22 24 29 / 0.16), 0 2px 6px rgb(22 24 29 / 0.05)",
        ring: "0 0 0 1px rgb(var(--line))",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
      },
      transitionDuration: { fast: "150ms", base: "200ms", slow: "300ms" },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "none" } },
        "grow-x": { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
      },
      animation: {
        "fade-up": "fade-up 320ms cubic-bezier(0.23, 1, 0.32, 1) both",
        "fade-in": "fade-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both",
        "scale-in": "scale-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both",
        "grow-x": "grow-x 700ms cubic-bezier(0.23, 1, 0.32, 1) both",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
