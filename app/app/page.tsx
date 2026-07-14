"use client"

import { Body, Caption, Heading1, LoginButton, Logo } from "@breadcoop/ui"
import { useState } from "react"
import { PoolOverview } from "../components/PoolOverview"
import { AccountPanel } from "../components/AccountPanel"
import { ClaimsPanel } from "../components/ClaimsPanel"

const TABS = [
  { key: "pool", label: "The pool" },
  { key: "you", label: "Your place in it" },
  { key: "claims", label: "Deaths & disputes" },
] as const

type TabKey = (typeof TABS)[number]["key"]

export default function Home() {
  const [tab, setTab] = useState<TabKey>("pool")

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24">
      <header className="flex items-center justify-between gap-4 py-6">
        <div className="flex items-center gap-3">
          <Logo variant="square" size={44} />
          <div>
            <span className="font-bold text-xl leading-none block">Long Bread</span>
            <Caption>a lifetime income pool you run together</Caption>
          </div>
        </div>
        <LoginButton />
      </header>

      <section className="card mb-6" style={{ background: "#fdf0e7" }}>
        <Body bold>Demo mode — real rules, stand-in proofs.</Body>
        <Body>
          Every rule below is live on Gnosis Chain: bonds, challenge windows, heartbeat
          deadlines, and the fair split of a member&apos;s balance when they pass. Only the
          email proofs themselves are simulated — you type what the zk circuit would have
          extracted from a real DKIM-signed email, and the pool takes it from there.
          Windows are minutes instead of months so you can walk the whole life of the pool
          in one sitting.
        </Body>
      </section>

      <nav className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-full border-[1.5px] font-bold text-sm"
            style={{
              borderColor: "#171414",
              background: tab === t.key ? "#EA5817" : "#fff",
              color: tab === t.key ? "#fff" : "#171414",
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "pool" && <PoolOverview />}
      {tab === "you" && <AccountPanel />}
      {tab === "claims" && <ClaimsPanel />}

      <footer className="mt-16 border-t-[1.5px] border-[#171414] pt-6">
        <Caption>
          Savings sit in sDAI and grow together. When a member passes, their balance flows
          to the people still at the table — split by the fair-transfer rule, with a slice
          for whoever brought the news and a bequest for the family if the member chose
          one. No company holds the money. No one can quietly walk off with the pot — that
          is what killed tontines in 1905, and it is the one problem a public ledger
          actually solves.
        </Caption>
      </footer>
    </main>
  )
}
