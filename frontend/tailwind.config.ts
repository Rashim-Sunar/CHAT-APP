import type { Config } from "tailwindcss";
import daisyui from "daisyui";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Marketing-page brand palette (see pages/landing/). App screens keep
      // using Tailwind's default indigo/slate — this is scoped to landing.
      colors: {
        ink: {
          DEFAULT: "#1B1035",
          light: "#2E1F52",
        },
        brand: {
          50: "#F1F0FD",
          100: "#E4E2FB",
          400: "#8B80F0",
          500: "#5B4FE9",
          600: "#4A3ED6",
          700: "#3C31B0",
        },
        mint: {
          DEFAULT: "#35D0BA",
          dark: "#1FA593",
        },
      },
      fontFamily: {
        display: ["\"Space Grotesk\"", "system-ui", "sans-serif"],
        body: ["\"Inter\"", "system-ui", "sans-serif"],
        mono: ["\"JetBrains Mono\"", "ui-monospace", "monospace"],
      },
      maxWidth: {
        landing: "1280px",
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: ["light"],
  },
} satisfies Config;