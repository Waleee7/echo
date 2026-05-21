import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Echo palette — pulled from the brain reference image
        charcoal: {
          900: "#1a1a1a",
          800: "#222222",
          700: "#2a2a2a",
          600: "#333333",
        },
        amber: {
          glow: "#FFD27A",
          core: "#FFA940",
          deep: "#B86E18",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
