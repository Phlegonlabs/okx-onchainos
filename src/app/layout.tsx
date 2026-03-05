import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-body",
});

const geistMono = Geist_Mono({
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
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>
        <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-black/75 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/" className="group flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-100">
                SS
              </div>
              <div>
                <p className="display-font text-base font-semibold leading-none text-zinc-50">
                  Strategy Square
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  Agent Market on X Layer
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-4 sm:gap-5">
              <Link
                href="/"
                className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
              >
                Marketplace
              </Link>
              <a
                href="https://github.com/Phlegonlabs/okx-onchainos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
              >
                GitHub
              </a>
              <span className="hidden rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-300 sm:inline-flex">
                Powered by x402
              </span>
            </div>
          </div>
        </nav>

        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6">
          {children}
        </main>

        <footer className="border-t border-zinc-900 px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <p className="text-xs text-zinc-500">
              Strategy Square | OKX OnchainOS Hackathon 2026
            </p>
            <div className="mono-font flex items-center gap-3 text-[11px] text-zinc-600">
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
