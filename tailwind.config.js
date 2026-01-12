/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");

module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./App.tsx", "./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  corePlugins: {
    space: false,
  },
  theme: {
    // NOTE to AI: You can extend the theme with custom colors or styles here.
    extend: {
      colors: {
        // Dark theme base colors (Whoop-inspired)
        background: "#0D0D0F",
        surface: "#1A1A1E",
        surfaceLight: "#242428",
        border: "#2E2E33",

        // Score colors
        recovery: {
          high: "#00D1A7",      // Green - good recovery
          moderate: "#F5A623",  // Amber - moderate
          low: "#FF4757",       // Red - poor recovery
        },
        strain: {
          light: "#3B82F6",     // Blue - light strain
          moderate: "#8B5CF6",  // Purple - moderate
          high: "#FF6B35",      // Orange - high strain
          overreaching: "#FF4757", // Red - overreaching
        },
        sleep: {
          optimal: "#00D1A7",   // Green
          adequate: "#3B82F6",  // Blue
          poor: "#FF4757",      // Red
        },

        // Accent colors
        primary: "#00D1A7",     // Teal green accent
        accent: "#8B5CF6",      // Purple accent
        warning: "#F5A623",
        danger: "#FF4757",

        // Text colors
        textPrimary: "#FFFFFF",
        textSecondary: "#9CA3AF",
        textMuted: "#6B7280",
      },
      fontSize: {
        xs: "10px",
        sm: "12px",
        base: "14px",
        lg: "18px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
        "4xl": "40px",
        "5xl": "48px",
        "6xl": "56px",
        "7xl": "64px",
        "8xl": "72px",
        "9xl": "80px",
      },
    },
  },
  darkMode: "class",
  plugins: [
    plugin(({ matchUtilities, theme }) => {
      const spacing = theme("spacing");

      // space-{n}  ->  gap: {n}
      matchUtilities(
        { space: (value) => ({ gap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] }
      );

      // space-x-{n}  ->  column-gap: {n}
      matchUtilities(
        { "space-x": (value) => ({ columnGap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] }
      );

      // space-y-{n}  ->  row-gap: {n}
      matchUtilities(
        { "space-y": (value) => ({ rowGap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] }
      );
    }),
  ],
};

