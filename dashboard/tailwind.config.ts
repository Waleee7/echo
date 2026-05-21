import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Jarvis palette — Iron Man HUD blue
        // (class names kept as `charcoal-*` and `amber-*` for code stability;
        //  values redefined to Jarvis blue/black scheme)
        charcoal: {
          900: "#050b14",
          800: "#0a1626",
          700: "#0f2238",
          600: "#163150",
        },
        amber: {
          glow: "#9DDCFF",
          core: "#4FC3FF",
          deep: "#1E7BCC",
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
