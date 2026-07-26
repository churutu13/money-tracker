import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        accent: "hsl(var(--accent))",
        destructive: "hsl(var(--destructive))"
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.35rem"
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.03), 0 8px 30px rgba(15, 23, 42, 0.04)"
      }
    }
  },
  plugins: []
} satisfies Config;
