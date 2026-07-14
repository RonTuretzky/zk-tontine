import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "Long Bread — income for life, from a circle of friends",
  description:
    "A savings circle that pays its members a monthly income for as long as they live. No company in the middle, refundable until the doors close, and the books are public.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-paper-main min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
