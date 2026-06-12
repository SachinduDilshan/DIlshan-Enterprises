import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4338CA",
          700: "#3730A3",
          800: "#312E81",
          900: "#1E1B4B",
        },
        accent: { 500: "#0EA5E9" },
        success:{ 50: "#ECFDF5", 500: "#10B981", 700: "#065F46" },
        warning:{ 50: "#FFFBEB", 500: "#F59E0B", 700: "#92400E" },
        danger: { 50: "#FEF2F2", 500: "#EF4444", 700: "#991B1B" },
      },
      borderRadius: { xl: "0.75rem", "2xl": "1rem", "3xl": "1.5rem" },
    },
  },
  plugins: [],
};

export default config;