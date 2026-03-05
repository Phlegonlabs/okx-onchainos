import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Strategy Square | AI Strategy Marketplace",
  description:
    "AI-native on-chain strategy marketplace powered by OKX OnchainOS. Purchase trading signals via x402.",
  openGraph: {
    title: "Strategy Square",
    description:
      "Agent-to-agent trading strategy marketplace. Purchase signals via x402 on X Layer.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 px-6 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <a href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                S
              </div>
              <span className="text-lg font-semibold text-zinc-50">
                Strategy Square
              </span>
            </a>
            <div className="flex items-center gap-4">
              <a
                href="/"
                className="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Marketplace
              </a>
              <a
                href="https://github.com/Phlegonlabs/okx-onchainos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
              >
                GitHub
              </a>
              <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-500">
                Powered by OKX OnchainOS
              </span>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="border-t border-zinc-900 px-6 py-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <p className="text-xs text-zinc-600">
              Strategy Square &mdash; OKX OnchainOS Hackathon 2026
            </p>
            <div className="flex items-center gap-3 text-xs text-zinc-600">
              <span>x402 Payments</span>
              <span>&middot;</span>
              <span>X Layer</span>
              <span>&middot;</span>
              <span>Zero Gas</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
