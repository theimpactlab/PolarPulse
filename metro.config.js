// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { resolve } = require("metro-resolver");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable Watchman for file watching.
config.resolver.useWatchman = false;

// Configure asset and source extensions.
const { assetExts, sourceExts } = config.resolver;

// Keep your transformer options.
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// If you import SVG files as React components (e.g. `import Logo from "./logo.svg"`),
// keep this transformer. If you never import SVGs, you can remove this line.
config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer"
);

// Keep SVG support + web module mocking (as you had it), with a safe default resolver fallback.
config.resolver = {
  ...config.resolver,
  assetExts: assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...sourceExts, "svg"],
  useWatchman: false,
  resolveRequest: (context, moduleName, platform) => {
    if (platform === "web") {
      const nativeOnlyModules = [
        "react-native-pager-view",
        "reanimated-tab-view",
        "@bottom-tabs/react-navigation",
      ];

      if (nativeOnlyModules.some((mod) => moduleName.includes(mod))) {
        return { type: "empty" };
      }
    }

    // Fall back to Metro's default resolver.
    return resolve(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: "./global.css" });