"use client"

import { useEffect, useState } from "react"
import { Body, Caption } from "@breadcoop/ui"
import {
  ChartLineUp,
  EnvelopeSimple,
  HandHeart,
  Handshake,
  Money,
} from "@phosphor-icons/react"

/* The crowdstake-style animated mechanism walkthrough: numbered step tabs
   under a visual stage, auto-advancing until the reader takes over. */

type Step = {
  key: string
  label: string
  title: string
  tag: string
  body: string
  icon: React.ReactNode
  stage: React.ReactNode
}

function StageCard({
  title,
  sub,
  tone = "paper",
  wide,
}: {
  title: string
  sub?: string
  tone?: "paper" | "jade" | "orange"
  wide?: boolean
}) {
  const tones = {
    paper: "bg-paper-0 border-paper-2 text-text-standard",
    jade: "bg-primary-jade border-primary-jade text-white",
    orange: "bg-core-orange border-core-orange text-white",
  }
  return (
    <div
      className={`rounded-2xl border px-5 py-4 text-center shadow-sm ${tones[tone]} ${
        wide ? "min-w-52" : "min-w-40"
      }`}
    >
      <div className="text-sm font-bold">{title}</div>
      {sub && <div className="mt-1 text-xs opacity-80">{sub}</div>}
    </div>
  )
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center px-1">
      {label && <span className="text-core-orange mb-1 text-[10px] font-bold">{label}</span>}
      <span className="text-surface-grey-2 text-xl">→</span>
    </div>
  )
}

const STEPS: Step[] = [
  {
    key: "join",
    label: "Join",
    title: "Pull up a chair",
    tag: "Your money stays yours",
    body: "You put in savings while the circle's doors are open, name who should inherit a share, and take a seat. Change your mind before the doors close? Full refund, no questions.",
    icon: <Handshake weight="duotone" />,
    stage: (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <StageCard title="Your savings" sub="in while doors are open" />
        <Arrow />
        <StageCard title="The circle" sub="everyone's seats, side by side" tone="jade" wide />
        <Arrow />
        <StageCard title="Full refund" sub="any time before the doors close" />
      </div>
    ),
  },
  {
    key: "grow",
    label: "Grow",
    title: "The pot quietly earns",
    tag: "Interest, automatically",
    body: "The circle's savings sit in Gnosis Chain's savings vault and earn interest on their own. Nobody manages it, nobody can dip into it — the books are public and anyone can check them.",
    icon: <ChartLineUp weight="duotone" />,
    stage: (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <StageCard title="The circle's pot" sub="pooled savings" tone="jade" wide />
        <Arrow label="earns" />
        <StageCard title="Interest" sub="added automatically, every day" tone="orange" />
      </div>
    ),
  },
  {
    key: "checkin",
    label: "Check in",
    title: "One little hello, each season",
    tag: "Forgetting costs you nothing",
    body: "Every season you send one short email to show you're still around. Miss it and your income simply waits for you — nothing is ever taken away for silence. Come back, check in, and pick up where you left off.",
    icon: <EnvelopeSimple weight="duotone" />,
    stage: (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <StageCard title="Your email" sub="one line, once a season" />
        <Arrow label="verified" />
        <StageCard title="✓ Checked in" sub="income keeps flowing" tone="jade" />
        <Arrow label="or" />
        <StageCard title="Paused" sub="waits for you — never lost" />
      </div>
    ),
  },
  {
    key: "share",
    label: "Share",
    title: "When a member passes",
    tag: "Proven, challenged, then shared",
    body: "A passing is reported with a verified email from a funeral home, obituary page, or insurer — and then everyone waits. If it's a mistake, one check-in cancels it and the reporter pays for the trouble. If it's true, the member's balance is shared: a piece to their family, a thank-you to whoever brought the news, and the rest to the circle.",
    icon: <HandHeart weight="duotone" />,
    stage: (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <StageCard title="A member's balance" tone="jade" wide />
        <Arrow label="shared" />
        <div className="flex flex-col gap-2">
          <StageCard title="Their family" sub="the share they chose" />
          <StageCard title="The circle" sub="split fairly by age & stake" tone="orange" />
        </div>
      </div>
    ),
  },
  {
    key: "income",
    label: "Income",
    title: "Monthly bread, for life",
    tag: "More the longer you live",
    body: "Once the doors close, every member draws a monthly income sized to their age. As the circle grows smaller over the years, the shares grow larger — the members who live longest are carried by everyone who came before.",
    icon: <Money weight="duotone" />,
    stage: (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <StageCard title="The circle's pot" tone="jade" wide />
        <Arrow label="monthly" />
        <StageCard title="Your income" sub="sized to your age, for life" tone="orange" wide />
      </div>
    ),
  },
]

export function HowItWorks() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setActive((a) => (a + 1) % STEPS.length), 5000)
    return () => clearInterval(t)
  }, [paused])

  const step = STEPS[active]

  return (
    <section id="how-it-works" className="section-container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="border-paper-2 bg-paper-0 text-surface-grey-2 inline-block rounded-lg border px-4 py-1.5 text-sm font-semibold">
          How the circle works
        </span>
        <Body className="text-surface-grey-2 mt-4">
          Five ideas, each one simple. Together they turn a group of neighbours
          into a pension.
        </Body>
      </div>

      <div className="border-paper-2 bg-paper-0 mt-10 overflow-hidden rounded-3xl border">
        <div className="px-6 py-12 sm:px-10" key={step.key}>
          <div className="rise-in">
            <div className="flex min-h-40 items-center justify-center">{step.stage}</div>
            <div className="mx-auto mt-8 max-w-xl text-center">
              <div className="flex items-center justify-center gap-3">
                <span className="bg-core-orange/10 text-core-orange inline-flex h-9 w-9 items-center justify-center rounded-xl text-xl">
                  {step.icon}
                </span>
                <h3 className="font-breadDisplay text-text-standard text-2xl font-extrabold">
                  {step.title}
                </h3>
                <span className="border-paper-2 bg-paper-1 text-surface-grey-2 hidden rounded-lg border px-2.5 py-1 text-xs font-semibold sm:inline">
                  {step.tag}
                </span>
              </div>
              <Body className="text-surface-grey-2 mt-3">{step.body}</Body>
            </div>
          </div>
        </div>

        <div className="border-paper-2 grid grid-cols-5 border-t">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => {
                setActive(i)
                setPaused(true)
              }}
              className={`flex items-center justify-center gap-2 border-b-2 px-2 py-4 text-xs font-semibold transition-colors sm:text-sm ${
                i === active
                  ? "border-core-orange bg-paper-0 text-text-standard"
                  : "text-surface-grey-2 hover:text-text-standard border-transparent bg-paper-1"
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  i === active ? "bg-core-orange text-white" : "bg-paper-2 text-surface-grey-2"
                }`}
              >
                {i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
      <Caption className="text-surface-grey-2 mt-3 block text-center">
        Fair shares use the same arithmetic pension actuaries use — older members
        and larger stakes receive proportionally more, so nobody subsidises anybody.
      </Caption>
    </section>
  )
}
