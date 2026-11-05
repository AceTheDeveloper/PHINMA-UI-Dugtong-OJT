// The colours a browser reads outside the stylesheet: the manifest (which cannot
// use CSS variables) and the browser bar. They are copied from app/globals.css,
// and tests/pwa/manifest.test.ts fails if they drift from it.
export const pwaColors = {
  // --background and --primary of the light theme
  background: "#f4f6fb",
  primary: "#2255f2",
  // --background of the dark theme
  darkBackground: "#0a1224",
} as const;
