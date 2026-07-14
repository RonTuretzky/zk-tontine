import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "Long Bread — a lifetime income pool you run together",
  description:
    "A tontine your community runs itself: pooled savings, lifetime income, and life & death verified by cryptographic email proofs — no insurer in the middle.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper-main text-system-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
