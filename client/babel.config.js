module.exports = function (api) {
  api.cache(true);
  return {
    // jsxImportSource lets NativeWind turn className into styles on native.
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
