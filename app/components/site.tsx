"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Button, Caption, Logo } from "@breadcoop/ui"

/* Shared chrome: sticky nav + footer, in the crowdstake.fun idiom. */

export function SiteNav({
  links,
  cta = "app",
}: {
  links?: { href: string; label: string }[]
  cta?: "app" | "home"
}) {
  return (
    <header className="border-paper-2 bg-paper-main/80 sticky top-0 z-50 border-b backdrop-blur">
      <nav className="section-container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo variant="square" color="orange" size={32} />
          <span className="font-breadDisplay text-text-standard text-xl font-bold">
            Long Bread
          </span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {(links ?? []).map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-surface-grey-2 hover:text-core-orange text-sm font-medium transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {cta === "app" ? (
            <>
              <Button app="fund" variant="secondary" size="sm" as={Link} href="/docs">
                Guide
              </Button>
              <Button app="fund" variant="primary" size="sm" as={Link} href="/app">
                Open the app
              </Button>
            </>
          ) : (
            <>
              <Button app="fund" variant="secondary" size="sm" as={Link} href="/">
                Home
              </Button>
              <Button app="fund" variant="primary" size="sm" as={Link} href="/app">
                Open the app
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-paper-2 border-t">
      <div className="section-container flex flex-col items-start justify-between gap-6 py-10 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Logo variant="square" color="orange" size={28} />
            <span className="font-breadDisplay text-text-standard text-lg font-bold">
              Long Bread
            </span>
          </div>
          <Caption className="text-surface-grey-2 mt-2 block max-w-md">
            A lifetime income circle you run together. No company in the middle —
            the rules run themselves on a public ledger, and your circle can check
            every cent.
          </Caption>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <FooterLink href="/app">Open the app</FooterLink>
          <FooterLink href="/docs">Guide</FooterLink>
          <FooterLink href="https://github.com/RonTuretzky/zk-tontine" external>
            Source code
          </FooterLink>
          <FooterLink
            href="https://gnosis.blockscout.com/address/0x9F3BEa11734570A8260CB560f0CdeF11Ac8258f5"
            external
          >
            The books, in public
          </FooterLink>
        </div>
      </div>
      <div className="border-paper-2 border-t">
        <div className="section-container py-4">
          <Caption className="text-surface-grey-2">
            Built with the Bread Cooperative design kit · Runs on Gnosis Chain ·
            This is a live demonstration circle — see the guide for what&apos;s
            simulated.
          </Caption>
        </div>
      </div>
    </footer>
  )
}

function FooterLink({
  href,
  children,
  external,
}: {
  href: string
  children: ReactNode
  external?: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="text-surface-grey-2 hover:text-core-orange font-medium transition-colors"
    >
      {children}
    </a>
  )
}
