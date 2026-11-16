import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Colophon — Library circulation on a verifiable ledger",
    short_name: "Colophon",
    description:
      "A blockchain library circulation system with browser-native WebCrypto ECDSA P-256 signatures, Merkle-sealed blocks, and proof-of-work verification.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#101816",
    theme_color: "#1B3832",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
