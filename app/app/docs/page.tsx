"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Body, Button, Caption } from "@breadcoop/ui"
import {
  ArrowRight,
  ArrowSquareOut,
  ChartLineUp,
  EnvelopeSimple,
  Eye,
  HandCoins,
  HandHeart,
  Handshake,
  Plugs,
  ShieldWarning,
  Sparkle,
} from "@phosphor-icons/react"
import { SiteFooter, SiteNav } from "../../components/site"
import { ADDRESSES } from "../../lib/contracts"

// Static export honours NEXT_PUBLIC_BASE_PATH (e.g. /zk-tontine on Pages).
// Plain <img> tags don't get it prepended automatically, so do it here.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ""
const gif = (name: string) => `${BASE}/docs/${name}`

type Flow = {
  id: string
  n: number
  icon: ReactNode
  title: string
  blurb: string
  steps: string[]
  media: string
}

const FLOWS: Flow[] = [
  {
    id: "explore",
    n: 1,
    icon: <Sparkle weight="duotone" />,
    title: "Explore the circle",
    blurb:
      "Start on the home page: the five ideas behind the circle, and a calculator that shows what a stake like yours could pay at every age.",
    steps: [
      "Walk the five steps under “How the circle works” — join, grow, check in, share, income.",
      "Slide the calculator to your age and stake to see your monthly draw, today and at 80.",
      "Hit “Open the app” when you're ready.",
    ],
    media: "landing-tour.gif",
  },
  {
    id: "connect",
    n: 2,
    icon: <Plugs weight="duotone" />,
    title: "Connect a wallet",
    blurb:
      "Everything is browsable before you connect — the members table, the pot, open matters. Connecting is only needed to act.",
    steps: [
      "Click Connect Wallet in the top corner and pick your wallet.",
      "Approve the connection on Gnosis Chain — the app runs nowhere else.",
      "You'll need a little xDAI for fees; a few cents covers everything beyond your stake.",
    ],
    media: "connect.gif",
  },
  {
    id: "link",
    n: 3,
    icon: <EnvelopeSimple weight="duotone" />,
    title: "Link your email",
    blurb:
      "Your email address is your identity in the circle. The circle only ever stores a private fingerprint of it — never the address, never your name.",
    steps: [
      "Open the Join tab and type your email — it never leaves your browser.",
      "Pick your email provider.",
      "Confirm. Your member card appears on the Overview table.",
    ],
    media: "link-email.gif",
  },
  {
    id: "join",
    n: 4,
    icon: <Handshake weight="duotone" />,
    title: "Take a seat",
    blurb:
      "Choose a stake, your year of birth, and the family share — the slice of your balance that goes straight to a person you name.",
    steps: [
      "Enter your stake in xDAI (the app sets it aside and hands it to the circle in three quick confirmations).",
      "Set the family share, from nothing up to half, and who receives it.",
      "Take your seat. Until the doors close you can leave with a full refund.",
    ],
    media: "join.gif",
  },
  {
    id: "checkin",
    n: 5,
    icon: <ChartLineUp weight="duotone" />,
    title: "Check in each season",
    blurb:
      "One short email a season keeps your income flowing. The code word only exists once the season starts, so a check-in can't be faked in advance.",
    steps: [
      "Open the Check in tab and copy this season's code word into an email subject line.",
      "Confirm the check-in in the app.",
      "Miss one? Nothing is lost — income pauses and waits for your next check-in.",
    ],
    media: "checkin.gif",
  },
  {
    id: "report",
    n: 6,
    icon: <HandHeart weight="duotone" />,
    title: "Report a passing",
    blurb:
      "When a member passes, anyone holding the notification email — from a funeral home, an obituary page, an insurer — can bring the news, with a good-faith deposit.",
    steps: [
      "Copy the member's card from the Overview table into the Passings tab.",
      "Pick the institution whose email you hold and confirm, depositing the good-faith amount.",
      "The waiting period begins — visible to the whole circle under Open matters.",
    ],
    media: "report.gif",
  },
  {
    id: "dispute",
    n: 7,
    icon: <ShieldWarning weight="duotone" />,
    title: "Cancel a mistake",
    blurb:
      "People do get wrongly reported — that's why nothing moves during the waiting period, and why being wrong costs the reporter their deposit.",
    steps: [
      "A reported member sees a warning on their Check in tab.",
      "They check in once, exactly as they do every season.",
      "The report is cancelled and the reporter's deposit lands in the member's wallet.",
    ],
    media: "dispute.gif",
  },
  {
    id: "settle",
    n: 8,
    icon: <HandCoins weight="duotone" />,
    title: "Share out an estate",
    blurb:
      "If the waiting period passes quietly, the passing is final and anyone can trigger the share-out — no committee, no paperwork.",
    steps: [
      "Under Open matters, make the report final once its waiting period ends.",
      "Trigger the share-out: family share to the named person, the thank-you to the reporter, the rest to the circle.",
      "Every surviving member's balance grows — split by age and stake, the way actuaries do it.",
    ],
    media: "settle.gif",
  },
  {
    id: "income",
    n: 9,
    icon: <Eye weight="duotone" />,
    title: "Draw your income",
    blurb:
      "Once a circle's doors close, every member draws monthly — sized to their age, growing as the circle shares, for as long as they live.",
    steps: [
      "Open the Income tab. Your monthly amount is computed from your age and balance.",
      "Draw it. What the circle has shared with you is spent before your own stake.",
      "Missed months accumulate for up to a year — travel worry-free.",
    ],
    media: "income.gif",
  },
]

const SYSTEM: [string, string][] = [
  ["The mortality record (who's here, who's passed)", ADDRESSES.lifeOracle],
  ["First Circle (paying income)", ADDRESSES.pool],
  ["Rising Circle (open to join)", "0x251d5EdBcF3F1096797525F83a85F5B60F3a5312"],
  ["Circle maker (anyone can start one)", ADDRESSES.factory],
  ["Email trust list", ADDRESSES.dkimRegistry],
  ["Email proof checker", ADDRESSES.zkEmailVerifier],
  ["The savings vault (Gnosis sDAI)", ADDRESSES.sdai],
]

export default function DocsPage() {
  return (
    <div className="bg-paper-main min-h-screen">
      <SiteNav cta="home" />

      {/* Hero */}
      <header className="section-container pt-16 pb-10">
        <Caption className="text-core-orange font-bold tracking-widest uppercase">
          The guide
        </Caption>
        <h1 className="font-breadDisplay text-text-standard mt-2 max-w-2xl text-5xl font-extrabold tracking-tight">
          Every step, shown once
        </h1>
        <Body className="text-surface-grey-2 mt-4 max-w-2xl">
          A walk through the whole life of a circle — joining, checking in,
          reporting a passing, sharing an estate, drawing income. Each section
          pairs a short recording with the exact steps.
        </Body>
        <div className="mt-6 flex gap-3">
          <Button app="fund" variant="primary" as={Link} href="/app">
            Open the app
          </Button>
          <Button app="fund" variant="secondary" as={Link} href="/">
            Back to home
          </Button>
        </div>
      </header>

      {/* Contents */}
      <nav className="section-container pb-8">
        <div className="border-paper-2 bg-paper-0 rounded-2xl border p-5">
          <Caption className="text-surface-grey-2">On this page</Caption>
          <ol className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {FLOWS.map((f) => (
              <li key={f.id}>
                <a
                  href={`#${f.id}`}
                  className="text-text-standard hover:text-core-orange flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <span className="bg-core-orange/10 text-core-orange inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {f.n}
                  </span>
                  {f.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      {/* Honesty note */}
      <div className="section-container pb-12">
        <div className="border-primary-jade/30 bg-primary-jade/5 rounded-2xl border px-5 py-4">
          <Body className="text-surface-grey-2 text-sm">
            <span className="text-text-standard font-semibold">
              About these recordings — and what&apos;s simulated.
            </span>{" "}
            Every action shown is a real transaction on Gnosis Chain, in the
            live demonstration circles listed at the bottom of this page, from a
            burner wallet. Two things are demo-tuned: seasons and waiting
            periods last minutes instead of months, and the email checks accept
            practice emails while the verified-email system is completed. The
            money, the rules, the deposits, and the share-outs are all real.
          </Body>
        </div>
      </div>

      {/* Flows */}
      <main className="section-container space-y-20 pb-24">
        {FLOWS.map((f, i) => (
          <FlowSection key={f.id} flow={f} eager={i === 0} />
        ))}

        {/* Live system */}
        <section id="system" className="scroll-mt-20">
          <div className="flex items-center gap-3">
            <span className="bg-core-orange/10 text-core-orange inline-flex h-9 w-9 items-center justify-center rounded-xl">
              <ArrowSquareOut weight="duotone" size={20} />
            </span>
            <h2 className="font-breadDisplay text-text-standard text-3xl font-extrabold tracking-tight">
              The books, in public
            </h2>
          </div>
          <Body className="text-surface-grey-2 mt-3 max-w-2xl">
            Everything runs on Gnosis Chain in the open. These are the live
            pieces — click any of them to read the ledger yourself.
          </Body>
          <div className="border-paper-2 divide-paper-2 bg-paper-0 mt-6 divide-y overflow-hidden rounded-2xl border">
            {SYSTEM.map(([label, addr]) => (
              <a
                key={label}
                href={`https://gnosis.blockscout.com/address/${addr}`}
                target="_blank"
                rel="noreferrer"
                className="hover:bg-paper-1 flex items-center justify-between gap-4 px-5 py-3.5 transition-colors"
              >
                <span className="text-text-standard text-sm font-medium">{label}</span>
                <span className="text-surface-grey-2 flex items-center gap-2 font-mono text-xs sm:text-sm">
                  {addr.slice(0, 10)}…{addr.slice(-6)}
                  <ArrowSquareOut size={14} />
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* Footer CTA */}
        <section className="border-paper-2 bg-paper-0 rounded-3xl border px-8 py-12 text-center">
          <h2 className="font-breadDisplay text-text-standard text-3xl font-extrabold tracking-tight">
            Ready to pull up a chair?
          </h2>
          <Body className="text-surface-grey-2 mx-auto mt-3 max-w-xl">
            The Rising Circle is open right now. Join, check in, and see your
            first month&apos;s bread — the whole journey takes about an hour at
            demo speed.
          </Body>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              app="fund"
              variant="primary"
              as={Link}
              href="/app"
              rightIcon={<ArrowRight weight="bold" />}
            >
              Open the app
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function FlowSection({ flow, eager }: { flow: Flow; eager?: boolean }) {
  return (
    <section id={flow.id} className="scroll-mt-20">
      <div className="flex items-center gap-3">
        <span className="bg-core-orange/10 text-core-orange inline-flex h-9 w-9 items-center justify-center rounded-xl text-xl">
          {flow.icon}
        </span>
        <Caption className="text-surface-grey-2 font-semibold">Step {flow.n}</Caption>
      </div>
      <h2 className="font-breadDisplay text-text-standard mt-2 text-3xl font-extrabold tracking-tight">
        {flow.title}
      </h2>
      <Body className="text-surface-grey-2 mt-3 max-w-2xl">{flow.blurb}</Body>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <ol className="space-y-4">
          {flow.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="bg-core-orange mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                {i + 1}
              </span>
              <Body className="text-text-standard">{s}</Body>
            </li>
          ))}
        </ol>

        <figure className="border-paper-2 bg-paper-0 overflow-hidden rounded-2xl border shadow-sm">
          <div className="border-paper-2 bg-paper-1 flex items-center gap-1.5 border-b px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <Caption className="text-surface-grey-2 ml-3 truncate">
              Long Bread — {flow.title}
            </Caption>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gif(flow.media)}
            alt={`${flow.title} walkthrough`}
            width={900}
            height={563}
            className="block h-auto w-full"
            loading={eager ? "eager" : "lazy"}
          />
        </figure>
      </div>
    </section>
  )
}
