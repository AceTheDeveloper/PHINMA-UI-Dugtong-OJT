import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
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
};

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
      </body>
    </html>
  );
}
