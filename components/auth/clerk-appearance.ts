// Clerk's prebuilt sign-in and sign-up components, styled with our tokens so
// they follow the light and dark themes. The heading is ours, so Clerk's own
// title is hidden; the footer (including Clerk's branding) is left as is.
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--primary)",
    colorBackground: "var(--card)",
    colorForeground: "var(--ink)",
    colorMutedForeground: "var(--muted)",
    colorNeutral: "var(--ink)",
    colorInput: "var(--background)",
    colorInputForeground: "var(--ink)",
    colorDanger: "var(--error)",
    colorSuccess: "var(--success)",
    borderRadius: "10px",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full max-w-none shadow-none",
    card: "w-full bg-transparent p-0 shadow-none",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
  },
} as const;
