"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Body, Caption, LoginButton, Logo } from "@breadcoop/ui"
import { CaretDown } from "@phosphor-icons/react"
import { useAccount, useDisconnect, useReadContract } from "wagmi"
import { tontinePoolAbi } from "../../lib/contracts"
import { useActivePool, type PoolInfo } from "../../lib/pools"
import { fmtCountdown, fmtXdai } from "../util"
import { OverviewPanel } from "./overview"
import { JoinPanel } from "./join"
import { CheckinPanel } from "./checkin"
import { IncomePanel } from "./income"
import { PassingsPanel } from "./passings"

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "join", label: "Join" },
  { key: "checkin", label: "Check in" },
  { key: "income", label: "Income" },
  { key: "passings", label: "Passings" },
] as const

type TabKey = (typeof TABS)[number]["key"]

export function AppShell() {
  const { pool, pools, setActive } = useActivePool()
  const [tab, setTab] = useState<TabKey>("overview")

  // Deep-linkable tabs (#join, #checkin, …).
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "")
      if (TABS.some((t) => t.key === h)) setTab(h as TabKey)
    }
    fromHash()
    window.addEventListener("hashchange", fromHash)
    return () => window.removeEventListener("hashchange", fromHash)
  }, [])

  const pick = (t: TabKey) => {
    setTab(t)
    history.replaceState(null, "", `#${t}`)
  }

  return (
    <div className="bg-paper-main min-h-screen">
      <header className="border-paper-2 bg-paper-main/80 sticky top-0 z-50 border-b backdrop-blur">
        <nav className="section-container flex h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <Logo variant="square" color="orange" size={30} />
              <span className="font-breadDisplay text-text-standard hidden text-lg font-bold lg:inline">
                Long Bread
              </span>
            </Link>
            {pool && <CircleSwitcher pool={pool} pools={pools} setActive={setActive} />}
          </div>
          <div className="scrollbar-none hidden items-center gap-1 overflow-x-auto md:flex">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => pick(t.key)}
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                  tab === t.key
                    ? "bg-core-orange/10 text-core-orange"
                    : "text-surface-grey-2 hover:text-text-standard"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <WalletButton />
          </div>
        </nav>
        {/* Mobile tab row */}
        <div className="scrollbar-none border-paper-2 flex gap-1 overflow-x-auto border-t px-4 py-2 md:hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => pick(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap ${
                tab === t.key
                  ? "bg-core-orange text-white"
                  : "bg-paper-1 text-surface-grey-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="section-container space-y-6 py-8 pb-24">
        {pool ? (
          <>
            <CircleHero pool={pool} />
            {tab === "overview" && <OverviewPanel pool={pool} goJoin={() => pick("join")} />}
            {tab === "join" && <JoinPanel pool={pool} />}
            {tab === "checkin" && <CheckinPanel />}
            {tab === "income" && <IncomePanel pool={pool} />}
            {tab === "passings" && <PassingsPanel pool={pool} />}
          </>
        ) : (
          <Body className="text-surface-grey-2">Finding the circles…</Body>
        )}
        <Caption className="text-surface-grey-2 block pt-4">
          Live demonstration circle — real rules and real transactions on Gnosis
          Chain, with seasons sped up to minutes and practice emails accepted in
          place of the verified-email check. <Link href="/docs" className="underline">The guide</Link>{" "}
          walks every step.
        </Caption>
      </main>
    </div>
  )
}

/* The kit's LoginButton renders nothing once connected — wrap it so the
   connected account stays visible and can sign out. */
function WalletButton() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="border-paper-2 bg-paper-0 rounded-full border px-3 py-1.5 font-mono text-xs">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-surface-grey-2 hover:text-core-orange text-xs font-semibold underline"
        >
          Sign out
        </button>
      </div>
    )
  }
  return <LoginButton />
}

function CircleSwitcher({
  pool,
  pools,
  setActive,
}: {
  pool: PoolInfo
  pools: PoolInfo[]
  setActive: (a: `0x${string}`) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="border-paper-2 bg-paper-0 hover:border-core-orange flex max-w-56 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold"
      >
        <span className="truncate">{pool.name}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            pool.locked ? "bg-primary-jade/10 text-primary-jade" : "bg-core-orange/10 text-core-orange"
          }`}
        >
          {pool.locked ? "paying income" : "open"}
        </span>
        <CaretDown size={12} className="shrink-0" />
      </button>
      {open && (
        <div className="border-paper-2 bg-paper-0 absolute top-full left-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border shadow-lg">
          {pools.map((p) => (
            <button
              key={p.address}
              onClick={() => {
                setActive(p.address)
                setOpen(false)
              }}
              className={`hover:bg-paper-1 flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm ${
                p.address === pool.address ? "bg-paper-1 font-bold" : ""
              }`}
            >
              <span className="truncate">{p.name}</span>
              <span className="text-surface-grey-2 shrink-0 text-xs">
                {p.locked ? "paying income" : "open to join"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CircleHero({ pool }: { pool: PoolInfo }) {
  const p = { address: pool.address, abi: tontinePoolAbi } as const
  const { data: totalAssets } = useReadContract({ ...p, functionName: "poolTotalAssets", query: { refetchInterval: 10000 } })
  const { data: living } = useReadContract({ ...p, functionName: "livingMembers", query: { refetchInterval: 10000 } })
  const { data: bountyBps } = useReadContract({ ...p, functionName: "bountyBps" })
  const { data: maxMembers } = useReadContract({ ...p, functionName: "maxMembers" })

  const chips: [string, string, string?][] = [
    ["Saved together", `${fmtXdai(totalAssets as bigint)} xDAI`, "earning interest as one pot"],
    ["At the table", `${living ?? "—"} member${Number(living ?? 0) === 1 ? "" : "s"}`, `room for ${maxMembers ?? "—"}`],
    pool.locked
      ? ["Season", "Paying income", "doors closed — seats are lifelong"]
      : ["Doors close", fmtCountdown(pool.lockTime), "join or leave freely until then"],
    ["Finder's thank-you", bountyBps !== undefined ? `${Number(bountyBps) / 100}%` : "—", "for truthfully reporting a passing"],
  ]

  return (
    <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-breadDisplay text-text-standard text-4xl font-extrabold tracking-tight">
          {pool.name}
        </h1>
        <Caption className="text-surface-grey-2">a Long Bread income circle on Gnosis</Caption>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {chips.map(([label, value, sub]) => (
          <div key={label} className="border-paper-2 bg-paper-1 rounded-2xl border px-4 py-3">
            <Caption className="text-surface-grey-2 uppercase">{label}</Caption>
            <div className="font-breadDisplay text-text-standard mt-0.5 text-xl font-extrabold">
              {value}
            </div>
            {sub && <Caption className="text-surface-grey-2">{sub}</Caption>}
          </div>
        ))}
      </div>
    </div>
  )
}
