import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEEADF" },
    { media: "(prefers-color-scheme: dark)", color: "#101816" },
  ],
};

export const metadata: Metadata = {
  title: "Colophon — Library circulation on a verifiable ledger",
  description:
    "A blockchain-based library management system: signed loans, Merkle-sealed blocks, proof-of-work, and a ledger anyone can verify.",
  applicationName: "Colophon",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Colophon",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,300..500;1,6..72,300..500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
