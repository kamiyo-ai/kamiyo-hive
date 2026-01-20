import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cyan: '#00f0ff',
        magenta: '#ff44f5',
      },
      fontFamily: {
        mono: ['Atkinson Hyperlegible Mono', 'monospace'],
      },
      fontWeight: {
        medium: '400',
      },
    },
  },
  plugins: [],
} satisfies Config;
