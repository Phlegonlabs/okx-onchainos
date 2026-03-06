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
  title: "Trading Strategy Agent Gateway",
  description:
    "Private agent gateway for crypto strategy discovery, gated research, and x402-settled live signals on OKX OnchainOS.",
  openGraph: {
    title: "Trading Strategy Agent Gateway",
    description:
      "Private skill access to approved crypto trading strategies, research endpoints, and x402 settlement on X Layer.",
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
                TG
              </div>
              <div>
                <p className="display-font text-base font-semibold leading-none text-zinc-50">
                  Trading Strategy Gateway
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  Private Skill Rail
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-4 sm:gap-5">
              <Link
                href="/"
                className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
              >
                Gateway
              </Link>
              <Link
                href="/operations"
                className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
              >
                Operations
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
              Trading Strategy Agent Gateway | OKX OnchainOS Hackathon 2026
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
