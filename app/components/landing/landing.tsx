"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Body, Button, Caption } from "@breadcoop/ui"
import {
  ArrowRight,
  CheckCircle,
  ClockCounterClockwise,
  Detective,
  EnvelopeSimple,
  Eye,
  HandCoins,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react"
import { SiteFooter, SiteNav } from "../site"
import { HowItWorks } from "./how-it-works"
import { IncomeCalculator } from "./income-calculator"

export function LandingPage() {
  return (
    <div className="bg-paper-main min-h-screen">
      <SiteNav
        links={[
          { href: "#how-it-works", label: "How it works" },
          { href: "#calculator", label: "What it pays" },
          { href: "#safety", label: "What keeps it honest" },
          { href: "#faq", label: "Questions" },
        ]}
      />
      <main>
        <Hero />
        <ValueCards />
        <HowItWorks />
        <IncomeCalculator />
        <Safety />
        <Faq />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  )
}

/* --------------------------------- Hero ---------------------------------- */

function Hero() {
  return (
    <section id="top" className="section-container py-20 lg:py-28">
      <div className="mx-auto flex max-w-2xl flex-col justify-center text-center">
        <h1 className="font-breadDisplay text-core-orange text-6xl leading-[1.04] font-extrabold tracking-tight break-words sm:text-7xl">
          Long Bread
        </h1>
        <h2 className="font-breadDisplay text-primary-jade mt-2 text-3xl font-bold italic sm:text-4xl">
          Income for life, from a circle of friends.
        </h2>
        <Body className="text-surface-grey-2 mx-auto mt-6 max-w-xl text-lg">
          Long Bread is a savings circle that pays its members a monthly income
          for as long as they live. Everyone puts something in, the pot earns
          interest, and when a member passes on, their balance stays at the
          table — shared between their family and the friends who outlive them.
        </Body>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button
            app="fund"
            variant="primary"
            as={Link}
            href="/app"
            rightIcon={<ArrowRight weight="bold" />}
          >
            Join a circle
          </Button>
          <Button app="fund" variant="secondary" as={Link} href="/docs">
            Read the guide
          </Button>
        </div>
        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {[
            "No company in the middle",
            "Refundable until the doors close",
            "The books are public",
          ].map((t) => (
            <li key={t} className="text-surface-grey-2 flex items-center gap-1.5 text-sm">
              <CheckCircle className="text-system-green" weight="fill" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------ Value cards ------------------------------ */

function ValueCards() {
  const cards = [
    {
      icon: <UsersThree weight="duotone" />,
      title: "A pension without a pension company",
      body: "For a century, the weak link in shared retirement pots was the company holding the pot. Here there isn't one: the rules run themselves and no hand can reach into the till.",
    },
    {
      icon: <HandCoins weight="duotone" />,
      title: "The longer you live, the more you receive",
      body: "Your monthly income is sized to your age and grows as the circle shares. It cannot run out while you're alive to draw it.",
    },
    {
      icon: <EnvelopeSimple weight="duotone" />,
      title: "One email a season keeps your seat",
      body: "No apps to babysit, no forms. A single short email each season tells the circle you're still here — and forgetting one never costs you a cent.",
    },
  ]
  return (
    <section className="bg-paper-1 border-paper-2 border-y">
      <div className="section-container grid gap-6 py-16 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="border-paper-2 bg-paper-0 rounded-2xl border p-6">
            <span className="bg-core-orange/10 text-core-orange inline-flex h-10 w-10 items-center justify-center rounded-xl text-2xl">
              {c.icon}
            </span>
            <h3 className="font-breadDisplay text-text-standard mt-4 text-xl font-extrabold">
              {c.title}
            </h3>
            <Body className="text-surface-grey-2 mt-2 text-sm">{c.body}</Body>
          </div>
        ))}
      </div>
    </section>
  )
}

/* --------------------------------- Safety -------------------------------- */

function Safety() {
  const items: { icon: ReactNode; title: string; body: string }[] = [
    {
      icon: <ShieldCheck weight="duotone" />,
      title: "A passing must be proven",
      body: "Only a verified email from a trusted institution — a funeral home, an obituary page, an insurer — can report that a member has passed. Word of mouth doesn't move a cent.",
    },
    {
      icon: <ClockCounterClockwise weight="duotone" />,
      title: "Then everyone waits",
      body: "Every report opens a waiting period. If it's wrong, the member cancels it with a single check-in — and keeps the reporter's good-faith deposit for the trouble.",
    },
    {
      icon: <Detective weight="duotone" />,
      title: "Hiding a passing doesn't pay",
      body: "Whoever brings true news earns a small thank-you from the estate. Obituaries are public, so keeping a death quiet becomes a race the dishonest lose.",
    },
    {
      icon: <Eye weight="duotone" />,
      title: "Everything in the open",
      body: "Every seat, every share-out, every rule is on a public ledger anyone can read. Members are known only by a private fingerprint — never by name.",
    },
  ]
  return (
    <section id="safety" className="bg-paper-1 border-paper-2 border-y">
      <div className="section-container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="border-paper-2 bg-paper-0 text-surface-grey-2 inline-block rounded-lg border px-4 py-1.5 text-sm font-semibold">
            What keeps it honest
          </span>
          <h2 className="font-breadDisplay text-text-standard mt-4 text-3xl font-extrabold tracking-tight">
            Built for the hard questions
          </h2>
          <Body className="text-surface-grey-2 mt-3">
            A circle that shares money on life and death has to survive liars,
            forgetful members, and grieving families. Here&apos;s how it does.
          </Body>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {items.map((it) => (
            <div key={it.title} className="border-paper-2 bg-paper-0 flex gap-4 rounded-2xl border p-6">
              <span className="bg-primary-jade/10 text-primary-jade inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl">
                {it.icon}
              </span>
              <div>
                <h3 className="font-breadDisplay text-text-standard text-lg font-extrabold">
                  {it.title}
                </h3>
                <Body className="text-surface-grey-2 mt-1 text-sm">{it.body}</Body>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------- FAQ ---------------------------------- */

function Faq() {
  const faqs = [
    {
      q: "What happens if I forget to check in?",
      a: "Your income pauses and waits for you — up to a year of missed months stays claimable. Nothing is ever taken away because you were travelling, ill, or just forgot. One check-in and you're back.",
    },
    {
      q: "Can I get my money back?",
      a: "Yes — in full, any time before your circle's doors close. After that the promise works both ways: your seat is permanent, which is exactly what makes lifetime income possible for everyone else.",
    },
    {
      q: "What does my family get?",
      a: "You choose when you join: up to half of your balance goes directly to a person you name. The rest stays with the circle — that's the deal that funds everyone's old age, including yours.",
    },
    {
      q: "Who decides that someone has passed away?",
      a: "Nobody decides — it's proven. A report needs a verified email from a real institution and a good-faith deposit, then a waiting period. A living member cancels it with one check-in and pockets the deposit.",
    },
    {
      q: "What if someone is wrongly reported dead?",
      a: "It happens in the real world more than you'd think — which is why nothing moves until the waiting period ends. The wrongly-reported member checks in once, the report dies instead, and they're paid for the insult.",
    },
    {
      q: "Is this insurance?",
      a: "No. Nothing is guaranteed by any company and nobody underwrites anything — members share fortune and misfortune between themselves, by fixed rules everyone can read. It's closer to a village tradition than a policy.",
    },
    {
      q: "Is this a real, live system?",
      a: "Yes — the circle you can join today runs on Gnosis Chain with real money and real rules, sped up so a season lasts minutes instead of months. One piece is still simulated: the email checks accept practice emails while the verified-email system is being finished. The guide marks exactly what that means.",
    },
  ]
  return (
    <section id="faq" className="section-container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-breadDisplay text-text-standard text-3xl font-extrabold tracking-tight">
          Fair questions
        </h2>
      </div>
      <div className="mx-auto mt-8 max-w-3xl space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="border-paper-2 bg-paper-0 group rounded-2xl border px-6 py-4">
            <summary className="text-text-standard cursor-pointer list-none text-base font-bold">
              <span className="flex items-center justify-between gap-4">
                {f.q}
                <span className="text-core-orange transition-transform group-open:rotate-45">＋</span>
              </span>
            </summary>
            <Body className="text-surface-grey-2 mt-3 text-sm">{f.a}</Body>
          </details>
        ))}
      </div>
    </section>
  )
}

/* --------------------------------- CTA band ------------------------------- */

function CtaBand() {
  return (
    <section className="section-container pb-20">
      <div className="bg-primary-jade rounded-3xl px-8 py-14 text-center">
        <h2 className="font-breadDisplay text-3xl font-extrabold tracking-tight text-white">
          Save together. Stay together. Eat forever.
        </h2>
        <Body className="mx-auto mt-3 max-w-xl text-white/85">
          The demonstration circle is open right now — walk the whole journey,
          from taking a seat to drawing your first month&apos;s bread, in about
          an hour.
        </Body>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button app="fund" variant="primary" as={Link} href="/app" rightIcon={<ArrowRight weight="bold" />}>
            Open the app
          </Button>
          <Button app="fund" variant="secondary" as={Link} href="/docs">
            Read the guide first
          </Button>
        </div>
        <Caption className="mt-4 block text-white/70">
          You&apos;ll need a wallet with a little xDAI on Gnosis Chain.
        </Caption>
      </div>
    </section>
  )
}
