import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
import { pwaColors } from "@/lib/pwa/colors";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import "./globals.css";

// One family for the whole interface: IBM Plex Sans, a clear, institutional face
// with excellent tabular figures. Headings and big numbers are the same family at
// a heavier weight and a tighter tracking. The monospace is only for codes: a
// student number, a stamped clock time.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dugtong OJT",
  description:
    "Students log their hours and a short daily journal. Supervisors approve them the same day. Coordinators see every student's progress without chasing signatures.",
  // The manifest (app/manifest.ts) is linked automatically. iOS ignores its icons
  // and needs its own, and "capable" opens the installed app without browser chrome.
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Dugtong", statusBarStyle: "default" },
};

// The browser bar follows the page background of each theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: pwaColors.background },
    { media: "(prefers-color-scheme: dark)", color: pwaColors.darkBackground },
  ],
};

// A new build is a new service worker URL, so an installed app updates on its
// next launch. VERCEL_GIT_COMMIT_SHA or the build time is set in next.config.ts.
const serviceWorkerVersion = process.env.NEXT_PUBLIC_SW_VERSION ?? "dev";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`const preference = localStorage.getItem("dugtong-theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.classList.toggle(
  "dark",
  preference === "dark" || (preference !== "light" && prefersDark),
);`}
        </Script>
      </head>
      <body className="font-sans text-ink" suppressHydrationWarning>
        {children}
        <RegisterServiceWorker version={serviceWorkerVersion} />
      </body>
    </html>
  );
}
